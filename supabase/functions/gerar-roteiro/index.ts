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

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODELO = "claude-opus-5";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Só a equipe (não atletas) pode gerar roteiros
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quem } = await admin.auth.getUser(token);
    if (!quem?.user) return responder({ error: "Sessão expirada — saia e entre de novo no painel." });
    const { data: perfil } = await admin.from("profiles").select("role").eq("id", quem.user.id).maybeSingle();
    if (!perfil || perfil.role === "atleta") return responder({ error: "Só a equipe FourLab pode gerar roteiros." });

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

    if (!Deno.env.get("ANTHROPIC_API_KEY")) return responder({ error: "Falta o secret ANTHROPIC_API_KEY nas Edge Functions do Supabase." });
    const client = new Anthropic();

    // O system (contexto + exemplos) é igual pra todos os posts do mês → fica em cache e sai mais barato
    // a partir do 2º roteiro. O pedido específico (atleta/post) vai na mensagem do usuário.
    const params = {
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // se o modelo recusar por política, o próprio servidor tenta o modelo recomendado
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: montarPedido(body) }],
    };
    // deno-lint-ignore no-explicit-any
    const resposta = await client.beta.messages.create(params as any);

    if (resposta.stop_reason === "refusal") return responder({ error: "A IA recusou gerar este roteiro. Tente ajustar o tema ou o briefing." });
    const roteiro = resposta.content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { type: string; text?: string }) => b.text || "")
      .join("\n").trim();
    if (!roteiro) return responder({ error: "A IA não devolveu texto." });
    if (resposta.stop_reason === "max_tokens") avisos.push("O roteiro foi cortado por tamanho.");

    return responder({ roteiro, avisos, uso: resposta.usage });
  } catch (err) {
    console.error(err);
    if (err instanceof Anthropic.AuthenticationError) return responder({ error: "Chave da API do Claude inválida (secret ANTHROPIC_API_KEY)." });
    if (err instanceof Anthropic.RateLimitError) return responder({ error: "Muitas gerações ao mesmo tempo — espere um pouco e tente de novo." });
    if (err instanceof Anthropic.APIError) return responder({ error: `Erro da API do Claude (${err.status}): ${err.message}` });
    return responder({ error: `Erro inesperado: ${(err as Error)?.message || err}` });
  }
});
