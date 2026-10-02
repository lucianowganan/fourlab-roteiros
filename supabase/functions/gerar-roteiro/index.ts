// Edge Function: gerar-roteiro
// Gera o roteiro de um post com o Claude, usando:
//   - o "Contexto da IA" (tabela ia_contexto, editável na aba Contexto da IA)
//   - TODOS os roteiros marcados 👍 (tipo 'bom') e 👎 (tipo 'ruim', com o motivo) de roteiro_exemplos
//   - a biblioteca de roteiros (roteiro_biblioteca)
//   - os dados do atleta, produto, briefing, trends e tema enviados pela tela Mês / Roteiros
//
// Entrada (igual à versão anterior): { athlete, produto, entry, temaGeral, trendsNotes, briefingText, histAnterior }
//   (exemplosBons / exemplosRuins / bibliotecaRefs enviados pela tela são ignorados: tudo é lido do banco)
// Saída: { roteiro }            — ou { error }
// Prévia (não chama a IA, não gasta nada): { preview: true } → { system, contagem, avisos }
//
// Publicar: Supabase → Edge Functions → gerar-roteiro → colar este arquivo → Deploy.
// Precisa do secret ANTHROPIC_API_KEY (Edge Functions → Secrets).

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
// A API do Claude é chamada direto via HTTP (fetch). A biblioteca npm:@anthropic-ai/sdk
// fazia a função falhar ao iniciar no Supabase (erro 546 até no OPTIONS), então não é usada.

const MODELO = Deno.env.get("CLAUDE_MODEL") || "claude-opus-5";   // dá pra trocar pelo secret CLAUDE_MODEL
const API_URL = (Deno.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com") + "/v1/messages";
const TEMPO_LIMITE_MS = 120_000; // o Supabase corta a função por volta de 150s; paramos antes pra dar um erro claro
// Limite de texto de exemplos por grupo (~100 mil tokens cada). Se passar, entram os mais recentes e a prévia avisa.
const LIMITE_CARACTERES_POR_GRUPO = 400_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function responder(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
}

type Exemplo = { roteiro_text: string; team: string | null; produto: string | null; formato: string | null; motivo: string | null; created_at: string; athlete_id: string | null; atleta?: string };
type Contexto = Record<string, string>;

const limpar = (s: unknown) => String(s ?? "").trim();
const bloco = (tag: string, conteudo: string) => (conteudo ? `<${tag}>\n${conteudo}\n</${tag}>` : "");

// Mantém os mais recentes até o limite de caracteres (a lista já vem do mais novo pro mais antigo)
function dentroDoLimite<T extends { roteiro_text: string }>(lista: T[]) {
  const escolhidos: T[] = []; let total = 0;
  for (const item of lista) {
    const tamanho = (item.roteiro_text || "").length;
    if (total + tamanho > LIMITE_CARACTERES_POR_GRUPO) break;
    escolhidos.push(item); total += tamanho;
  }
  return escolhidos;
}

function montarSystem(ctx: Contexto, bons: Exemplo[], ruins: Exemplo[], biblioteca: { titulo: string; roteiro_text: string }[]) {
  const meta = (e: Exemplo) =>
    [e.atleta && `atleta: ${e.atleta}`, e.team && `equipe: ${e.team}`, e.produto && `produto: ${e.produto}`, e.formato && `formato: ${e.formato}`]
      .filter(Boolean).join(" · ");

  const exemplosBons = bons.map((e, i) => `<exemplo_bom n="${i + 1}" ${meta(e) ? `info="${meta(e)}"` : ""}>\n${limpar(e.roteiro_text)}\n</exemplo_bom>`).join("\n\n");
  const exemplosRuins = ruins.map((e, i) =>
    `<exemplo_ruim n="${i + 1}" ${meta(e) ? `info="${meta(e)}"` : ""}>\n${limpar(e.motivo) ? `<por_que_foi_rejeitado>${limpar(e.motivo)}</por_que_foi_rejeitado>\n` : ""}<texto>\n${limpar(e.roteiro_text)}\n</texto>\n</exemplo_ruim>`).join("\n\n");
  const refs = biblioteca.map((r, i) => `<referencia n="${i + 1}" titulo="${limpar(r.titulo)}">\n${limpar(r.roteiro_text)}\n</referencia>`).join("\n\n");

  return [
    "Você escreve roteiros de vídeos e carrosséis curtos para atletas embaixadores da FourLab publicarem nas próprias redes sociais. O roteiro vai ser falado pelo atleta, então precisa soar como ele falando — natural, específico e fácil de gravar.",
    bloco("sobre_a_marca", limpar(ctx.sobre_marca)),
    bloco("publico_e_objetivo", limpar(ctx.publico)),
    bloco("tom_de_voz", limpar(ctx.tom_voz)),
    bloco("palavras_chave", limpar(ctx.palavras_chave)),
    bloco("frases_e_ganchos_que_funcionam", limpar(ctx.frases_usar)),
    bloco("evitar", limpar(ctx.evitar)),
    bloco("regras_extras", limpar(ctx.regras_extras)),
    exemplosBons && `Abaixo estão roteiros que a equipe aprovou (👍). Eles mostram o nível de qualidade, o tom e o jeito de falar que funcionam. Use como referência de estilo — não copie frases inteiras.\n${bloco("exemplos_aprovados", exemplosBons)}`,
    exemplosRuins && `Abaixo estão roteiros que a equipe rejeitou (👎), com o motivo quando existe. Entenda o que deu errado em cada um e não repita esses problemas.\n${bloco("exemplos_rejeitados", exemplosRuins)}`,
    refs && `Roteiros de referência escritos pela equipe (biblioteca):\n${bloco("biblioteca", refs)}`,
    bloco("formato_da_resposta", limpar(ctx.estrutura) || "Responda em markdown com: # Gancho, # Roteiro (falas curtas em lista), # Chamada final e # Legenda sugerida."),
    "Responda apenas com o roteiro no formato pedido, sem comentários antes ou depois.",
  ].filter(Boolean).join("\n\n");
}

function montarPedido(body: Record<string, any>) {
  const a = body.athlete || {}, p = body.produto || {}, e = body.entry || {}, h = body.histAnterior;
  const semProduto = p.name === "__SEM_PRODUTO__";
  const linhas = (pares: [string, unknown][]) => pares.filter(([, v]) => limpar(v)).map(([k, v]) => `${k}: ${limpar(v)}`).join("\n");
  return [
    "Escreva o roteiro deste post.",
    bloco("atleta", linhas([
      ["Nome", a.name], ["Equipe", a.team], ["Formato preferido", a.formatPref],
      ["Estilo de fala", a.estiloFala], ["Estilo de vídeo que costuma produzir", a.estiloVideo],
      ["Trava na frente da câmera", a.dificuldadeGravacao === "sim" ? "sim — use falas bem curtas e simples de decorar" : a.dificuldadeGravacao === "nao" ? "não, é solto" : ""],
      ["Cupom de desconto", a.cupomYampi], ["Observações da equipe", a.notes],
    ])),
    limpar(a.videosTranscritos) && bloco("como_o_atleta_fala_transcricoes_de_videos", limpar(a.videosTranscritos)),
    bloco("post", linhas([
      ["Data", e.date], ["Formato", e.format],
      ["Produto", semProduto ? "nenhum — tema livre, sem citar produto" : p.name],
      ["Sobre o produto", semProduto ? "" : p.desc],
      ["Tema / ângulo específico", e.theme],
    ])),
    h && limpar(h.product) && `No post anterior deste atleta o produto foi ${limpar(h.product)} — traga um ângulo diferente.`,
    bloco("tema_geral_do_mes", limpar(body.temaGeral)),
    bloco("briefing_da_campanha", limpar(body.briefingText)),
    bloco("trends_do_mes", limpar(body.trendsNotes)),
  ].filter(Boolean).join("\n\n");
}

// deno-lint-ignore no-explicit-any
type Json = any;
function textoDe(msg: Json): string {
  return (msg?.content || []).filter((b: Json) => b.type === "text").map((b: Json) => b.text || "").join("\n").trim();
}

// Chama POST /v1/messages. comFallback: tenta primeiro com o fallback automático em caso de recusa
// (beta server-side-fallback); se a conta não aceitar esse recurso, repete sem ele.
async function chamarClaude(apiKey: string, params: Json, comFallback: boolean): Promise<{ dados?: Json; erro?: string }> {
  const tentar = async (fallback: boolean) => {
    const headers: Record<string, string> = { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" };
    const corpo = { ...params };
    if (fallback) { headers["anthropic-beta"] = "server-side-fallback-2026-07-01"; corpo.fallbacks = "default"; }
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
    try {
      const resp = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(corpo), signal: ctrl.signal });
      const dados = await resp.json().catch(() => ({}));
      return { status: resp.status, dados };
    } finally { clearTimeout(timer); }
  };
  let r;
  try {
    r = await tentar(comFallback);
    const msg = String(r.dados?.error?.message || "");
    if (comFallback && r.status === 400 && /fallback|beta/i.test(msg)) r = await tentar(false);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return { erro: "A IA demorou demais pra responder. Tente de novo (ou gere um roteiro por vez)." };
    return { erro: `Não consegui falar com a API do Claude: ${(e as Error)?.message || e}` };
  }
  if (r.status >= 200 && r.status < 300) return { dados: r.dados };
  const tipo = String(r.dados?.error?.type || ""), msg = String(r.dados?.error?.message || "");
  console.error("API Claude", r.status, tipo, msg);
  if (r.status === 401 || tipo === "authentication_error") return { erro: "Chave da API do Claude inválida — confira o secret ANTHROPIC_API_KEY no Supabase." };
  if (r.status === 403 || tipo === "permission_error") return { erro: `A chave da API não tem permissão pra usar o modelo ${params.model}.` };
  if (r.status === 404 || tipo === "not_found_error") return { erro: `Modelo ${params.model} não encontrado pra esta conta. Dá pra trocar criando o secret CLAUDE_MODEL no Supabase.` };
  if (/credit balance|billing/i.test(msg)) return { erro: "A conta da API do Claude está sem créditos. Adicione créditos no console da Anthropic (Billing)." };
  if (r.status === 429 || tipo === "rate_limit_error") return { erro: "Muitas gerações ao mesmo tempo — espere um minuto e tente de novo." };
  if (r.status === 529 || tipo === "overloaded_error") return { erro: "A IA está sobrecarregada agora. Tente de novo em alguns instantes." };
  return { erro: `Erro da API do Claude (${r.status}): ${msg || "sem detalhe"}` };
}

// Descobre quem está chamando a partir do login enviado pelo painel (Authorization: Bearer <token>).
// Se não der, devolve o motivo real pra aparecer na tela (em vez de um "sessão expirada" genérico).
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

    // Só a equipe (não atletas) pode gerar roteiros
    const quem = await identificar(req, admin);
    if ("erro" in quem) return responder({ error: quem.erro });
    if (!(await ehEquipe(admin, quem.id))) return responder({ error: "Só a equipe FourLab pode gerar roteiros." });

    const body = await req.json().catch(() => ({}));

    // Tudo o que a IA precisa saber, lido do banco (mais novos primeiro)
    const campos = "roteiro_text, team, produto, formato, motivo, created_at, athlete_id";
    const [ctxRes, bonsRes, ruinsRes, bibRes, atletasRes] = await Promise.all([
      admin.from("ia_contexto").select("*").eq("id", 1).maybeSingle(),
      admin.from("roteiro_exemplos").select(campos).eq("tipo", "bom").order("created_at", { ascending: false }),
      admin.from("roteiro_exemplos").select(campos).eq("tipo", "ruim").order("created_at", { ascending: false }),
      admin.from("roteiro_biblioteca").select("titulo, roteiro_text").order("created_at", { ascending: false }),
      admin.from("athletes").select("id, name"),
    ]);
    const avisos: string[] = [];
    if (ctxRes.error || !ctxRes.data) avisos.push("Contexto da IA não encontrado — rode migrations/2026-09-27_contexto_ia.sql no Supabase.");
    for (const [nome, r] of [["exemplos 👍", bonsRes], ["exemplos 👎", ruinsRes], ["biblioteca", bibRes]] as const) {
      if (r.error) avisos.push(`Não consegui ler ${nome}: ${r.error.message}`);
    }
    const nomeAtleta = new Map((atletasRes.data || []).map((a: { id: string; name: string }) => [a.id, a.name]));
    const comNome = (lista: Exemplo[]) => lista.filter((e) => limpar(e.roteiro_text)).map((e) => ({ ...e, atleta: e.athlete_id ? nomeAtleta.get(e.athlete_id) : undefined }));
    const todosBons = comNome((bonsRes.data || []) as Exemplo[]);
    const todosRuins = comNome((ruinsRes.data || []) as Exemplo[]);
    const todaBiblioteca = (bibRes.data || []).filter((r: { roteiro_text: string }) => limpar(r.roteiro_text));
    const bons = dentroDoLimite(todosBons), ruins = dentroDoLimite(todosRuins), biblioteca = dentroDoLimite(todaBiblioteca);
    if (bons.length < todosBons.length) avisos.push(`Só os ${bons.length} exemplos 👍 mais recentes couberam (de ${todosBons.length}).`);
    if (ruins.length < todosRuins.length) avisos.push(`Só os ${ruins.length} exemplos 👎 mais recentes couberam (de ${todosRuins.length}).`);
    if (biblioteca.length < todaBiblioteca.length) avisos.push(`Só ${biblioteca.length} roteiros da biblioteca couberam (de ${todaBiblioteca.length}).`);

    const system = montarSystem((ctxRes.data || {}) as Contexto, bons, ruins, biblioteca);
    const contagem = { bons: bons.length, ruins: ruins.length, biblioteca: biblioteca.length, caracteres: system.length };

    if (body.preview) return responder({ system, contagem, avisos, modelo: MODELO });

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return responder({ error: "Falta o secret ANTHROPIC_API_KEY nas Edge Functions do Supabase." });

    // Modo teste (botão "Testar IA" na aba Contexto da IA): chamada mínima, custo quase zero
    if (body.teste) {
      const r = await chamarClaude(apiKey, { model: MODELO, max_tokens: 20, messages: [{ role: "user", content: "Responda só: OK" }] }, false);
      if (r.erro) return responder({ error: r.erro });
      return responder({ ok: true, modelo: r.dados.model, resposta: textoDe(r.dados) });
    }

    // O system (contexto + exemplos) é igual pra todos os posts do mês → fica em cache e sai mais barato
    // a partir do 2º roteiro. O pedido específico (atleta/post) vai na mensagem do usuário.
    const params = {
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" }, // médio: bom pra roteiros curtos e mais rápido (evita o tempo limite)
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: montarPedido(body) }],
    };
    const r = await chamarClaude(apiKey, params, true);
    if (r.erro) return responder({ error: r.erro });
    const resposta = r.dados;

    if (resposta.stop_reason === "refusal") return responder({ error: "A IA recusou gerar este roteiro. Tente ajustar o tema ou o briefing." });
    const roteiro = textoDe(resposta);
    if (!roteiro) return responder({ error: "A IA não devolveu texto." });
    if (resposta.stop_reason === "max_tokens") avisos.push("O roteiro foi cortado por tamanho.");

    return responder({ roteiro, avisos, uso: resposta.usage });
  } catch (err) {
    console.error(err);
    return responder({ error: `Erro inesperado: ${(err as Error)?.message || err}` });
  }
});
