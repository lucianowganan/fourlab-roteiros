-- ============================================================
-- Gerador de ganchos (aba em Sugestões de conteúdo).
--   - ia_contexto.regras_ganchos: regras e tipos de gancho
--   - ia_contexto.documento_ganchos: material de referência (texto do documento)
--   - ganchos_exemplos: banco de bons ganchos que a IA lê antes de criar
-- Só a equipe edita. Rodar no SQL Editor do Supabase. É idempotente.
-- ============================================================

alter table public.ia_contexto add column if not exists regras_ganchos text not null default '';
alter table public.ia_contexto add column if not exists documento_ganchos text not null default '';

create table if not exists public.ganchos_exemplos (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  origem text not null default 'equipe',   -- equipe (colado à mão) | ia (gerado e aprovado)
  autor text not null default '',
  created_at timestamptz not null default now()
);
alter table public.ganchos_exemplos enable row level security;
drop policy if exists "equipe gerencia ganchos" on public.ganchos_exemplos;
create policy "equipe gerencia ganchos" on public.ganchos_exemplos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
