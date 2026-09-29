-- ============================================================
-- Pagamentos de comissão (saldo acumulado até R$ 100).
-- A equipe registra cada pagamento na aba Vendas → "Comissões e pagamentos";
-- o valor é descontado do saldo e o mês aparece como "Pago" no extrato do atleta.
-- Rodar uma vez no SQL Editor do Supabase. É idempotente.
-- (Usa as funções eh_equipe() e meu_cadastro_id() da migração 2026-09-28_blog_avisos.sql.)
-- ============================================================
create table if not exists public.comissao_pagamentos (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  valor numeric(10,2) not null check (valor > 0),
  pago_em date not null default current_date,
  ym text not null,                 -- mês do pagamento (AAAA-MM)
  obs text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists comissao_pagamentos_athlete_idx on public.comissao_pagamentos(athlete_id, pago_em);

alter table public.comissao_pagamentos enable row level security;
drop policy if exists "equipe gerencia pagamentos" on public.comissao_pagamentos;
create policy "equipe gerencia pagamentos" on public.comissao_pagamentos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "atleta ve os proprios pagamentos" on public.comissao_pagamentos;
create policy "atleta ve os proprios pagamentos" on public.comissao_pagamentos for select to authenticated
  using (athlete_id = public.meu_cadastro_id());
