-- ============================================================
-- Compras dos atletas na Yampi (cupom de compras: primeiro nome + 6 primeiros dígitos do CPF).
--   - atleta_cadastro.cupom_compras: o cupom que a pessoa usa pra comprar (nem todos têm)
--   - atleta_compras: últimos produtos pedidos, salvos pela função yampi-compras-atleta
-- Só a equipe lê e edita. Rodar no SQL Editor do Supabase. É idempotente.
-- Depende de 2026-10-06a_cadastro_interno.sql (tabela atleta_cadastro).
-- ============================================================

alter table public.atleta_cadastro add column if not exists cupom_compras text not null default '';

create table if not exists public.atleta_compras (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  cupom text not null default '',
  itens jsonb not null default '[]'::jsonb,     -- [{nome, quantidade, pedidos, ultima_compra}] mais pedidos primeiro
  total_pedidos integer not null default 0,
  ultima_compra date,
  erro text not null default '',                -- última falha ao buscar na Yampi (vazio = ok)
  atualizado_em timestamptz not null default now()
);

alter table public.atleta_compras enable row level security;
drop policy if exists "equipe le compras" on public.atleta_compras;
create policy "equipe le compras" on public.atleta_compras for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
