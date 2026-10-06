// Edge Function "criar-acesso-creator": cria/redefine o login do creator (Programa Creators).
// Login = <usuario>@creators.fourlabnutri.internal, perfil com role "creator" (só entra no /creators).
// Versão compacta de propósito (o editor do Supabase cortava arquivos longos na colagem).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
// Sempre 200 com { error } pra mensagem aparecer na tela do app
const responder = (b: Record<string, unknown>) =>
  new Response(JSON.stringify(b), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } });

    // 1) Quem chama: logado e da equipe (sem papel atleta/creator e sem cadastro ligado ao login)
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token.startsWith("ey")) return responder({ error: "Login não chegou. Saia e entre de novo no painel." });
    let uid = (await admin.auth.getUser(token)).data?.user?.id;
    // deno-lint-ignore no-explicit-any
    const getClaims = (admin.auth as any).getClaims;
    if (!uid && getClaims) uid = (await getClaims.call(admin.auth, token).catch(() => null))?.data?.claims?.sub;
    if (!uid) return responder({ error: "Sua sessão expirou. Saia e entre de novo no painel." });
    const [perfil, atleta, euCreator] = await Promise.all([
      admin.from("profiles").select("role").eq("id", uid).maybeSingle(),
      admin.from("athletes").select("id").eq("auth_user_id", uid).limit(1).maybeSingle(),
      admin.from("creators").select("id").eq("auth_user_id", uid).limit(1).maybeSingle(),
    ]);
    if (["atleta", "creator"].includes(perfil.data?.role) || atleta.data || euCreator.data) {
      return responder({ error: "Só a equipe FourLab pode criar acessos." });
    }

    // 2) Dados
    const { creatorId, username: u, password } = await req.json();
    const username = String(u || "").trim().toLowerCase().replace(/\s+/g, "");
    const senha = String(password || "");
    if (!creatorId || !username || !senha) return responder({ error: "Preencha usuário e senha." });
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) return responder({ error: "Usuário: só letras sem acento, números, ponto, hífen ou _ (mínimo 3)." });
    if (senha.length < 6) return responder({ error: "A senha precisa ter pelo menos 6 caracteres." });
    const { data: c } = await admin.from("creators").select("id, nome, auth_user_id").eq("id", creatorId).maybeSingle();
    if (!c) return responder({ error: "Creator não encontrado." });
    const { data: rep } = await admin.from("creators").select("id").eq("username", username).neq("id", creatorId).maybeSingle();
    if (rep) return responder({ error: "Esse usuário já está em uso — escolha outro." });

    // 3) Cria o login ou atualiza usuário/senha
    const email = `${username}@creators.fourlabnutri.internal`;
    let authId: string | null = c.auth_user_id;
    if (authId) {
      const { error } = await admin.auth.admin.updateUserById(authId, { email, password: senha, email_confirm: true });
      if (error) return responder({ error: `Não deu pra redefinir: ${error.message}` });
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome: c.nome } });
      if (error) return responder({ error: /already|registered|exists/i.test(error.message) ? "Esse usuário já está em uso — escolha outro." : `Não deu pra criar: ${error.message}` });
      authId = data.user.id;
    }

    // 4) Perfil "creator" + vínculo no cadastro
    const p = await admin.from("profiles").upsert({ id: authId, nome: c.nome, role: "creator" });
    if (p.error) return responder({ error: `Login criado, mas falhou o perfil: ${p.error.message}` });
    const v = await admin.from("creators").update({ auth_user_id: authId, username, updated_at: new Date().toISOString() }).eq("id", creatorId);
    if (v.error) return responder({ error: `Login criado, mas falhou o vínculo: ${v.error.message}` });
    return responder({ ok: true, username });
  } catch (err) {
    console.error(err);
    return responder({ error: `Erro inesperado: ${(err as Error)?.message || err}` });
  }
});
