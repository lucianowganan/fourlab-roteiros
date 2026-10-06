-- ============================================================
-- PARTE 1 de 2 — Cadastro interno dos atletas e parceiros (CPF, nascimento...)
-- Rodar no SQL Editor do Supabase. É idempotente (pode rodar de novo).
-- Depois rode a parte 2: 2026-10-06b_sugestoes_conteudo.sql
-- ============================================================

-- Fica numa tabela separada de `athletes` de propósito: só a equipe FourLab lê e edita.
-- O atleta/parceiro NÃO vê estes dados no portal dele.
create table if not exists public.atleta_cadastro (
  athlete_id uuid primary key references public.athletes(id) on delete cascade,
  nome_completo text not null default '',
  cpf text not null default '',
  rg text not null default '',
  cnpj text not null default '',
  data_nascimento date,
  tamanho_camiseta text not null default '',
  inicio_parceria date,
  fim_contrato date,
  observacoes text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.atleta_cadastro enable row level security;
drop policy if exists "equipe gerencia cadastro" on public.atleta_cadastro;
create policy "equipe gerencia cadastro" on public.atleta_cadastro for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

