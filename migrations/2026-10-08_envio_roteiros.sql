-- ============================================================
-- Envio de roteiros pro atleta + marca de "roteiro alterado".
--   - enviado_em: vazio = rascunho (só a equipe vê); preenchido = o atleta vê
--   - roteiro_enviado: o texto exatamente como foi enviado (pra comparar/restaurar)
--   - avaliacao: 'bom' quando a equipe deu 👍 (não apaga mais o roteiro)
--   - alterado_equipe_em / alterado_atleta_em: quem mexeu depois do envio
-- Rodar no SQL Editor do Supabase. É idempotente (pode rodar de novo).
-- ============================================================

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'entries' and column_name = 'enviado_em') then
    alter table public.entries add column enviado_em timestamptz;
    alter table public.entries add column if not exists roteiro_enviado text not null default '';
    -- Só na primeira vez: os roteiros que já existiam já apareciam pro atleta, então ficam como enviados.
    update public.entries set enviado_em = now(), roteiro_enviado = roteiro where coalesce(roteiro, '') <> '';
  end if;
end $$;

alter table public.entries add column if not exists roteiro_enviado text not null default '';
alter table public.entries add column if not exists avaliacao text;
alter table public.entries add column if not exists alterado_equipe_em timestamptz;
alter table public.entries add column if not exists alterado_atleta_em timestamptz;

-- O atleta/parceiro edita o PRÓPRIO roteiro, só depois de enviado. Fica marcado como alterado por ele.
create or replace function public.editar_meu_roteiro(p_entry uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.entries
     set roteiro = coalesce(p_texto, ''), alterado_atleta_em = now()
   where id = p_entry
     and athlete_id = public.meu_cadastro_id()
     and enviado_em is not null;
  if not found then
    raise exception 'Roteiro não encontrado.';
  end if;
end;
$$;
revoke all on function public.editar_meu_roteiro(uuid, text) from public, anon;
grant execute on function public.editar_meu_roteiro(uuid, text) to authenticated;
