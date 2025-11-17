
-- 1) Harden tokens table: enable RLS and revoke table privileges
alter table public.tokens enable row level security;

revoke select, insert, update, delete on table public.tokens from anon, authenticated;

-- Note: With RLS enabled and no policies, anon/authenticated cannot access tokens at all.
-- If you later need controlled access, expose a SECURITY DEFINER RPC and restrict EXECUTE.

-- 2) Restrict EXECUTE on existing SECURITY DEFINER functions
revoke execute on function public.increment_token_usage(varchar) from public, anon, authenticated;
grant execute on function public.increment_token_usage(varchar) to service_role;

revoke execute on function public.set_client_context(varchar) from public, anon, authenticated;
grant execute on function public.set_client_context(varchar) to service_role;

-- These internal trigger functions should not be callable over RPC:
revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.update_campaign_stats() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3) Prevent privilege escalation on profiles.is_power_user
-- Disallow clients from updating the privilege-bearing column
revoke update (is_power_user) on table public.profiles from anon, authenticated;

-- 4) Introduce roles infra for admin-only operations
create type if not exists public.app_role as enum ('admin', 'moderator', 'power_user', 'user');

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Users can read their own roles
drop policy if exists "Users can view their roles" on public.user_roles;
create policy "Users can view their roles"
  on public.user_roles
  for select
  using (auth.uid() = user_id);

-- Admins manage roles (insert/update/delete/select-all)
drop policy if exists "Admins manage roles" on public.user_roles;
create policy "Admins manage roles"
  on public.user_roles
  for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Role helper
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  );
$$;

-- 5) Admin-only RPC to toggle power user status
create or replace function public.set_power_user(_user_id uuid, _enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Not authorized';
  end if;

  update public.profiles
  set is_power_user = _enabled
  where user_id = _user_id;
end;
$$;

revoke execute on function public.set_power_user(uuid, boolean) from public, anon;
grant execute on function public.set_power_user(uuid, boolean) to authenticated;

-- 6) Enforce ownership on user-owned tables via triggers
create or replace function public.enforce_user_ownership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Stamp ownership and forbid spoofing
    if new.user_auth_id is null then
      new.user_auth_id := auth.uid();
    end if;
    if new.user_auth_id <> auth.uid() then
      raise exception 'Cannot create records for other users';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.user_auth_id <> old.user_auth_id then
      raise exception 'Cannot change record ownership';
    end if;
  end if;
  return new;
end;
$$;

-- Attach to campaigns
drop trigger if exists tr_enforce_user_ownership_campaigns on public.campaigns;
create trigger tr_enforce_user_ownership_campaigns
before insert or update on public.campaigns
for each row execute procedure public.enforce_user_ownership();

-- Attach to AGA Runs Progress (quoted table name)
drop trigger if exists tr_enforce_user_ownership_aga on public."AGA Runs Progress";
create trigger tr_enforce_user_ownership_aga
before insert or update on public."AGA Runs Progress"
for each row execute procedure public.enforce_user_ownership();
