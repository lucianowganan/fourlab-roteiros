-- Programa FourLab Creators · PARTE 4 de 6 — função do formulário público (/lpcreators).
-- Rode as 6 partes na ordem, cada uma numa aba nova do SQL Editor. Pode rodar de novo sem problema.

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

select 'Parte 4 de 6 ok' as resultado;
