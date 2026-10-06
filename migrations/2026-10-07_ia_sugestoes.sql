-- ============================================================
-- IA de sugestões de conteúdo (função gerar-sugestao):
--   1) quem pode usar a IA e quantas ideias por mês (ia_acesso)
--   2) registro de cada pedido feito à IA, com tokens e avaliação (ia_pedidos)
--   3) exemplos 👍/👎 que ensinam a IA (sugestao_exemplos)
--   4) regras específicas das sugestões no Contexto da IA
-- Rodar no SQL Editor do Supabase. É idempotente (pode rodar de novo).
-- Depende de eh_equipe() e meu_cadastro_id() (migrações de 28 e 29/09).
-- ============================================================

-- 1) Acesso à IA por atleta/parceiro. Só a equipe libera; a pessoa só lê o próprio.
create table if not exists public.ia_acesso (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  liberada boolean not null default false,
  limite_mes integer not null default 10 check (limite_mes >= 0),
  updated_at timestamptz not null default now()
);
alter table public.ia_acesso enable row level security;
drop policy if exists "equipe gerencia acesso ia" on public.ia_acesso;
create policy "equipe gerencia acesso ia" on public.ia_acesso for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "pessoa le o proprio acesso ia" on public.ia_acesso;
create policy "pessoa le o proprio acesso ia" on public.ia_acesso for select to authenticated
  using (athlete_id = public.meu_cadastro_id());

-- 2) Pedidos feitos à IA. Quem grava é a função (chave de serviço); ninguém insere pelo app.
create table if not exists public.ia_pedidos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid references public.athletes(id) on delete cascade,   -- vazio = pedido da equipe
  autor text not null default '',
  tipo text not null default '',
  produto text not null default '',
  pedido text not null default '',
  resultado jsonb,
  status text not null default 'ok' check (status in ('ok','recusado','erro')),
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  avaliacao text check (avaliacao in ('bom','ruim')),
  motivo text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists ia_pedidos_atleta_data on public.ia_pedidos (athlete_id, created_at desc);
alter table public.ia_pedidos enable row level security;
drop policy if exists "equipe gerencia pedidos ia" on public.ia_pedidos;
create policy "equipe gerencia pedidos ia" on public.ia_pedidos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "pessoa le os proprios pedidos ia" on public.ia_pedidos;
create policy "pessoa le os proprios pedidos ia" on public.ia_pedidos for select to authenticated
  using (athlete_id is not null and athlete_id = public.meu_cadastro_id());

-- A pessoa só pode dar 👍/👎 (e o motivo) nas ideias que ela mesma pediu
create or replace function public.avaliar_minha_ideia_ia(p_id uuid, p_avaliacao text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_avaliacao is not null and p_avaliacao not in ('bom','ruim') then
    raise exception 'Avaliação inválida.';
  end if;
  update public.ia_pedidos
     set avaliacao = p_avaliacao, motivo = left(coalesce(p_motivo, ''), 500)
   where id = p_id and athlete_id is not null and athlete_id = public.meu_cadastro_id();
  if not found then raise exception 'Ideia não encontrada.'; end if;
end;
$$;
revoke all on function public.avaliar_minha_ideia_ia(uuid, text, text) from public, anon;
grant execute on function public.avaliar_minha_ideia_ia(uuid, text, text) to authenticated;

-- 3) Exemplos que a IA lê antes de criar (além das sugestões publicadas, que contam como 👍)
create table if not exists public.sugestao_exemplos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('bom','ruim')),
  conteudo jsonb not null,               -- {titulo, tipo, objetivo, passos, roteiro}
  motivo text not null default '',
  origem text not null default 'equipe', -- equipe | atleta
  athlete_id uuid references public.athletes(id) on delete set null,
  pedido_id uuid references public.ia_pedidos(id) on delete set null,
  autor text not null default '',
  created_at timestamptz not null default now()
);
alter table public.sugestao_exemplos enable row level security;
drop policy if exists "equipe gerencia exemplos de sugestoes" on public.sugestao_exemplos;
create policy "equipe gerencia exemplos de sugestoes" on public.sugestao_exemplos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

-- 4) Regras das sugestões (editável em Contexto da IA)
alter table public.ia_contexto add column if not exists regras_sugestoes text not null default '';
