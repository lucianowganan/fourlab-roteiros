-- ============================================================
-- O atleta/parceiro completa os próprios dados cadastrais no Meu Perfil
-- (nome completo, CPF, RG, CNPJ, nascimento, camiseta).
-- Ele NÃO vê nem altera o resto do cadastro interno (fee, contrato, observações, cupom de compras).
-- Rodar no SQL Editor do Supabase. É idempotente.
-- ============================================================

create or replace function public.meus_dados_cadastrais()
returns table (nome_completo text, cpf text, rg text, cnpj text, data_nascimento date, tamanho_camiseta text)
language sql stable security definer set search_path = public as $$
  select c.nome_completo, c.cpf, c.rg, c.cnpj, c.data_nascimento, c.tamanho_camiseta
    from public.atleta_cadastro c where c.athlete_id = public.meu_cadastro_id();
$$;

create or replace function public.salvar_meus_dados_cadastrais(dados jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid := public.meu_cadastro_id();
begin
  if v_id is null then raise exception 'Cadastro não encontrado.'; end if;
  insert into public.atleta_cadastro (athlete_id) values (v_id) on conflict (athlete_id) do nothing;
  update public.atleta_cadastro set
    nome_completo    = left(coalesce(dados->>'nome_completo', nome_completo), 200),
    cpf              = left(regexp_replace(coalesce(dados->>'cpf', cpf), '\D', '', 'g'), 11),
    rg               = left(coalesce(dados->>'rg', rg), 30),
    cnpj             = left(regexp_replace(coalesce(dados->>'cnpj', cnpj), '\D', '', 'g'), 14),
    data_nascimento  = case when dados ? 'data_nascimento' then nullif(dados->>'data_nascimento', '')::date else data_nascimento end,
    tamanho_camiseta = left(coalesce(dados->>'tamanho_camiseta', tamanho_camiseta), 5),
    updated_at       = now()
  where athlete_id = v_id;
end;
$$;

revoke all on function public.meus_dados_cadastrais() from public, anon;
revoke all on function public.salvar_meus_dados_cadastrais(jsonb) from public, anon;
grant execute on function public.meus_dados_cadastrais() to authenticated;
grant execute on function public.salvar_meus_dados_cadastrais(jsonb) to authenticated;
