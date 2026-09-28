-- ============================================================
-- "Mostrar volume de vendas": quem NÃO recebe comissão pode ver
-- só as quantidades de pedidos do cupom (sem valores em R$).
-- Rodar uma vez no SQL Editor do Supabase. É idempotente.
-- ============================================================
alter table public.athletes
  add column if not exists ver_vendas boolean not null default false;
