-- ============================================================
-- Comprovantes de pagamento (comissão, fee, outros) com arquivo anexo.
--   - A equipe anexa; o atleta/parceiro vê só os dele, no Meu Perfil.
--   - Os arquivos ficam na pasta PRIVADA "comprovantes" do Storage, separados por cadastro:
--     comprovantes/<athlete_id>/arquivo.pdf — e só abrem com link temporário.
-- Rodar no SQL Editor do Supabase. É idempotente.
-- ============================================================

create table if not exists public.comprovantes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  data date not null default current_date,         -- dia do pagamento
  valor numeric(12,2) not null default 0,
  descricao text not null default '',               -- ex.: "Fee de outubro + rebate de setembro"
  tipo text not null default 'outro' check (tipo in ('comissao','fee','outro')),
  arquivo_path text not null default '',            -- caminho no Storage (bucket comprovantes)
  arquivo_nome text not null default '',
  autor text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists comprovantes_atleta_data on public.comprovantes (athlete_id, data desc);

alter table public.comprovantes enable row level security;
drop policy if exists "equipe gerencia comprovantes" on public.comprovantes;
create policy "equipe gerencia comprovantes" on public.comprovantes for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "pessoa ve os proprios comprovantes" on public.comprovantes;
create policy "pessoa ve os proprios comprovantes" on public.comprovantes for select to authenticated
  using (athlete_id = public.meu_cadastro_id());

-- Pasta privada (sem link público)
insert into storage.buckets (id, name, public) values ('comprovantes', 'comprovantes', false)
on conflict (id) do update set public = false;

drop policy if exists "equipe gerencia arquivos de comprovantes" on storage.objects;
create policy "equipe gerencia arquivos de comprovantes" on storage.objects for all to authenticated
  using (bucket_id = 'comprovantes' and public.eh_equipe())
  with check (bucket_id = 'comprovantes' and public.eh_equipe());
drop policy if exists "pessoa le os proprios arquivos de comprovantes" on storage.objects;
create policy "pessoa le os proprios arquivos de comprovantes" on storage.objects for select to authenticated
  using (bucket_id = 'comprovantes' and (storage.foldername(name))[1] = public.meu_cadastro_id()::text);
