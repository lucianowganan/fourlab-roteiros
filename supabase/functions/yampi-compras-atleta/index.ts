// Edge Function: yampi-compras-atleta
// Busca na Yampi os pedidos feitos com o CUPOM DE COMPRAS de cada atleta (primeiro nome + 6 dígitos do CPF,
// cadastrado em Atletas & parceiros → Dados cadastrais) e salva os produtos que ele mais pede em atleta_compras.
// A tela Mês / Roteiros mostra esses produtos ao lado da escolha de produto.
//
// Entrada: { athleteIds: [uuid...], meses?: 6 }   (só a equipe pode chamar)
//          { diagnostico: true } → devolve só os NOMES dos campos de um pedido da Yampi (pra conferir a integração)
// Saída:   { resultados: [{ athlete_id, cupom, itens, total_pedidos, ultima_compra, erro }], pedidosLidos }
//
// Publicar: Supabase → Edge Functions → Deploy a new function → nome "yampi-compras-atleta" → colar este arquivo.
// Usa as mesmas credenciais da Yampi da função yampi-sync-atleta (secrets nas Edge Functions).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function responder(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
}
// deno-lint-ignore no-explicit-any
type Json = any;
const env = (...nomes: string[]) => nomes.map((n) => Deno.env.get(n)).find((v) => v && v.trim()) || "";
const normalizar = (s: unknown) => String(s ?? "").trim().toUpperCase();

// ---------------- Yampi (tudo que depende da API fica aqui) ----------------
const YAMPI_ALIAS = env("YAMPI_ALIAS") || "fourlab";
const YAMPI_BASE = (env("YAMPI_BASE_URL") || "https://api.dooki.com.br/v2") + "/" + YAMPI_ALIAS;
const POR_PAGINA = 50;
const MAX_PAGINAS = 60;   // até 3.000 pedidos por busca

function cabecalhosYampi() {
  const token = env("YAMPI_USER_TOKEN", "YAMPI_TOKEN", "YAMPI_API_TOKEN");
  const segredo = env("YAMPI_USER_SECRET_KEY", "YAMPI_SECRET_KEY", "YAMPI_SECRET", "YAMPI_API_SECRET");
  if (!token || !segredo) throw new Error("Faltam as credenciais da Yampi nos secrets das Edge Functions (YAMPI_USER_TOKEN e YAMPI_USER_SECRET_KEY).");
  return { "User-Token": token, "User-Secret-Key": segredo, "Content-Type": "application/json", "Accept": "application/json" };
}
async function getYampi(caminho: string): Promise<Json> {
  const r = await fetch(`${YAMPI_BASE}${caminho}`, { headers: cabecalhosYampi() });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Yampi respondeu ${r.status}: ${dados?.message || dados?.error || "sem detalhe"}`);
  return dados;
}
// Pedidos de um período (com itens e cupom). A API pagina; paramos no limite de segurança.
async function pedidosDoPeriodo(de: string, ate: string): Promise<Json[]> {
  const todos: Json[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const q = new URLSearchParams({ include: "items,promocode", limit: String(POR_PAGINA), page: String(pagina), date: `created_at:${de}|${ate}` });
    const resp = await getYampi(`/orders?${q}`);
    const lista: Json[] = resp?.data || [];
    todos.push(...lista);
    const total = resp?.meta?.pagination?.total_pages;
    if (!lista.length || (total && pagina >= total) || lista.length < POR_PAGINA) break;
  }
  return todos;
}
// Lê os campos do pedido de jeito tolerante (a Yampi às vezes embrulha em { data: ... })
const desembrulhar = (v: Json) => (v && typeof v === "object" && "data" in v ? v.data : v);
function cupomDoPedido(p: Json): string {
  const pc = desembrulhar(p.promocode);
  return normalizar(pc?.code || pc?.name || p.promocode_code || p.coupon_code || p.coupon || "");
}
function itensDoPedido(p: Json): { nome: string; quantidade: number }[] {
  const itens = desembrulhar(p.items) || [];
  return (Array.isArray(itens) ? itens : []).map((it: Json) => {
    const sku = desembrulhar(it.sku) || {};
    const nome = it.product_name || it.name || it.title || sku.title || sku.name || desembrulhar(it.product)?.name || "Produto";
    return { nome: String(nome).trim(), quantidade: Number(it.quantity || it.qty || 1) || 1 };
  });
}
function dataDoPedido(p: Json): string {
  const d = desembrulhar(p.created_at);
  return String((d && typeof d === "object" ? d.date : d) || "").slice(0, 10);
}
const STATUS_IGNORADOS = /cancel|refused|recus|estorn|refund/i;
function pedidoValido(p: Json) {
  const st = desembrulhar(p.status);
  return !STATUS_IGNORADOS.test(String(st?.alias || st?.name || p.status_alias || ""));
}
// -----------------------------------------------------------------------------

async function identificar(req: Request, admin: SupabaseClient): Promise<{ id: string } | { erro: string }> {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { erro: "O login não chegou na função. Saia e entre de novo no painel." };
  if (token.startsWith("sb_") || !token.startsWith("ey")) {
    return { erro: "Chegou a chave pública do site, não o seu login (você está deslogado neste navegador). Saia e entre de novo no painel." };
  }
  const motivos: string[] = [];
  // 1) Jeito padrão: pergunta ao Auth do Supabase
  const r1 = await admin.auth.getUser(token).catch((e) => ({ data: { user: null }, error: e }));
  if (r1.data?.user) return { id: r1.data.user.id };
  if (r1.error) motivos.push(r1.error.message || String(r1.error));
  // 2) Projetos com as novas chaves de assinatura (JWT signing keys): valida o token pelas chaves públicas
  const getClaims = (admin.auth as unknown as { getClaims?: (t: string) => Promise<{ data: { claims?: { sub?: string } } | null; error: { message: string } | null }> }).getClaims;
  if (getClaims) {
    const r2 = await getClaims.call(admin.auth, token).catch((e) => ({ data: null, error: e }));
    if (r2.data?.claims?.sub) return { id: r2.data.claims.sub };
    if (r2.error) motivos.push(r2.error.message || String(r2.error));
  }
  // 3) Último recurso: cliente com a chave pública + o login do usuário
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (anon) {
    const user = createClient(Deno.env.get("SUPABASE_URL")!, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const r3 = await user.auth.getUser().catch((e) => ({ data: { user: null }, error: e }));
    if (r3.data?.user) return { id: r3.data.user.id };
    if (r3.error) motivos.push(r3.error.message || String(r3.error));
  }
  console.error("identificar falhou:", motivos);
  const detalhe = [...new Set(motivos)].join(" / ") || "sem detalhe";
  if (/expired/i.test(detalhe)) return { erro: "Sua sessão expirou — saia e entre de novo no painel." };
  return { erro: `Não consegui confirmar seu login (${detalhe}). Saia e entre de novo no painel; se continuar, me mande esta mensagem.` };
}

// Equipe = logado, sem perfil de atleta e sem cadastro de atleta ligado ao login (mesma regra do eh_equipe() do banco)
async function ehEquipe(admin: SupabaseClient, id: string) {
  const [{ data: perfil }, { data: atleta }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", id).maybeSingle(),
    admin.from("athletes").select("id").eq("auth_user_id", id).limit(1).maybeSingle(),
  ]);
  return perfil?.role !== "atleta" && !atleta;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const quem = await identificar(req, admin);
    if ("erro" in quem) return responder({ error: quem.erro });
    if (!(await ehEquipe(admin, quem.id))) return responder({ error: "Só a equipe FourLab pode buscar as compras dos atletas." });
    const body = await req.json().catch(() => ({}));

    const meses = Math.min(12, Math.max(1, parseInt(body.meses) || 6));
    const fim = new Date(), inicio = new Date(); inicio.setMonth(inicio.getMonth() - meses);
    const de = inicio.toISOString().slice(0, 10), ate = fim.toISOString().slice(0, 10);

    if (body.diagnostico) {
      const q = new URLSearchParams({ include: "items,promocode", limit: "1", date: `created_at:${de}|${ate}` });
      const resp = await getYampi(`/orders?${q}`);
      const p = resp?.data?.[0];
      if (!p) return responder({ ok: true, aviso: "Nenhum pedido no período.", meta: resp?.meta || null });
      const item = (desembrulhar(p.items) || [])[0] || {};
      return responder({ ok: true, camposPedido: Object.keys(p), camposItem: Object.keys(item), cupomLido: cupomDoPedido(p), itensLidos: itensDoPedido(p).length, meta: resp?.meta?.pagination || null });
    }

    const ids: string[] = Array.isArray(body.athleteIds) ? body.athleteIds.slice(0, 200) : [];
    if (!ids.length) return responder({ error: "Nenhum atleta informado." });
    const { data: cads, error: erroCad } = await admin.from("atleta_cadastro").select("athlete_id, cupom_compras").in("athlete_id", ids);
    if (erroCad) return responder({ error: "Falta rodar migrations/2026-10-09_compras_atleta.sql no Supabase." });
    const cupomDe = new Map((cads || []).filter((c: Json) => normalizar(c.cupom_compras)).map((c: Json) => [c.athlete_id, normalizar(c.cupom_compras)]));
    if (!cupomDe.size) return responder({ error: "Nenhum desses atletas tem cupom de compras cadastrado." });

    // Uma busca só na Yampi pra todos os atletas pedidos (bem mais rápido que um por um)
    let pedidos: Json[] = [];
    try { pedidos = await pedidosDoPeriodo(de, ate); }
    catch (e) { return responder({ error: (e as Error).message }); }

    const porCupom = new Map<string, Json[]>();
    for (const p of pedidos) {
      if (!pedidoValido(p)) continue;
      const c = cupomDoPedido(p); if (!c) continue;
      (porCupom.get(c) || porCupom.set(c, []).get(c)!).push(p);
    }
    const resultados = [];
    for (const [athleteId, cupom] of cupomDe) {
      const dele = porCupom.get(cupom) || [];
      const agreg = new Map<string, { nome: string; quantidade: number; pedidos: number; ultima_compra: string }>();
      for (const p of dele) {
        const data = dataDoPedido(p);
        for (const it of itensDoPedido(p)) {
          const chave = it.nome.toLowerCase();
          const a = agreg.get(chave) || { nome: it.nome, quantidade: 0, pedidos: 0, ultima_compra: "" };
          a.quantidade += it.quantidade; a.pedidos += 1; if (data > a.ultima_compra) a.ultima_compra = data;
          agreg.set(chave, a);
        }
      }
      const itens = [...agreg.values()].sort((x, y) => y.pedidos - x.pedidos || y.ultima_compra.localeCompare(x.ultima_compra)).slice(0, 15);
      const ultima = dele.map(dataDoPedido).sort().pop() || null;
      const linha = { athlete_id: athleteId, cupom, itens, total_pedidos: dele.length, ultima_compra: ultima, erro: "", atualizado_em: new Date().toISOString() };
      await admin.from("atleta_compras").upsert(linha);
      resultados.push(linha);
    }
    return responder({ resultados, pedidosLidos: pedidos.length, periodo: { de, ate } });
  } catch (err) {
    console.error(err);
    return responder({ error: `Erro inesperado: ${(err as Error)?.message || err}` });
  }
});
