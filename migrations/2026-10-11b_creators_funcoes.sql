-- ============================================================
-- Programa FourLab Creators · PARTE 2 de 3 — formulário público (/lpcreators), cupom pedido pelo creator e pasta "Creators".
-- Rodar no SQL Editor do Supabase, na ordem (a, b, c). É idempotente (pode rodar de novo).
-- Dica: no GitHub, abra o arquivo e use o botão "Raw" (ou "Copy raw file") pra copiar inteiro.
-- Antes: 2026-10-11a_creators_tabelas.sql. Depois: 2026-10-11c_creators_mensagens.sql.
-- ============================================================

-- ---------- 4) Formulário público (/lpcreators) ----------
-- Quem preenche não tem login: por isso uma função (e não um INSERT liberado na tabela).
-- Ela valida, limita o tamanho dos campos e evita inscrição repetida.
create or replace function public.inscrever_creator(dados jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_nome text := left(trim(coalesce(dados->>'nome','')), 160);
  v_cpf text := left(regexp_replace(coalesce(dados->>'cpf',''), '\D', '', 'g'), 11);
  v_email text := left(lower(trim(coalesce(dados->>'email',''))), 160);
  v_whats text := left(regexp_replace(coalesce(dados->>'whatsapp',''), '\D', '', 'g'), 15);
  v_esportes text[];
  v_id uuid;
begin
  if coalesce((dados->>'consentimento')::boolean, false) is not true then raise exception 'Aceite os termos para enviar.'; end if;
  if length(v_nome) < 5 or position(' ' in v_nome) = 0 then raise exception 'Informe o nome completo.'; end if;
  if length(v_cpf) <> 11 then raise exception 'CPF inválido.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if length(v_whats) < 10 then raise exception 'Telefone/WhatsApp inválido.'; end if;
  select coalesce(array_agg(left(e, 30)), '{}') into v_esportes
    from jsonb_array_elements_text(coalesce(dados->'esportes','[]'::jsonb)) as e
    where e in ('mtb','ciclismo','corrida','trail','outro');
  if coalesce(array_length(v_esportes, 1), 0) = 0 then raise exception 'Escolha pelo menos um esporte.'; end if;
  if coalesce(dados->>'instagram','') = '' and coalesce(dados->>'tiktok','') = '' and coalesce(dados->>'youtube','') = '' then
    raise exception 'Informe pelo menos uma rede social.';
  end if;
  -- trava simples contra robô: no máximo 40 inscrições em 10 minutos no total
  if (select count(*) from public.creators where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Muitas inscrições agora. Tente de novo em alguns minutos.';
  end if;
  -- inscrição em andamento com o mesmo CPF ou e-mail
  if exists (select 1 from public.creators
             where (cpf = v_cpf or lower(email) = v_email) and etapa not in ('recusado','encerrado')) then
    return 'duplicado';
  end if;

  insert into public.creators (nome, cpf, email, whatsapp, endereco_cep, endereco_rua, endereco_numero, endereco_complemento,
    endereco_bairro, endereco_cidade, endereco_estado, instagram, tiktok, youtube, outras_redes, esportes, esporte_outro,
    consentimento_em, position)
  values (v_nome, v_cpf, v_email, v_whats,
    left(regexp_replace(coalesce(dados->>'endereco_cep',''), '\D', '', 'g'), 8),
    left(coalesce(dados->>'endereco_rua',''), 200), left(coalesce(dados->>'endereco_numero',''), 20),
    left(coalesce(dados->>'endereco_complemento',''), 120), left(coalesce(dados->>'endereco_bairro',''), 120),
    left(coalesce(dados->>'endereco_cidade',''), 120), left(upper(coalesce(dados->>'endereco_estado','')), 2),
    left(trim(coalesce(dados->>'instagram','')), 120), left(trim(coalesce(dados->>'tiktok','')), 120),
    left(trim(coalesce(dados->>'youtube','')), 160), left(trim(coalesce(dados->>'outras_redes','')), 300),
    v_esportes, case when 'outro' = any(v_esportes) then left(trim(coalesce(dados->>'esporte_outro','')), 80) else '' end,
    now(), (extract(epoch from now()))::integer)
  returning id into v_id;

  insert into public.creator_eventos (creator_id, tipo, texto, autor)
  values (v_id, 'etapa', 'Inscrição recebida pelo formulário (/lpcreators).', 'Formulário');
  return 'ok';
end;
$$;
revoke all on function public.inscrever_creator(jsonb) from public;
grant execute on function public.inscrever_creator(jsonb) to anon, authenticated;

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

