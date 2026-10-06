-- ============================================================
-- Programa FourLab Creators · PARTE 3 de 3 — datas de exemplo no calendário e conferência.
-- (As mensagens padrão são cadastradas pelo próprio app ao abrir o Programa Creators.)
-- Rodar no SQL Editor do Supabase, na ordem (a, b, c). É idempotente (pode rodar de novo).
-- Dica: no GitHub, abra o arquivo e use o botão "Raw" (ou "Copy raw file") pra copiar inteiro.
-- Antes: 2026-10-11a e 2026-10-11b. Depois publique a Edge Function "criar-acesso-creator".
-- ============================================================

-- ---------- 7) Algumas datas de exemplo no calendário (a equipe edita/apaga no app) ----------
insert into public.creator_calendario (data, data_fim, titulo, descricao, tipo)
select * from (values
  (date '2026-11-01', date '2026-11-30', 'Black November', 'Mês inteiro de ofertas. Conteúdos mostrando o kit de treino/prova e lembrando do cupom.', 'campanha'),
  (date '2026-11-27', null::date, 'Black Friday', 'Pico de vendas: stories com o cupom ao longo do dia.', 'data'),
  (date '2026-12-25', null::date, 'Natal', 'Presente pra quem pedala/corre: ideias de kit FourLab.', 'data'),
  (date '2026-12-31', null::date, 'Virada / metas 2027', 'Metas de treino e provas pro ano novo e como a nutrição entra no plano.', 'data')
) as v(data, data_fim, titulo, descricao, tipo)
where not exists (select 1 from public.creator_calendario);

-- ---------- 8) Conferência ----------
-- Lista as regras das tabelas principais do app. Se alguma usar "role <> 'atleta'" (em vez de eh_equipe()),
-- me mande o resultado: o creator logado precisa ficar de fora delas também.
select tablename, policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename in ('athletes','entries','cycles','profiles','products','yampi_vendas','vendas_mensais')
order by tablename, policyname;
