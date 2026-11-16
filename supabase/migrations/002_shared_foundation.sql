-- =============================================================================
-- Novitá MoneySync - Fase 2: Grupos, Membros e Despesas Compartilhadas
-- =============================================================================
-- Migração estrutural com Row Level Security (RLS) para o Supabase.
-- Garante isolamento estrito entre casais/grupos distintos.
-- Nenhum membro lê ou altera registros de outro grupo.
-- =============================================================================

begin;

-- 1. Grupos (ex.: Família Jonas & Cris)
create table if not exists public.moneysync_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(btrim(name)) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Membros do Grupo
create table if not exists public.moneysync_group_members (
  group_id uuid not null references public.moneysync_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check(role in ('admin', 'member')),
  display_name text check(display_name is null or length(btrim(display_name)) between 1 and 60),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists idx_moneysync_members_user on public.moneysync_group_members(user_id);

-- 3. Função de verificação de pertinência ao grupo (evita recursão de RLS)
create or replace function public.is_moneysync_group_member(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.moneysync_group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_moneysync_group_member(uuid, uuid) from public;
grant execute on function public.is_moneysync_group_member(uuid, uuid) to authenticated;

-- 4. Despesas Compartilhadas do Grupo
create table if not exists public.moneysync_shared_entries (
  id uuid primary key,
  group_id uuid not null references public.moneysync_groups(id) on delete cascade,
  series_id uuid,
  description text not null check(length(btrim(description)) between 1 and 120),
  amount_cents bigint not null check(amount_cents > 0 and amount_cents <= 99999999999),
  reference_month date not null check(extract(day from reference_month) = 1),
  payer_id uuid not null references auth.users(id),
  installment_number int not null default 1 check(installment_number >= 1),
  installment_count int not null default 1 check(installment_count >= 1 and installment_number <= installment_count),
  split_rule text not null check(split_rule in ('percent', 'fixed', 'equal')),
  paid boolean not null default false,
  version bigint not null default 1,
  deleted_at timestamptz,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_moneysync_shared_group_month on public.moneysync_shared_entries(group_id, reference_month);
create index if not exists idx_moneysync_shared_series on public.moneysync_shared_entries(series_id);

-- 5. Cotas e Rateio por Participante em Cada Parcela
create table if not exists public.moneysync_entry_shares (
  entry_id uuid not null references public.moneysync_shared_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_percent int check(weight_percent is null or (weight_percent between 1 and 99)),
  fixed_cents bigint check(fixed_cents is null or fixed_cents >= 0),
  share_cents bigint not null check(share_cents >= 0),
  primary key (entry_id, user_id)
);

create index if not exists idx_moneysync_shares_user on public.moneysync_entry_shares(user_id);

-- 6. Compensações e Acertos Efetivados (Reembolsos)
create table if not exists public.moneysync_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.moneysync_groups(id) on delete cascade,
  from_user_id uuid not null references auth.users(id),
  to_user_id uuid not null references auth.users(id),
  amount_cents bigint not null check(amount_cents > 0),
  reference_month date not null check(extract(day from reference_month) = 1),
  settled_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index if not exists idx_moneysync_settlements_group on public.moneysync_settlements(group_id, reference_month);

-- 7. Trigger de versionamento para entradas compartilhadas
create trigger moneysync_shared_stamp
  before insert or update on public.moneysync_shared_entries
  for each row execute function public.moneysync_stamp();

-- =============================================================================
-- Configuração de Row Level Security (RLS)
-- =============================================================================

-- Habilitar RLS em todas as tabelas
alter table public.moneysync_groups enable row level security;
alter table public.moneysync_group_members enable row level security;
alter table public.moneysync_shared_entries enable row level security;
alter table public.moneysync_entry_shares enable row level security;
alter table public.moneysync_settlements enable row level security;

-- Revogar acesso público/anônimo
revoke all on public.moneysync_groups from anon;
revoke all on public.moneysync_group_members from anon;
revoke all on public.moneysync_shared_entries from anon;
revoke all on public.moneysync_entry_shares from anon;
revoke all on public.moneysync_settlements from anon;

-- Conceder permissões para usuários autenticados
grant select, insert, update on public.moneysync_groups to authenticated;
grant select, insert, update, delete on public.moneysync_group_members to authenticated;
grant select, insert, update on public.moneysync_shared_entries to authenticated;
grant select, insert, update on public.moneysync_entry_shares to authenticated;
grant select, insert on public.moneysync_settlements to authenticated;

-- Políticas de moneysync_groups
create policy groups_select on public.moneysync_groups
  for select to authenticated
  using (public.is_moneysync_group_member(id, (select auth.uid())));

create policy groups_insert on public.moneysync_groups
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy groups_update on public.moneysync_groups
  for update to authenticated
  using (public.is_moneysync_group_member(id, (select auth.uid())));

-- Políticas de moneysync_group_members
create policy members_select on public.moneysync_group_members
  for select to authenticated
  using (public.is_moneysync_group_member(group_id, (select auth.uid())));

create policy members_insert on public.moneysync_group_members
  for insert to authenticated
  with check (
    -- Permite auto-inclusão ao criar grupo ou inclusão se já for admin do grupo
    user_id = (select auth.uid()) or
    exists (
      select 1 from public.moneysync_group_members
      where group_id = moneysync_group_members.group_id
        and user_id = (select auth.uid())
        and role = 'admin'
    )
  );

create policy members_delete on public.moneysync_group_members
  for delete to authenticated
  using (
    user_id = (select auth.uid()) or
    exists (
      select 1 from public.moneysync_group_members
      where group_id = moneysync_group_members.group_id
        and user_id = (select auth.uid())
        and role = 'admin'
    )
  );

-- Políticas de moneysync_shared_entries
create policy shared_entries_select on public.moneysync_shared_entries
  for select to authenticated
  using (public.is_moneysync_group_member(group_id, (select auth.uid())));

create policy shared_entries_insert on public.moneysync_shared_entries
  for insert to authenticated
  with check (public.is_moneysync_group_member(group_id, (select auth.uid())));

create policy shared_entries_update on public.moneysync_shared_entries
  for update to authenticated
  using (public.is_moneysync_group_member(group_id, (select auth.uid())))
  with check (public.is_moneysync_group_member(group_id, (select auth.uid())));

-- Políticas de moneysync_entry_shares
create policy shares_select on public.moneysync_entry_shares
  for select to authenticated
  using (
    exists (
      select 1 from public.moneysync_shared_entries e
      where e.id = moneysync_entry_shares.entry_id
        and public.is_moneysync_group_member(e.group_id, (select auth.uid()))
    )
  );

create policy shares_insert on public.moneysync_entry_shares
  for insert to authenticated
  with check (
    exists (
      select 1 from public.moneysync_shared_entries e
      where e.id = moneysync_entry_shares.entry_id
        and public.is_moneysync_group_member(e.group_id, (select auth.uid()))
    )
  );

create policy shares_update on public.moneysync_entry_shares
  for update to authenticated
  using (
    exists (
      select 1 from public.moneysync_shared_entries e
      where e.id = moneysync_entry_shares.entry_id
        and public.is_moneysync_group_member(e.group_id, (select auth.uid()))
    )
  );

-- Políticas de moneysync_settlements
create policy settlements_select on public.moneysync_settlements
  for select to authenticated
  using (public.is_moneysync_group_member(group_id, (select auth.uid())));

create policy settlements_insert on public.moneysync_settlements
  for insert to authenticated
  with check (
    from_user_id = (select auth.uid()) and
    public.is_moneysync_group_member(group_id, (select auth.uid()))
  );

commit;
