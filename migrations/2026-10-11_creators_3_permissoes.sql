-- Programa FourLab Creators · PARTE 3 de 6 — permissões (o creator só vê os próprios dados).
-- Rode as 6 partes na ordem, cada uma numa aba nova do SQL Editor. Pode rodar de novo sem problema.

-- ---------- 3) Permissões ----------
alter table public.creators enable row level security;
alter table public.creator_eventos enable row level security;
alter table public.creator_envios enable row level security;
alter table public.creator_semanas enable row level security;
alter table public.creator_mensagens enable row level security;
alter table public.creator_calendario enable row level security;

drop policy if exists "equipe gerencia creators" on public.creators;
create policy "equipe gerencia creators" on public.creators for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creator le o proprio cadastro" on public.creators;
create policy "creator le o proprio cadastro" on public.creators for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists "equipe gerencia eventos creators" on public.creator_eventos;
create policy "equipe gerencia eventos creators" on public.creator_eventos for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists "equipe gerencia envios creators" on public.creator_envios;
create policy "equipe gerencia envios creators" on public.creator_envios for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creator ve os proprios envios" on public.creator_envios;
create policy "creator ve os proprios envios" on public.creator_envios for select to authenticated
  using (creator_id = public.meu_creator_id());

drop policy if exists "equipe gerencia semanas creators" on public.creator_semanas;
create policy "equipe gerencia semanas creators" on public.creator_semanas for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creator ve as proprias semanas" on public.creator_semanas;
create policy "creator ve as proprias semanas" on public.creator_semanas for select to authenticated
  using (creator_id = public.meu_creator_id());

drop policy if exists "equipe gerencia mensagens creators" on public.creator_mensagens;
create policy "equipe gerencia mensagens creators" on public.creator_mensagens for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());

drop policy if exists "equipe gerencia calendario creators" on public.creator_calendario;
create policy "equipe gerencia calendario creators" on public.creator_calendario for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creators leem calendario" on public.creator_calendario;
create policy "creators leem calendario" on public.creator_calendario for select to authenticated
  using (public.meu_creator_id() is not null);

select 'Parte 3 de 6 ok' as resultado;
