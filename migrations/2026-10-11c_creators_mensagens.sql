-- ============================================================
-- Programa FourLab Creators · PARTE 3 de 3 — mensagens padrão, datas de exemplo no calendário e conferência.
-- Rodar no SQL Editor do Supabase, na ordem (a, b, c). É idempotente (pode rodar de novo).
-- Dica: no GitHub, abra o arquivo e use o botão "Raw" (ou "Copy raw file") pra copiar inteiro.
-- Antes: 2026-10-11a e 2026-10-11b. Depois publique a Edge Function "criar-acesso-creator".
-- ============================================================

-- ---------- 6) Mensagens padrão (a equipe edita depois no app) ----------
insert into public.creator_mensagens (id, titulo, assunto, corpo, ordem) values
('aprovado_etapa1', 'Aprovado · Etapa 01 (30 dias)', 'Você foi aprovado no FourLab Creators! 🧡',
'Oi, {primeiro_nome}! Tudo bem? 🧡

Recebemos seu formulário e ficamos muito felizes em confirmar sua entrada na *Etapa 01 do programa FourLab Creators*!

A partir de agora começa o seu primeiro desafio: *Experimente: 30 dias*.

📘 Seu guia da etapa: {link_guia}

🔐 Seu acesso à Plataforma Creators:
{link_portal}
Usuário: {usuario}
Senha: {senha}

Lá você acompanha suas entregas da semana, o envio do seu kit e o calendário de conteúdo.

Nos próximos dias enviamos seu kit (Display Energy Gel + Caixa Na.K+ Hidratação). Qualquer dúvida, é só responder por aqui.

Bons treinos!
Equipe de Marketing FourLab', 10),
('recusado', 'Inscrição não aprovada', 'Sua inscrição no FourLab Creators',
'Oi, {primeiro_nome}! Tudo bem?

Muito obrigado pelo interesse em fazer parte do *FourLab Creators* e pelo tempo dedicado ao formulário. 🧡

Avaliamos seu perfil com carinho e, neste momento, ele não se encaixa no que buscamos para o programa. Isso não é um "não" pra sempre: seguimos acompanhando e novas turmas podem abrir.

Continue com a gente nas redes: @fourlabnutri

Bons treinos!
Equipe de Marketing FourLab', 20),
('kit_enviado', 'Kit enviado (com rastreio)', 'Seu kit FourLab está a caminho! 📦',
'Oi, {primeiro_nome}! 📦

Seu kit FourLab Creators saiu pra entrega!

Itens: {itens_envio}
Código de rastreio: {rastreio}

Você também acompanha o envio na Plataforma Creators: {link_portal}

Quando chegar, já pode começar a criar. Bons treinos!
Equipe de Marketing FourLab', 30),
('lembrete_semana', 'Lembrete das entregas da semana', 'Suas entregas da semana · FourLab Creators',
'Oi, {primeiro_nome}! Passando pra lembrar das suas entregas mínimas desta semana no FourLab Creators:

{metas_etapa}

Lembre de usar #creatorFourLab e #FourLabNutri e de identificar a parceria. Qualquer dúvida, chama a gente!

Equipe de Marketing FourLab', 40),
('aprovado_etapa2', 'Aprovado · Etapa 02 (60 dias)', 'Parabéns! Você avançou para a Etapa 02 🚀',
'Parabéns, {primeiro_nome}! 🚀

Você concluiu a *Etapa 01* e avançou para a *Etapa 02 · Evolução (60 dias)* do FourLab Creators.

O foco agora é *conteúdo + comunidade + resultado*.

📘 Seu guia da etapa: {link_guia}

Nesta fase você recebe: Display Energy Gel, Energy Gel Refil 500g, Squeeze FourLab Go, 2 Caixas Na.K+, cupom de 30% para uso pessoal e cupom de 10% para seus seguidores com comissão nas vendas.

👉 Entre na Plataforma Creators e escolha o nome do seu cupom de 10%: {link_portal}

Bons treinos!
Equipe de Marketing FourLab', 50),
('cupons_criados', 'Cupons criados (etapa 02)', 'Seus cupons FourLab estão ativos 🎟️',
'Oi, {primeiro_nome}! 🎟️

Seus cupons já estão ativos no site fourlabnutri.com.br:

• *{cupom_desconto}* · 10% OFF para seus seguidores (você ganha {comissao_pct}% de comissão nas vendas, paga ao final da etapa)
• *{cupom_pessoal}* · 30% OFF para seu uso pessoal ({cupom_pessoal_usos} usos)

Lembrete: não publique preços, condições ou comissões sem confirmar com o time.

Equipe de Marketing FourLab', 60),
('nao_avancou', 'Não avançou de etapa', 'Resultado da sua etapa no FourLab Creators',
'Oi, {primeiro_nome}! Tudo bem?

Obrigado por ter participado do FourLab Creators e por todo o conteúdo que você criou com a gente. 🧡

Depois da avaliação do período, decidimos não seguir para a próxima etapa neste momento. Seguimos acompanhando seu trabalho e torcendo por você nos treinos e provas!

Equipe de Marketing FourLab', 70),
('creator_oficial', 'Virou Creator Oficial', 'Você agora é um Creator Oficial FourLab! ⚡',
'{primeiro_nome}, você se tornou um *Creator Oficial FourLab*! ⚡

Depois desses 90 dias, a parceria passa a ser recorrente: campanhas mensais, metas de conteúdo e vendas, bonificações por performance, lançamentos antecipados e recompensas exclusivas.

Em breve você recebe as próximas orientações e seu novo acesso.

Bem-vindo ao time!
Equipe de Marketing FourLab', 80)
on conflict (id) do nothing;

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
