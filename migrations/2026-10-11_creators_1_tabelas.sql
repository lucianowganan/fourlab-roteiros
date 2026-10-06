-- Programa FourLab Creators · PARTE 1 de 6 — tabelas de inscrições, histórico e envios.
-- Rode as 6 partes na ordem, cada uma numa aba nova do SQL Editor. Pode rodar de novo sem problema.

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

select 'Parte 1 de 6 ok' as resultado;
