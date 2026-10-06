-- ============================================================
-- Posts manuais: roteiros, stories etc. adicionados à mão pela equipe (fora do calendário automático).
-- Eles não são mexidos quando o calendário do mês é gerado ou atualizado.
-- Rodar no SQL Editor do Supabase. É idempotente.
-- ============================================================

alter table public.entries add column if not exists manual boolean not null default false;
