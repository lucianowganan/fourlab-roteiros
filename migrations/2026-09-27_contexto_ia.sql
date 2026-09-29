-- ============================================================
-- Contexto da IA de roteiros (editável na aba "Contexto da IA").
-- Rodar uma vez no SQL Editor do Supabase. É idempotente.
-- ============================================================

create table if not exists public.ia_contexto (
  id integer primary key default 1 check (id = 1),   -- uma linha só
  sobre_marca text not null default '',
  publico text not null default '',
  tom_voz text not null default '',
  palavras_chave text not null default '',
  frases_usar text not null default '',
  evitar text not null default '',
  estrutura text not null default '',
  regras_extras text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);

-- Texto inicial (ponto de partida — edite na aba "Contexto da IA")
insert into public.ia_contexto (id, sobre_marca, publico, tom_voz, palavras_chave, frases_usar, evitar, estrutura, regras_extras)
values (1,
$$A FourLab é uma marca brasileira de nutrição esportiva (suplementos como Recovery, Whey e Gel Energy) com forte presença no ciclismo e nos esportes de endurance.
Os roteiros são gravados pelos próprios atletas e embaixadores da marca (equipes de ciclismo e atletas avulsos) e publicados nas redes deles — não é propaganda da marca, é o atleta contando da rotina dele.$$,
$$Seguidores dos atletas: ciclistas amadores e praticantes de endurance (pedal de estrada, MTB, gravel, triathlon, corrida) que querem render mais, recuperar melhor e se inspiram na rotina de quem compete.
Objetivo de cada vídeo: mostrar o produto dentro de um momento real da rotina (treino, prova, recuperação) e levar o seguidor a usar o cupom do atleta.$$,
$$- Fala de atleta pra atleta: natural, direto, em primeira pessoa, como se estivesse contando pra um amigo de pedal.
- Português do Brasil falado, frases curtas, fáceis de falar olhando pra câmera.
- Confiante sem exagero; técnico quando precisa, mas sem virar aula.
- Respeite o estilo de fala do atleta (vem na ficha dele) — o roteiro tem que soar como ELE.$$,
$$pedal, treino, prova, longão, recuperação, pós-treino, pré-prova, performance, energia, rotina, constância, FourLab, cupom$$,
$$(adicione aqui ganchos e frases que já funcionaram — ex.: "Ninguém te conta isso sobre o pós-treino…", "O que eu levo no bolso da camisa em prova longa")$$,
$$- Linguagem de anúncio ou de vendedor ("imperdível", "aproveite já", "o melhor do mercado").
- Promessas de saúde ou resultado garantido; termos médicos; comparação com concorrentes.
- Textos longos demais pra falar em até 60 segundos.
- Clichês de IA ("no mundo de hoje", "é importante ressaltar", "desbloqueie", "jornada").
- Emojis dentro da fala.$$,
$$Responda em markdown, neste formato:
# Gancho (0–3s)
Uma frase forte que prende logo no começo.
# Roteiro
- Falas curtas, na ordem, cada uma numa linha (com indicação de cena entre colchetes quando ajudar, ex.: [mostrando o sachê no bolso]).
- Produto aparece dentro da rotina, sem cara de propaganda.
# Chamada final
Convite pra usar o cupom do atleta (sem inventar o código se ele não vier nos dados).
# Legenda sugerida
2–4 linhas para o post, com o cupom.
Para CARROSSEL, troque "Roteiro" por "Slides": um bloco por slide (Slide 1, Slide 2…), com texto curto de tela.$$,
'')
on conflict (id) do nothing;

alter table public.ia_contexto enable row level security;
drop policy if exists "equipe le e edita contexto ia" on public.ia_contexto;
create policy "equipe le e edita contexto ia" on public.ia_contexto for all to authenticated
  using ((auth.uid() is not null and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'atleta') and not exists (select 1 from public.athletes a where a.auth_user_id = auth.uid())))
  with check ((auth.uid() is not null and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'atleta') and not exists (select 1 from public.athletes a where a.auth_user_id = auth.uid())));

-- A equipe precisa conseguir mover (👍↔👎), editar o motivo e excluir exemplos na nova aba.
-- (Política adicional — não remove nenhuma que já exista.)
drop policy if exists "equipe gerencia exemplos" on public.roteiro_exemplos;
create policy "equipe gerencia exemplos" on public.roteiro_exemplos for all to authenticated
  using ((auth.uid() is not null and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'atleta') and not exists (select 1 from public.athletes a where a.auth_user_id = auth.uid())))
  with check ((auth.uid() is not null and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'atleta') and not exists (select 1 from public.athletes a where a.auth_user_id = auth.uid())));
