// Edge Function: criar-acesso-atleta
// Cria (ou redefine a senha de) o login de um atleta / profissional parceiro.
// Chamada pela página atletas.html → "Liberar acesso ao painel".
//
// O login usa o formato <usuario>@atletas.fourlabnutri.internal — é o mesmo que o
// login.html monta quando a pessoa digita só o usuário (sem @).
//
// Publicar: Supabase → Edge Functions → Deploy a new function → nome "criar-acesso-atleta"
// → colar este arquivo → Deploy. (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontas.)

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const DOMINIO_LOGIN = "atletas.fourlabnutri.internal";

// Sempre responde 200 com { error } pra mensagem aparecer na tela do app
// (respostas não-2xx viram um erro genérico no supabase-js).
function responder(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) Quem está chamando precisa estar logado e ser da equipe (não atleta)
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: quem, error: erroSessao } = await admin.auth.getUser(token);
    if (erroSessao || !quem?.user) return responder({ error: "Sessão expirada — saia e entre de novo no painel." });
    const { data: perfilQuem } = await admin.from("profiles").select("role").eq("id", quem.user.id).maybeSingle();
    if (!perfilQuem || perfilQuem.role === "atleta") return responder({ error: "Só a equipe FourLab pode criar acessos." });

    // 2) Validação dos dados
    const { athleteId, athleteName, username: usuarioDigitado, password } = await req.json();
    const username = String(usuarioDigitado || "").trim().toLowerCase().replace(/\s+/g, "");
    const senha = String(password || "");
    if (!athleteId || !username || !senha) return responder({ error: "Preencha usuário e senha." });
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      return responder({ error: "Usuário: só letras sem acento, números, ponto, hífen ou _ (mínimo 3)." });
    }
    if (senha.length < 6) return responder({ error: "A senha precisa ter pelo menos 6 caracteres." });

    const { data: atleta, error: erroAtleta } = await admin.from("athletes").select("id, name, auth_user_id").eq("id", athleteId).maybeSingle();
    if (erroAtleta || !atleta) return responder({ error: "Cadastro não encontrado." });

    const { data: repetido } = await admin.from("athletes").select("id").eq("username", username).neq("id", athleteId).maybeSingle();
    if (repetido) return responder({ error: "Esse usuário já está em uso — escolha outro." });

    const email = `${username}@${DOMINIO_LOGIN}`;
    const nome = String(athleteName || atleta.name || "");

    // 3) Cria o login ou, se já existir, atualiza usuário/senha
    let authId: string | null = atleta.auth_user_id;
    if (authId) {
      const { error } = await admin.auth.admin.updateUserById(authId, { email, password: senha, email_confirm: true });
      if (error) return responder({ error: `Não deu pra redefinir: ${error.message}` });
    } else {
      const { data: criado, error } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome },
      });
      if (error) {
        const emUso = /already|registered|exists/i.test(error.message);
        return responder({ error: emUso ? "Esse usuário já está em uso — escolha outro." : `Não deu pra criar: ${error.message}` });
      }
      authId = criado.user.id;
    }

    // 4) Perfil com papel "atleta" (é o que manda a pessoa pro portal do atleta) + vínculo no cadastro
    const { error: erroPerfil } = await admin.from("profiles").upsert({ id: authId, nome, role: "atleta" });
    if (erroPerfil) return responder({ error: `Login criado, mas falhou ao salvar o perfil: ${erroPerfil.message}` });
    const { error: erroVinculo } = await admin.from("athletes").update({ auth_user_id: authId, username }).eq("id", athleteId);
    if (erroVinculo) return responder({ error: `Login criado, mas falhou ao vincular ao cadastro: ${erroVinculo.message}` });

    return responder({ ok: true, username });
  } catch (err) {
    console.error(err);
    return responder({ error: `Erro inesperado: ${(err as Error)?.message || err}` });
  }
});
