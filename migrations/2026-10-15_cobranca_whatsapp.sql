-- Modelos de mensagem de cobrança por WhatsApp (editáveis pela equipe). Idempotente.
create table if not exists public.cobranca_modelos (
  id text primary key,
  titulo text not null default '',
  texto text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.cobranca_modelos enable row level security;
drop policy if exists "equipe gerencia modelos" on public.cobranca_modelos;
create policy "equipe gerencia modelos" on public.cobranca_modelos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
