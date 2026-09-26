-- ============================================================
-- Redesign de UX — rodar uma vez no SQL Editor do Supabase.
-- É idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================

-- 1) Dados de perfil do atleta (preenchidos por ele em atleta-perfil.html)
alter table public.athletes
  add column if not exists email text default '',
  add column if not exists whatsapp text default '',
  add column if not exists instagram text default '',
  add column if not exists facebook text default '',
  add column if not exists tiktok text default '',
  add column if not exists youtube text default '',
  add column if not exists pix_key text default '',
  add column if not exists endereco_cep text default '',
  add column if not exists endereco_rua text default '',
  add column if not exists endereco_numero text default '',
  add column if not exists endereco_complemento text default '',
  add column if not exists endereco_bairro text default '',
  add column if not exists endereco_cidade text default '',
  add column if not exists endereco_estado text default '';

-- 2) O atleta só pode alterar os PRÓPRIOS dados de contato/endereço/PIX.
--    (Nada de cupom, comissão, equipe etc. — por isso uma função e não uma policy de UPDATE.)
create or replace function public.atualizar_meu_perfil(dados jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.athletes set
    email                = coalesce(dados->>'email', email),
    whatsapp             = coalesce(dados->>'whatsapp', whatsapp),
    instagram            = coalesce(dados->>'instagram', instagram),
    facebook             = coalesce(dados->>'facebook', facebook),
    tiktok               = coalesce(dados->>'tiktok', tiktok),
    youtube              = coalesce(dados->>'youtube', youtube),
    -- PIX só pra quem recebe comissão (tem cupom)
    pix_key              = case when coalesce(cupom_yampi,'') <> '' then coalesce(dados->>'pix_key', pix_key) else pix_key end,
    endereco_cep         = coalesce(dados->>'endereco_cep', endereco_cep),
    endereco_rua         = coalesce(dados->>'endereco_rua', endereco_rua),
    endereco_numero      = coalesce(dados->>'endereco_numero', endereco_numero),
    endereco_complemento = coalesce(dados->>'endereco_complemento', endereco_complemento),
    endereco_bairro      = coalesce(dados->>'endereco_bairro', endereco_bairro),
    endereco_cidade      = coalesce(dados->>'endereco_cidade', endereco_cidade),
    endereco_estado      = coalesce(dados->>'endereco_estado', endereco_estado)
  where auth_user_id = auth.uid();
  if not found then
    raise exception 'Nenhum atleta vinculado a este login';
  end if;
end;
$$;
revoke all on function public.atualizar_meu_perfil(jsonb) from public, anon;
grant execute on function public.atualizar_meu_perfil(jsonb) to authenticated;

-- 3) Pipeline / CRM interno (crm.html)
create table if not exists public.crm_cards (
  id uuid primary key default gen_random_uuid(),
  titulo text not null default '',
  tipo text not null default 'Outro',          -- Conteúdo, Acompanhamento, Envio de produto, Pagamento, Contrato, Outro
  stage text not null default 'a_fazer',       -- a_fazer, andamento, aguardando, concluido
  prioridade text not null default 'media',    -- alta, media, baixa
  athlete_id uuid references public.athletes(id) on delete set null,
  entry_id uuid references public.entries(id) on delete set null,
  due_date date,
  notas text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists crm_cards_stage_idx on public.crm_cards(stage, position);
create unique index if not exists crm_cards_entry_uniq on public.crm_cards(entry_id) where entry_id is not null;

alter table public.crm_cards enable row level security;

-- Só a equipe (qualquer perfil que não seja atleta) vê e mexe no pipeline
drop policy if exists "equipe gerencia crm" on public.crm_cards;
create policy "equipe gerencia crm" on public.crm_cards
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'atleta'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'atleta'));
