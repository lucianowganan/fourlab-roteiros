-- ============================================================
-- Programa FourLab Creators — CRM separado dos atletas.
--
-- Landing + formulário público: atleta.fourlabnutrition.com.br/lpcreators
-- Portal do creator (login próprio):  atleta.fourlabnutrition.com.br/creators
-- Área da equipe:                     programa-creators (menu "Programa Creators")
--
-- Rodar no SQL Editor do Supabase. É idempotente (pode rodar de novo).
-- Depois publique a Edge Function "criar-acesso-creator" (supabase/functions/criar-acesso-creator).
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

-- Entregas mínimas, semana a semana (a equipe marca à mão). feito = {"video":1,"stories":3,...}
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

-- Modelos de mensagem (WhatsApp / e-mail) com variáveis {primeiro_nome}, {usuario} etc.
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

-- ---------- 4) Formulário público (/lpcreators) ----------
-- Quem preenche não tem login: por isso uma função (e não um INSERT liberado na tabela).
-- Ela valida, limita o tamanho dos campos e evita inscrição repetida.
create or replace function public.inscrever_creator(dados jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_nome text := left(trim(coalesce(dados->>'nome','')), 160);
  v_cpf text := left(regexp_replace(coalesce(dados->>'cpf',''), '\D', '', 'g'), 11);
  v_email text := left(lower(trim(coalesce(dados->>'email',''))), 160);
  v_whats text := left(regexp_replace(coalesce(dados->>'whatsapp',''), '\D', '', 'g'), 15);
  v_esportes text[];
  v_id uuid;
begin
  if coalesce((dados->>'consentimento')::boolean, false) is not true then raise exception 'Aceite os termos para enviar.'; end if;
  if length(v_nome) < 5 or position(' ' in v_nome) = 0 then raise exception 'Informe o nome completo.'; end if;
  if length(v_cpf) <> 11 then raise exception 'CPF inválido.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if length(v_whats) < 10 then raise exception 'Telefone/WhatsApp inválido.'; end if;
  select coalesce(array_agg(left(e, 30)), '{}') into v_esportes
    from jsonb_array_elements_text(coalesce(dados->'esportes','[]'::jsonb)) as e
    where e in ('mtb','ciclismo','corrida','trail','outro');
  if coalesce(array_length(v_esportes, 1), 0) = 0 then raise exception 'Escolha pelo menos um esporte.'; end if;
  if coalesce(dados->>'instagram','') = '' and coalesce(dados->>'tiktok','') = '' and coalesce(dados->>'youtube','') = '' then
    raise exception 'Informe pelo menos uma rede social.';
  end if;
  -- trava simples contra robô: no máximo 40 inscrições em 10 minutos no total
  if (select count(*) from public.creators where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Muitas inscrições agora. Tente de novo em alguns minutos.';
  end if;
  -- inscrição em andamento com o mesmo CPF ou e-mail
  if exists (select 1 from public.creators
             where (cpf = v_cpf or lower(email) = v_email) and etapa not in ('recusado','encerrado')) then
    return 'duplicado';
  end if;

  insert into public.creators (nome, cpf, email, whatsapp, endereco_cep, endereco_rua, endereco_numero, endereco_complemento,
    endereco_bairro, endereco_cidade, endereco_estado, instagram, tiktok, youtube, outras_redes, esportes, esporte_outro,
    consentimento_em, position)
  values (v_nome, v_cpf, v_email, v_whats,
    left(regexp_replace(coalesce(dados->>'endereco_cep',''), '\D', '', 'g'), 8),
    left(coalesce(dados->>'endereco_rua',''), 200), left(coalesce(dados->>'endereco_numero',''), 20),
    left(coalesce(dados->>'endereco_complemento',''), 120), left(coalesce(dados->>'endereco_bairro',''), 120),
    left(coalesce(dados->>'endereco_cidade',''), 120), left(upper(coalesce(dados->>'endereco_estado','')), 2),
    left(trim(coalesce(dados->>'instagram','')), 120), left(trim(coalesce(dados->>'tiktok','')), 120),
    left(trim(coalesce(dados->>'youtube','')), 160), left(trim(coalesce(dados->>'outras_redes','')), 300),
    v_esportes, case when 'outro' = any(v_esportes) then left(trim(coalesce(dados->>'esporte_outro','')), 80) else '' end,
    now(), (extract(epoch from now()))::integer)
  returning id into v_id;

  insert into public.creator_eventos (creator_id, tipo, texto, autor)
  values (v_id, 'etapa', 'Inscrição recebida pelo formulário (/lpcreators).', 'Formulário');
  return 'ok';
end;
$$;
revoke all on function public.inscrever_creator(jsonb) from public;
grant execute on function public.inscrever_creator(jsonb) to anon, authenticated;

-- O creator escolhe o nome do cupom de 10% no portal; a equipe confere e cria na Yampi.
create or replace function public.sugerir_meu_cupom(p_cupom text)
returns void language plpgsql security definer set search_path = public as $$
declare v text := upper(regexp_replace(coalesce(p_cupom,''), '[^A-Za-z0-9]', '', 'g'));
begin
  if length(v) < 4 or length(v) > 20 then raise exception 'O cupom precisa ter de 4 a 20 letras ou números.'; end if;
  update public.creators set cupom_desconto_sugerido = v, updated_at = now()
   where auth_user_id = auth.uid() and coalesce(cupom_desconto,'') = '';
  if not found then raise exception 'Seu cupom já foi criado — fale com o time FourLab para trocar.'; end if;
  insert into public.creator_eventos (creator_id, tipo, texto, autor)
  select id, 'cupom', 'Creator sugeriu o cupom ' || v || '.', nome from public.creators where auth_user_id = auth.uid();
end;
$$;
revoke all on function public.sugerir_meu_cupom(text) from public, anon;
grant execute on function public.sugerir_meu_cupom(text) to authenticated;

-- ---------- 5) Pasta "Creators" em Atletas & parceiros (pra quem vira oficial) ----------
do $$
begin
  if to_regclass('public.teams') is not null then
    insert into public.teams (name, color, tipo, position) values ('Creators', '#e3055f', 'equipe', 20)
    on conflict (name) do nothing;
  end if;
end $$;

-- ---------- 6) Mensagens padrão (a equipe edita depois no app) ----------
insert into public.creator_mensagens (id, titulo, assunto, corpo, ordem) values
('aprovado_etapa1', 'Aprovado · Etapa 01 (30 dias)', 'Você foi aprovado no FourLab Creators! 🧡',
'Oi, {primeiro_nome}! Tudo bem? 🧡

Recebemos seu formulário e ficamos muito felizes em confirmar sua entrada na *Etapa 01 do programa FourLab Creators*!

A partir de agora começa o seu primeiro desafio: *Experimente: 30 dias*.

📘 Seu guia da etapa: {link_guia}

🔐 Seu acesso à Plataforma Creators:
{link_portal}
Usuário: {usuario}
Senha: {senha}

Lá você acompanha suas entregas da semana, o envio do seu kit e o calendário de conteúdo.

Nos próximos dias enviamos seu kit (Display Energy Gel + Caixa Na.K+ Hidratação). Qualquer dúvida, é só responder por aqui.

Bons treinos!
Equipe de Marketing FourLab', 10),
('recusado', 'Inscrição não aprovada', 'Sua inscrição no FourLab Creators',
'Oi, {primeiro_nome}! Tudo bem?

Muito obrigado pelo interesse em fazer parte do *FourLab Creators* e pelo tempo dedicado ao formulário. 🧡

Avaliamos seu perfil com carinho e, neste momento, ele não se encaixa no que buscamos para o programa. Isso não é um "não" pra sempre: seguimos acompanhando e novas turmas podem abrir.

Continue com a gente nas redes: @fourlabnutri

Bons treinos!
Equipe de Marketing FourLab', 20),
('kit_enviado', 'Kit enviado (com rastreio)', 'Seu kit FourLab está a caminho! 📦',
'Oi, {primeiro_nome}! 📦

Seu kit FourLab Creators saiu pra entrega!

Itens: {itens_envio}
Código de rastreio: {rastreio}

Você também acompanha o envio na Plataforma Creators: {link_portal}

Quando chegar, já pode começar a criar. Bons treinos!
Equipe de Marketing FourLab', 30),
('lembrete_semana', 'Lembrete das entregas da semana', 'Suas entregas da semana · FourLab Creators',
'Oi, {primeiro_nome}! Passando pra lembrar das suas entregas mínimas desta semana no FourLab Creators:

{metas_etapa}

Lembre de usar #creatorFourLab e #FourLabNutri e de identificar a parceria. Qualquer dúvida, chama a gente!

Equipe de Marketing FourLab', 40),
('aprovado_etapa2', 'Aprovado · Etapa 02 (60 dias)', 'Parabéns! Você avançou para a Etapa 02 🚀',
'Parabéns, {primeiro_nome}! 🚀

Você concluiu a *Etapa 01* e avançou para a *Etapa 02 · Evolução (60 dias)* do FourLab Creators.

O foco agora é *conteúdo + comunidade + resultado*.

📘 Seu guia da etapa: {link_guia}

Nesta fase você recebe: Display Energy Gel, Energy Gel Refil 500g, Squeeze FourLab Go, 2 Caixas Na.K+, cupom de 30% para uso pessoal e cupom de 10% para seus seguidores com comissão nas vendas.

👉 Entre na Plataforma Creators e escolha o nome do seu cupom de 10%: {link_portal}

Bons treinos!
Equipe de Marketing FourLab', 50),
('cupons_criados', 'Cupons criados (etapa 02)', 'Seus cupons FourLab estão ativos 🎟️',
'Oi, {primeiro_nome}! 🎟️

Seus cupons já estão ativos no site fourlabnutri.com.br:

• *{cupom_desconto}* · 10% OFF para seus seguidores (você ganha {comissao_pct}% de comissão nas vendas, paga ao final da etapa)
• *{cupom_pessoal}* · 30% OFF para seu uso pessoal ({cupom_pessoal_usos} usos)

Lembrete: não publique preços, condições ou comissões sem confirmar com o time.

Equipe de Marketing FourLab', 60),
('nao_avancou', 'Não avançou de etapa', 'Resultado da sua etapa no FourLab Creators',
'Oi, {primeiro_nome}! Tudo bem?

Obrigado por ter participado do FourLab Creators e por todo o conteúdo que você criou com a gente. 🧡

Depois da avaliação do período, decidimos não seguir para a próxima etapa neste momento. Seguimos acompanhando seu trabalho e torcendo por você nos treinos e provas!

Equipe de Marketing FourLab', 70),
('creator_oficial', 'Virou Creator Oficial', 'Você agora é um Creator Oficial FourLab! ⚡',
'{primeiro_nome}, você se tornou um *Creator Oficial FourLab*! ⚡

Depois desses 90 dias, a parceria passa a ser recorrente: campanhas mensais, metas de conteúdo e vendas, bonificações por performance, lançamentos antecipados e recompensas exclusivas.

Em breve você recebe as próximas orientações e seu novo acesso.

Bem-vindo ao time!
Equipe de Marketing FourLab', 80)
on conflict (id) do nothing;

-- ---------- 7) Algumas datas de exemplo no calendário (a equipe edita/apaga no app) ----------
insert into public.creator_calendario (data, data_fim, titulo, descricao, tipo)
select * from (values
  (date '2026-11-01', date '2026-11-30', 'Black November', 'Mês inteiro de ofertas. Conteúdos mostrando o kit de treino/prova e lembrando do cupom.', 'campanha'),
  (date '2026-11-27', null::date, 'Black Friday', 'Pico de vendas: stories com o cupom ao longo do dia.', 'data'),
  (date '2026-12-25', null::date, 'Natal', 'Presente pra quem pedala/corre: ideias de kit FourLab.', 'data'),
  (date '2026-12-31', null::date, 'Virada / metas 2027', 'Metas de treino e provas pro ano novo e como a nutrição entra no plano.', 'data')
) as v(data, data_fim, titulo, descricao, tipo)
where not exists (select 1 from public.creator_calendario);

-- ---------- 8) Conferência ----------
-- Lista as regras das tabelas principais do app. Se alguma usar "role <> 'atleta'" (em vez de eh_equipe()),
-- me mande o resultado: o creator logado precisa ficar de fora delas também.
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename in ('athletes','entries','cycles','profiles','products','yampi_vendas','vendas_mensais')
order by tablename, policyname;
