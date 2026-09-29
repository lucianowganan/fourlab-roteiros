-- ============================================================
-- Blog dos profissionais parceiros + Avisos.
-- Rodar uma vez no SQL Editor do Supabase. É idempotente.
-- ============================================================

-- Quem é da equipe FourLab (qualquer perfil que não seja atleta/parceiro)
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is not null and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'atleta') and not exists (select 1 from public.athletes a where a.auth_user_id = auth.uid()));
$$;

-- Cadastro (atleta ou profissional) ligado ao login atual
create or replace function public.meu_cadastro_id()
returns uuid language sql stable security definer set search_path = public as $$
  select a.id from public.athletes a where a.auth_user_id = auth.uid() limit 1;
$$;

-- 'equipe' (atleta) ou 'profissional' (parceiro), pela pasta do cadastro
create or replace function public.minha_categoria()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select t.tipo from public.athletes a join public.teams t on t.name = a.team
                   where a.auth_user_id = auth.uid() limit 1), 'equipe');
$$;

grant execute on function public.eh_equipe(), public.meu_cadastro_id(), public.minha_categoria() to authenticated;

-- ---------- 1) Pautas e textos do blog ----------
create table if not exists public.blog_textos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  ym text not null,                               -- mês da pauta (AAAA-MM)
  tema_mes text not null default '',              -- tema geral do mês (o mesmo dos atletas)
  tema_especifico text not null default '',       -- se preenchido, substitui o tema do mês pra esta pessoa
  orientacoes text not null default '',
  prazo date,
  titulo text not null default '',
  texto text not null default '',
  status text not null default 'pendente'         -- pendente, rascunho, enviado, ajustes, aprovado, publicado
    check (status in ('pendente','rascunho','enviado','ajustes','aprovado','publicado')),
  feedback text not null default '',
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, ym)
);

alter table public.blog_textos enable row level security;
drop policy if exists "equipe gerencia blog" on public.blog_textos;
create policy "equipe gerencia blog" on public.blog_textos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "parceiro le as proprias pautas" on public.blog_textos;
create policy "parceiro le as proprias pautas" on public.blog_textos for select to authenticated
  using (athlete_id = public.meu_cadastro_id());

-- O parceiro só altera título/texto e o status (rascunho ou enviado) das PRÓPRIAS pautas,
-- e só enquanto a pauta não foi aprovada/publicada.
create or replace function public.salvar_meu_texto_blog(p_id uuid, p_titulo text, p_texto text, p_enviar boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.blog_textos set
    titulo = coalesce(p_titulo, ''),
    texto = coalesce(p_texto, ''),
    status = case when p_enviar then 'enviado' else 'rascunho' end,
    enviado_em = case when p_enviar then now() else enviado_em end,
    updated_at = now()
  where id = p_id
    and athlete_id = public.meu_cadastro_id()
    and status in ('pendente','rascunho','ajustes','enviado');
  if not found then
    raise exception 'Este texto não pode mais ser alterado (já aprovado) ou não é seu.';
  end if;
end;
$$;
revoke all on function public.salvar_meu_texto_blog(uuid, text, text, boolean) from public, anon;
grant execute on function public.salvar_meu_texto_blog(uuid, text, text, boolean) to authenticated;

-- ---------- 2) Avisos ----------
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  mensagem text not null default '',
  publico text not null default 'equipe'          -- equipe (só administração), todos, atletas, profissionais
    check (publico in ('equipe','todos','atletas','profissionais')),
  fixado boolean not null default false,
  autor text not null default '',
  created_at timestamptz not null default now()
);

alter table public.avisos enable row level security;
drop policy if exists "equipe gerencia avisos" on public.avisos;
create policy "equipe gerencia avisos" on public.avisos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "atletas e parceiros leem avisos" on public.avisos;
create policy "atletas e parceiros leem avisos" on public.avisos for select to authenticated
  using (
    public.meu_cadastro_id() is not null and (
      publico = 'todos'
      or (publico = 'atletas' and public.minha_categoria() = 'equipe')
      or (publico = 'profissionais' and public.minha_categoria() = 'profissional')
    )
  );
