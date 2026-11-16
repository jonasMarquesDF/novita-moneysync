-- Phase 1: private records only. Review and test in a fresh development project.
-- Not applied to any live project. Shared records require the next migration.
begin;
create table public.moneysync_private_entries (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 description text not null check(length(btrim(description)) between 1 and 120),
 amount_cents bigint not null check(amount_cents > 0 and amount_cents <= 99999999999),
 kind text not null check(kind in ('income','expense')),
 reference_month date not null check(extract(day from reference_month)=1),
 paid boolean not null default false,
 version bigint not null default 1,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index moneysync_private_owner_month on public.moneysync_private_entries(owner_id,reference_month);
alter table public.moneysync_private_entries enable row level security;
revoke all on public.moneysync_private_entries from anon;
grant select,insert,update on public.moneysync_private_entries to authenticated;
create policy private_read on public.moneysync_private_entries for select to authenticated using(owner_id=(select auth.uid()));
create policy private_insert on public.moneysync_private_entries for insert to authenticated with check(owner_id=(select auth.uid()));
create policy private_update on public.moneysync_private_entries for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create function public.moneysync_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then NEW.version:=1; NEW.created_at:=now();
 else
  if NEW.id<>OLD.id or NEW.owner_id<>OLD.owner_id then raise exception 'Immutable identity';end if;
  NEW.version:=OLD.version+1; NEW.created_at:=OLD.created_at;
 end if;
 NEW.updated_at:=now();return NEW;
end $$;
create trigger moneysync_private_stamp before insert or update on public.moneysync_private_entries for each row execute function public.moneysync_stamp();
revoke all on function public.moneysync_stamp() from public;
commit;
