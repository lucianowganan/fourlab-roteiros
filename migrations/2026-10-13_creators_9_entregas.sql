-- Programa FourLab Creators · PARTE 9 — o creator registra os conteúdos que postou (com link),
-- inclusive entregas extras, e confirma o recebimento do kit. Pode rodar de novo.

create table if not exists public.creator_entregas (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  etapa text not null,
  semana integer not null default 1,
  meta text not null default 'extra',             -- chave da meta (video, stories, tiktok, instagram) ou 'extra'
  link text not null check (length(link) between 8 and 500),
  descricao text not null default '' check (length(descricao) <= 500),
  status text not null default 'enviado' check (status in ('enviado','aprovado','recusado')),
  obs_equipe text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists creator_entregas_idx on public.creator_entregas(creator_id, etapa, semana);

alter table public.creator_entregas enable row level security;
drop policy if exists "equipe gerencia entregas creators" on public.creator_entregas;
create policy "equipe gerencia entregas creators" on public.creator_entregas for all to authenticated
  using (public.eh_equipe()) with check (public.eh_equipe());
drop policy if exists "creator ve as proprias entregas" on public.creator_entregas;
create policy "creator ve as proprias entregas" on public.creator_entregas for select to authenticated
  using (creator_id = public.meu_creator_id());
drop policy if exists "creator registra entregas" on public.creator_entregas;
create policy "creator registra entregas" on public.creator_entregas for insert to authenticated
  with check (creator_id = public.meu_creator_id() and status = 'enviado' and obs_equipe = '');
drop policy if exists "creator apaga entrega pendente" on public.creator_entregas;
create policy "creator apaga entrega pendente" on public.creator_entregas for delete to authenticated
  using (creator_id = public.meu_creator_id() and status = 'enviado');

-- O creator confirma que o kit chegou (só envios dele que estão "enviado")
create or replace function public.confirmar_recebimento_kit(p_envio uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.creator_envios set status = 'entregue', entregue_em = current_date
   where id = p_envio and creator_id = public.meu_creator_id() and status = 'enviado';
  if not found then raise exception 'Envio não encontrado ou já confirmado.'; end if;
  insert into public.creator_eventos (creator_id, tipo, texto, autor)
  select c.id, 'envio', 'Creator confirmou o recebimento do kit.', c.nome
    from public.creators c where c.id = public.meu_creator_id();
end;
$$;
revoke all on function public.confirmar_recebimento_kit(uuid) from public, anon;
grant execute on function public.confirmar_recebimento_kit(uuid) to authenticated;

select 'Parte 9 ok' as resultado;
