-- ============================================================
-- Fee mensal (valor fixo por mês) + rebate (a comissão do cupom) de atletas, parceiros e influenciadores.
--   - atleta_cadastro: fee_ativo, fee_valor, fee_dia (dia do pagamento), fee_obs
--   - fee_pagamentos: um registro por pessoa e mês pago (fee + rebate)
-- Só a equipe lê e edita. Rodar no SQL Editor do Supabase. É idempotente.
-- Depende de 2026-10-06a_cadastro_interno.sql (atleta_cadastro).
-- ============================================================

alter table public.atleta_cadastro add column if not exists fee_ativo boolean not null default false;
alter table public.atleta_cadastro add column if not exists fee_valor numeric(12,2) not null default 0;
alter table public.atleta_cadastro add column if not exists fee_dia integer not null default 5;
alter table public.atleta_cadastro add column if not exists fee_obs text not null default '';

create table if not exists public.fee_pagamentos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  ym text not null,                                   -- mês do fee (AAAA-MM)
  valor_fee numeric(12,2) not null default 0,
  valor_rebate numeric(12,2) not null default 0,      -- comissão do mês anterior paga junto
  pago_em date not null default current_date,
  obs text not null default '',
  autor text not null default '',
  created_at timestamptz not null default now(),
  unique (athlete_id, ym)
);

alter table public.fee_pagamentos enable row level security;
drop policy if exists "equipe gerencia fees" on public.fee_pagamentos;
create policy "equipe gerencia fees" on public.fee_pagamentos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
