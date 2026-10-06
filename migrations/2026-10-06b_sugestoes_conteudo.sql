-- ============================================================
-- PARTE 2 de 2 — Sugestões de conteúdo (reels, stories, carrosséis...),
-- quem gravou cada uma e a pasta de imagens no Storage.
-- Rodar no SQL Editor do Supabase. É idempotente (pode rodar de novo).
-- ============================================================

create table if not exists public.sugestoes_conteudo (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  tipo text not null default 'reels'
    check (tipo in ('reels','stories','carrossel','post','tiktok','outro')),
  objetivo text not null default '',            -- resumo: a ideia e por que funciona
  roteiro text not null default '',             -- texto livre (falas, legenda, CTA...)
  passos jsonb not null default '[]'::jsonb,    -- [{texto, dica, imagem}] = telas dos stories / cenas / slides
  referencias text not null default '',         -- links de inspiração, um por linha
  capa_url text not null default '',
  produto text not null default '',
  dificuldade text not null default 'facil'
    check (dificuldade in ('facil','medio','avancado')),
  publico text not null default 'todos'
    check (publico in ('todos','atletas','profissionais')),
  pontos integer not null default 0,            -- pra gamificação futura
  publicada boolean not null default false,     -- rascunho até publicar
  fixada boolean not null default false,
  autor text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sugestoes_conteudo enable row level security;
drop policy if exists "equipe gerencia sugestoes" on public.sugestoes_conteudo;
create policy "equipe gerencia sugestoes" on public.sugestoes_conteudo for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "atletas e parceiros leem sugestoes" on public.sugestoes_conteudo;
create policy "atletas e parceiros leem sugestoes" on public.sugestoes_conteudo for select to authenticated
  using (
    publicada and public.meu_cadastro_id() is not null and (
      publico = 'todos'
      or (publico = 'atletas' and public.minha_categoria() = 'equipe')
      or (publico = 'profissionais' and public.minha_categoria() = 'profissional')
    )
  );

-- Quem quer gravar / já gravou cada sugestão (base da gamificação)
create table if not exists public.sugestao_gravacoes (
  id uuid primary key default gen_random_uuid(),
  sugestao_id uuid not null references public.sugestoes_conteudo(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  status text not null default 'quero' check (status in ('quero','gravei')),
  link text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sugestao_id, athlete_id)
);

alter table public.sugestao_gravacoes enable row level security;
drop policy if exists "equipe gerencia gravacoes" on public.sugestao_gravacoes;
create policy "equipe gerencia gravacoes" on public.sugestao_gravacoes for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "atleta le as proprias gravacoes" on public.sugestao_gravacoes;
create policy "atleta le as proprias gravacoes" on public.sugestao_gravacoes for select to authenticated
  using (athlete_id = public.meu_cadastro_id());
drop policy if exists "atleta marca as proprias gravacoes" on public.sugestao_gravacoes;
create policy "atleta marca as proprias gravacoes" on public.sugestao_gravacoes for insert to authenticated
  with check (athlete_id = public.meu_cadastro_id());
drop policy if exists "atleta atualiza as proprias gravacoes" on public.sugestao_gravacoes;
create policy "atleta atualiza as proprias gravacoes" on public.sugestao_gravacoes for update to authenticated
  using (athlete_id = public.meu_cadastro_id()) with check (athlete_id = public.meu_cadastro_id());
drop policy if exists "atleta desmarca as proprias gravacoes" on public.sugestao_gravacoes;
create policy "atleta desmarca as proprias gravacoes" on public.sugestao_gravacoes for delete to authenticated
  using (athlete_id = public.meu_cadastro_id());

-- ---------- 3) Imagens das sugestões (Storage) ----------
-- Pasta pública "sugestoes": qualquer um com o link vê a imagem; só a equipe envia/apaga.
insert into storage.buckets (id, name, public)
values ('sugestoes', 'sugestoes', true)
on conflict (id) do update set public = true;

drop policy if exists "equipe envia imagens de sugestoes" on storage.objects;
create policy "equipe envia imagens de sugestoes" on storage.objects for insert to authenticated
  with check (bucket_id = 'sugestoes' and public.eh_equipe());
drop policy if exists "equipe altera imagens de sugestoes" on storage.objects;
create policy "equipe altera imagens de sugestoes" on storage.objects for update to authenticated
  using (bucket_id = 'sugestoes' and public.eh_equipe());
drop policy if exists "equipe apaga imagens de sugestoes" on storage.objects;
create policy "equipe apaga imagens de sugestoes" on storage.objects for delete to authenticated
  using (bucket_id = 'sugestoes' and public.eh_equipe());
