-- Programa FourLab Creators · PARTE 2 de 6 — tabelas de semanas, mensagens e calendário + quem é equipe/creator.
-- Rode as 6 partes na ordem, cada uma numa aba nova do SQL Editor. Pode rodar de novo sem problema.

-- Entregas mínimas, semana a semana (a equipe marca à mão). feito guarda quanto foi postado de cada meta.
create table if not exists public.creator_semanas (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  etapa text not null,
  semana integer not null,
  feito jsonb not null default '{}'::jsonb,
  obs text not null default '',
  updated_at timestamptz not null default now(),
  unique (creator_id, etapa, semana)
);

-- Modelos de mensagem (WhatsApp / e-mail) com variáveis como primeiro_nome e usuario.
create table if not exists public.creator_mensagens (
  id text primary key,
  titulo text not null default '',
  assunto text not null default '',
  corpo text not null default '',
  ordem integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Calendário de datas pra guiar o conteúdo dos creators (ex.: Black November)
create table if not exists public.creator_calendario (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  data_fim date,
  titulo text not null default '',
  descricao text not null default '',
  tipo text not null default 'data' check (tipo in ('data','campanha','prova')),
  created_at timestamptz not null default now()
);
create index if not exists creator_calendario_idx on public.creator_calendario(data);

-- ---------- 2) Quem é equipe, quem é creator ----------
-- Se profiles.role tiver uma regra de valores permitidos (ex.: chefia/geral/atleta), inclui 'creator'.
do $$
declare r record; v_def text;
begin
  for r in select con.conname, pg_get_constraintdef(con.oid) as def
           from pg_constraint con
           where con.conrelid = 'public.profiles'::regclass and con.contype = 'c'
             and pg_get_constraintdef(con.oid) ilike '%atleta%'
             and pg_get_constraintdef(con.oid) not ilike '%creator%'
  loop
    v_def := replace(r.def, '''atleta''::text', '''atleta''::text, ''creator''::text');
    if v_def = r.def then v_def := replace(r.def, '''atleta''', '''atleta'', ''creator'''); end if;
    execute format('alter table public.profiles drop constraint %I', r.conname);
    execute format('alter table public.profiles add constraint %I %s', r.conname, v_def);
  end loop;
end $$;

-- Creator logado NÃO é equipe: sem isto ele enxergaria tudo que a equipe vê.
create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('atleta','creator'))
     and not exists (select 1 from public.athletes a where a.auth_user_id = auth.uid())
     and not exists (select 1 from public.creators c where c.auth_user_id = auth.uid());
$$;
grant execute on function public.eh_equipe() to authenticated;

create or replace function public.meu_creator_id()
returns uuid language sql stable security definer set search_path = public as $$
  select c.id from public.creators c where c.auth_user_id = auth.uid() limit 1;
$$;
grant execute on function public.meu_creator_id() to authenticated;

select 'Parte 2 de 6 ok' as resultado;
