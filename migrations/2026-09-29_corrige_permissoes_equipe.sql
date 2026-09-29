-- ============================================================
-- Correção de permissões da equipe.
--
-- Problema: as regras antigas liberavam a equipe com `profiles.role <> 'atleta'`.
-- Se o usuário da equipe tem o role vazio (NULL) — ou nem tem linha em profiles —
-- essa comparação não dá "verdadeiro" e o banco bloqueia o salvamento
-- (ex.: "Erro ao salvar" no Contexto da IA).
--
-- Nova regra: é da equipe quem está logado, NÃO tem role 'atleta'
-- e NÃO está vinculado a um cadastro de atleta/parceiro.
--
-- Rodar uma vez no SQL Editor do Supabase. É idempotente e só recria as
-- regras das tabelas que já existirem.
-- ============================================================

create or replace function public.eh_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'atleta')
     and not exists (select 1 from public.athletes a where a.auth_user_id = auth.uid());
$$;
grant execute on function public.eh_equipe() to authenticated;

-- Recria a regra "equipe pode tudo" em cada tabela nova, usando eh_equipe()
do $$
declare
  alvo record;
begin
  for alvo in
    select * from (values
      ('crm_cards',           'equipe gerencia crm'),
      ('teams',               'equipe gerencia pastas'),
      ('ia_contexto',         'equipe le e edita contexto ia'),
      ('roteiro_exemplos',    'equipe gerencia exemplos'),
      ('blog_textos',         'equipe gerencia blog'),
      ('avisos',              'equipe gerencia avisos'),
      ('comissao_pagamentos', 'equipe gerencia pagamentos')
    ) as t(tabela, politica)
  loop
    if to_regclass('public.' || alvo.tabela) is not null then
      execute format('drop policy if exists %I on public.%I', alvo.politica, alvo.tabela);
      execute format('create policy %I on public.%I for all to authenticated using (public.eh_equipe()) with check (public.eh_equipe())',
                     alvo.politica, alvo.tabela);
    end if;
  end loop;
end $$;

-- Garante a linha do contexto da IA (se a tabela existir e estiver vazia)
do $$
begin
  if to_regclass('public.ia_contexto') is not null then
    insert into public.ia_contexto (id) values (1) on conflict (id) do nothing;
  end if;
end $$;
