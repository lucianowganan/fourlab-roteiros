-- Programa FourLab Creators · PARTE 7 — trava a troca de papel (role) em profiles.
-- Antes: a regra profiles_update_own (sem with_check) deixava qualquer atleta/creator logado
-- mudar o próprio role pra 'chefia' pelo navegador e virar equipe.
-- Agora só a chefia muda papéis. As Edge Functions (chave de serviço) e o SQL Editor continuam podendo.
-- O app nunca grava em profiles pelo navegador, então nada do painel muda. Pode rodar de novo.

create or replace function public.trava_troca_de_papel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() vazio = Edge Function com chave de serviço ou SQL Editor: liberado
  if auth.uid() is null or coalesce(public.is_chefia(auth.uid()), false) then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    raise exception 'Só a chefia pode mudar o papel de um usuário.';
  end if;
  if tg_op = 'INSERT' and new.role in ('chefia', 'geral') then
    raise exception 'Só a chefia pode criar usuários da equipe.';
  end if;
  return new;
end;
$$;

drop trigger if exists trava_troca_de_papel on public.profiles;
create trigger trava_troca_de_papel before insert or update on public.profiles
  for each row execute function public.trava_troca_de_papel();

select 'Parte 7 ok' as resultado;
