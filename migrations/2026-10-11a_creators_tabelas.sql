-- ============================================================
-- Programa FourLab Creators · PARTE 1 de 3 — tabelas e permissões (CRM separado dos atletas).
-- Rodar no SQL Editor do Supabase, na ordem (a, b, c). É idempotente (pode rodar de novo).
-- Dica: no GitHub, abra o arquivo e use o botão "Raw" (ou "Copy raw file") pra copiar inteiro.
-- Depois rode 2026-10-11b_creators_funcoes.sql e 2026-10-11c_creators_mensagens.sql.
-- ============================================================

-- ---------- 1) Inscrições / creators ----------
-- Tudo que o creator NÃO pode ver (anotações da equipe) fica em creator_eventos, nunca aqui:
-- o creator logado lê a própria linha desta tabela.
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  nome text not null default '',
  cpf text not null default '',
  email text not null default '',
  whatsapp text not null default '',
  endereco_cep text not null default '',
  endereco_rua text not null default '',
  endereco_numero text not null default '',
  endereco_complemento text not null default '',
  endereco_bairro text not null default '',
  endereco_cidade text not null default '',
  endereco_estado text not null default '',
  instagram text not null default '',
  tiktok text not null default '',
  youtube text not null default '',
  outras_redes text not null default '',
  esportes text[] not null default '{}',          -- mtb, ciclismo, corrida, trail, outro
  esporte_outro text not null default '',
  consentimento_em timestamptz,
  origem text not null default 'formulario',
  -- funil: contato → etapa1 (30 dias) → etapa2 (60 dias) → oficial · ou recusado / encerrado
  etapa text not null default 'contato' check (etapa in ('contato','etapa1','etapa2','oficial','recusado','encerrado')),
  etapa_inicio date,
  position integer not null default 0,
  -- login do portal /creators
  auth_user_id uuid unique,
  username text unique,
  -- cupons (etapa 2): 10% pros seguidores com comissão + 30% de uso pessoal
  cupom_desconto text not null default '',
  cupom_desconto_sugerido text not null default '',   -- nome que o creator pediu no portal
  cupom_pessoal text not null default '',
  cupom_pessoal_usos integer not null default 6,
  comissao_pct numeric not null default 10,
  rebate_valor numeric,
  rebate_pago_em date,
  -- quando vira Creator Oficial, ganha um cadastro na pasta "Creators" de Atletas & parceiros
  athlete_id uuid references public.athletes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creators_etapa_idx on public.creators(etapa, position);

-- Histórico do creator: mudanças de etapa, mensagens enviadas, envios, anotações. Só a equipe vê.
create table if not exists public.creator_eventos (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  tipo text not null default 'nota',              -- nota, etapa, mensagem, envio, acesso, cupom
  texto text not null default '',
  autor text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists creator_eventos_idx on public.creator_eventos(creator_id, created_at desc);

-- Kits enviados (Na.K+, gel...), com código de rastreio. O creator acompanha no portal.
create table if not exists public.creator_envios (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  etapa text not null default 'etapa1',
  itens text not null default '',
  status text not null default 'preparando' check (status in ('preparando','enviado','entregue')),
  transportadora text not null default '',
  rastreio text not null default '',
  enviado_em date,
  entregue_em date,
  created_at timestamptz not null default now()
);
create index if not exists creator_envios_idx on public.creator_envios(creator_id);

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

-- ---------- 3) Permissões ----------
alter table public.creators enable row level security;
alter table public.creator_eventos enable row level security;
alter table public.creator_envios enable row level security;
alter table public.creator_semanas enable row level security;
alter table public.creator_mensagens enable row level security;
alter table public.creator_calendario enable row level security;

drop policy if exists "equipe gerencia creators" on public.creators;
create policy "equipe gerencia creators" on public.creators for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creator le o proprio cadastro" on public.creators;
create policy "creator le o proprio cadastro" on public.creators for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "equipe gerencia eventos creators" on public.creator_eventos;
create policy "equipe gerencia eventos creators" on public.creator_eventos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists "equipe gerencia envios creators" on public.creator_envios;
create policy "equipe gerencia envios creators" on public.creator_envios for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creator ve os proprios envios" on public.creator_envios;
create policy "creator ve os proprios envios" on public.creator_envios for select to authenticated
  using (creator_id = public.meu_creator_id());

drop policy if exists "equipe gerencia semanas creators" on public.creator_semanas;
create policy "equipe gerencia semanas creators" on public.creator_semanas for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creator ve as proprias semanas" on public.creator_semanas;
create policy "creator ve as proprias semanas" on public.creator_semanas for select to authenticated
  using (creator_id = public.meu_creator_id());

drop policy if exists "equipe gerencia mensagens creators" on public.creator_mensagens;
create policy "equipe gerencia mensagens creators" on public.creator_mensagens for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists "equipe gerencia calendario creators" on public.creator_calendario;
create policy "equipe gerencia calendario creators" on public.creator_calendario for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creators leem calendario" on public.creator_calendario;
create policy "creators leem calendario" on public.creator_calendario for select to authenticated
  using (public.meu_creator_id() is not null);

