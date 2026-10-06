-- Programa FourLab Creators · PARTE 5 de 6 — cupom pedido pelo creator e pasta "Creators".
-- Rode as 6 partes na ordem, cada uma numa aba nova do SQL Editor. Pode rodar de novo sem problema.

-- O creator escolhe o nome do cupom de 10% no portal; a equipe confere e cria na Yampi.
create or replace function public.sugerir_meu_cupom(p_cupom text)
returns void language plpgsql security definer set search_path = public as $$
declare v text := upper(regexp_replace(coalesce(p_cupom,''), '[^A-Za-z0-9]', '', 'g'));
begin
  if length(v) < 4 or length(v) > 20 then raise exception 'O cupom precisa ter de 4 a 20 letras ou números.'; end if;
  update public.creators set cupom_desconto_sugerido = v, updated_at = now()
   where auth_user_id = auth.uid() and coalesce(cupom_desconto,'') = '';
  if not found then raise exception 'Seu cupom já foi criado — fale com o time FourLab para trocar.'; end if;
  insert into public.creator_eventos (creator_id, tipo, texto, autor)
  select id, 'cupom', 'Creator sugeriu o cupom ' || v || '.', nome from public.creators where auth_user_id = auth.uid();
end;
$$;
revoke all on function public.sugerir_meu_cupom(text) from public, anon;
grant execute on function public.sugerir_meu_cupom(text) to authenticated;

-- ---------- 5) Pasta "Creators" em Atletas & parceiros (pra quem vira oficial) ----------
do $$
begin
  if to_regclass('public.teams') is not null then
    insert into public.teams (name, color, tipo, position) values ('Creators', '#e3055f', 'equipe', 20)
    on conflict (name) do nothing;
  end if;
end $$;

select 'Parte 5 de 6 ok' as resultado;
