-- ============================================================
-- Pastas (equipes/especialidades) com cor, comissão e profissionais parceiros.
-- Rodar uma vez no SQL Editor do Supabase. É idempotente.
-- ============================================================

-- 1) Pastas: equipes de atletas e especialidades de profissionais parceiros
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#666666',
  tipo text not null default 'equipe' check (tipo in ('equipe','profissional')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

insert into public.teams (name, color, tipo, position) values
  ('Trek','#1d4ed8','equipe',0), ('Audax','#b5680a','equipe',1), ('Oggi','#0f7a3d','equipe',2),
  ('Brou','#e3055f','equipe',3), ('Scott','#731b58','equipe',4), ('4Fun','#c99a00','equipe',5),
  ('Avulsos','#666666','equipe',6),
  ('Nutricionistas','#0e7490','profissional',10), ('Médicos','#7c3aed','profissional',11)
on conflict (name) do nothing;

-- qualquer equipe que já exista nos atletas mas não na tabela vira pasta
insert into public.teams (name, tipo, position)
select distinct a.team, 'equipe', 50 from public.athletes a
where coalesce(a.team,'') <> '' and not exists (select 1 from public.teams t where t.name = a.team);

alter table public.teams enable row level security;
drop policy if exists "todos logados leem pastas" on public.teams;
create policy "todos logados leem pastas" on public.teams for select to authenticated using (true);
drop policy if exists "equipe gerencia pastas" on public.teams;
create policy "equipe gerencia pastas" on public.teams for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'atleta'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'atleta'));

-- 2) Comissão (libera a área de Vendas pro atleta) e profissão dos parceiros
alter table public.athletes
  add column if not exists recebe_comissao boolean not null default false,
  add column if not exists profissao text not null default '';

-- Antes, todo mundo com cupom via Vendas. Pra ninguém perder acesso de repente,
-- marca como "recebe comissão" quem já tinha cupom — depois é só desmarcar na ficha quem não recebe.
-- (Só roda na primeira vez: depois que alguém for marcado, não mexe mais.)
update public.athletes set recebe_comissao = true
where coalesce(cupom_yampi,'') <> ''
  and not exists (select 1 from public.athletes where recebe_comissao);

-- 3) PIX no perfil agora depende de "recebe comissão" (e não só de ter cupom)
create or replace function public.atualizar_meu_perfil(dados jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.athletes set
    email                = coalesce(dados->>'email', email),
    whatsapp             = coalesce(dados->>'whatsapp', whatsapp),
    instagram            = coalesce(dados->>'instagram', instagram),
    facebook             = coalesce(dados->>'facebook', facebook),
    tiktok               = coalesce(dados->>'tiktok', tiktok),
    youtube              = coalesce(dados->>'youtube', youtube),
    pix_key              = case when recebe_comissao then coalesce(dados->>'pix_key', pix_key) else pix_key end,
    endereco_cep         = coalesce(dados->>'endereco_cep', endereco_cep),
    endereco_rua         = coalesce(dados->>'endereco_rua', endereco_rua),
    endereco_numero      = coalesce(dados->>'endereco_numero', endereco_numero),
    endereco_complemento = coalesce(dados->>'endereco_complemento', endereco_complemento),
    endereco_bairro      = coalesce(dados->>'endereco_bairro', endereco_bairro),
    endereco_cidade      = coalesce(dados->>'endereco_cidade', endereco_cidade),
    endereco_estado      = coalesce(dados->>'endereco_estado', endereco_estado)
  where auth_user_id = auth.uid();
  if not found then
    raise exception 'Nenhum cadastro vinculado a este login';
  end if;
end;
$$;
revoke all on function public.atualizar_meu_perfil(jsonb) from public, anon;
grant execute on function public.atualizar_meu_perfil(jsonb) to authenticated;
