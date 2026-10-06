-- Programa FourLab Creators · PARTE 8 — creators passam a ver as Sugestões de conteúdo.
-- Na tela Sugestões da equipe, "Quem vê" ganha a opção "Só creators".
-- Creators veem as publicadas para "Todos" e "Só creators". Pode rodar de novo.

alter table public.sugestoes_conteudo drop constraint if exists sugestoes_conteudo_publico_check;
alter table public.sugestoes_conteudo add constraint sugestoes_conteudo_publico_check
  check (publico in ('todos','atletas','profissionais','creators'));

drop policy if exists "creators leem sugestoes" on public.sugestoes_conteudo;
create policy "creators leem sugestoes" on public.sugestoes_conteudo for select to authenticated
  using (publicada and public.meu_creator_id() is not null and publico in ('todos','creators'));

select 'Parte 8 ok' as resultado;
