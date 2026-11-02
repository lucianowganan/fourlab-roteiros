// Edge Function "criar-cupons-creator": cria na Yampi os cupons do creator (regras da Etapa 02):
// 10% pros seguidores (com comissão) + 30% de uso pessoal com limite de usos. Vale pro site todo, sem validade.
// Entrada: { creatorId, cupom10, cupom30, usos }  · { diagnostico:true } mostra os campos de um cupom da Yampi.
// Usa os mesmos secrets da Yampi das outras funções (YAMPI_USER_TOKEN, YAMPI_USER_SECRET_KEY, YAMPI_ALIAS).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const responder = (b: Record<string, unknown>) => new Response(JSON.stringify(b), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
const env = (...n: string[]) => n.map((x) => Deno.env.get(x)).find((v) => v && v.trim()) || "";
const BASE = (env("YAMPI_BASE_URL") || "https://api.dooki.com.br/v2") + "/" + (env("YAMPI_ALIAS") || "fourlab");
const CAMINHO = env("YAMPI_CUPONS_PATH") || "/pricing/promocodes";   // dá pra trocar por secret sem mexer no código

async function yampi(metodo: string, caminho: string, corpo?: unknown) {
  const token = env("YAMPI_USER_TOKEN", "YAMPI_TOKEN", "YAMPI_API_TOKEN"), segredo = env("YAMPI_USER_SECRET_KEY", "YAMPI_SECRET_KEY", "YAMPI_SECRET");
  if (!token || !segredo) throw new Error("Faltam as credenciais da Yampi nos secrets das Edge Functions.");
  const r = await fetch(BASE + caminho, { method: metodo, headers: { "User-Token": token, "User-Secret-Key": segredo, "Content-Type": "application/json", Accept: "application/json" }, body: corpo ? JSON.stringify(corpo) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const det = d?.errors ? Object.values(d.errors).flat().join(" ") : (d?.message || d?.error || "sem detalhe");
    throw new Error(`Yampi respondeu ${r.status} em ${caminho}: ${det}`);
  }
  return d;
}
// Já existe um cupom com esse código na loja?
async function existe(codigo: string) {
  const d = await yampi("GET", `${CAMINHO}?q=${encodeURIComponent(codigo)}&limit=50`);
  return (d?.data || []).some((c: { code?: string }) => String(c?.code || "").toUpperCase() === codigo);
}
async function criar(codigo: string, pct: number, usos: number | null, descricao: string) {
  const corpo: Record<string, unknown> = { code: codigo, name: descricao, description: descricao, value: pct, type: "p", active: true, auto_apply: false };
  if (usos) { corpo.usages_limit = usos; corpo.max_uses = usos; corpo.uses_per_customer = usos; }
  return await yampi("POST", CAMINHO, corpo);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    // Só a equipe (mesma regra de eh_equipe)
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    let uid = (await admin.auth.getUser(token)).data?.user?.id;
    // deno-lint-ignore no-explicit-any
    const gc = (admin.auth as any).getClaims;
    if (!uid && gc) uid = (await gc.call(admin.auth, token).catch(() => null))?.data?.claims?.sub;
    if (!uid) return responder({ error: "Sua sessão expirou. Saia e entre de novo no painel." });
    const [p, a, cr] = await Promise.all([
      admin.from("profiles").select("role").eq("id", uid).maybeSingle(),
      admin.from("athletes").select("id").eq("auth_user_id", uid).limit(1).maybeSingle(),
      admin.from("creators").select("id").eq("auth_user_id", uid).limit(1).maybeSingle()]);
    if (["atleta", "creator"].includes(p.data?.role) || a.data || cr.data) return responder({ error: "Só a equipe FourLab pode criar cupons." });

    const body = await req.json();
    if (body.diagnostico) { const d = await yampi("GET", `${CAMINHO}?limit=1`); return responder({ ok: true, caminho: CAMINHO, campos: Object.keys(d?.data?.[0] || {}), exemplo: d?.data?.[0] || null }); }

    const limpa = (v: unknown) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const c10 = limpa(body.cupom10), c30 = limpa(body.cupom30), usos = Math.max(1, Math.min(50, Number(body.usos) || 6));
    if (c10.length < 4 || c30.length < 4 || c10.length > 20 || c30.length > 20) return responder({ error: "Os cupons precisam ter de 4 a 20 letras ou números." });
    if (c10 === c30) return responder({ error: "Os dois cupons precisam ter nomes diferentes." });
    const { data: c } = await admin.from("creators").select("id, nome, etapa, cupom_desconto, cupom_pessoal").eq("id", body.creatorId).maybeSingle();
    if (!c) return responder({ error: "Creator não encontrado." });
    if (!["etapa2", "oficial"].includes(c.etapa)) return responder({ error: "Os cupons são liberados a partir da Etapa 02." });

    const criados: string[] = [];
    for (const [cod, pct, lim, desc] of [[c10, 10, null, `Creator ${c.nome} · 10% seguidores`], [c30, 30, usos, `Creator ${c.nome} · 30% uso pessoal`]] as [string, number, number | null, string][]) {
      if (cod === c.cupom_desconto || cod === c.cupom_pessoal) continue;            // já registrado pra este creator
      if (await existe(cod)) return responder({ error: `O cupom ${cod} já existe na Yampi. Escolha outro nome.`, criados });
      await criar(cod, pct, lim, desc); criados.push(cod);
    }
    await admin.from("creators").update({ cupom_desconto: c10, cupom_pessoal: c30, cupom_pessoal_usos: usos, updated_at: new Date().toISOString() }).eq("id", c.id);
    await admin.from("creator_eventos").insert({ creator_id: c.id, tipo: "cupom", texto: `Cupons criados na Yampi: ${c10} (10%) e ${c30} (30%, ${usos} usos).`, autor: "Yampi" });
    return responder({ ok: true, criados, cupom10: c10, cupom30: c30 });
  } catch (err) {
    console.error(err);
    return responder({ error: (err as Error)?.message || String(err) });
  }
});
