-- =====================================================================
-- UniSole Dispatch CRM — login/logout audit + presence tracking
-- =====================================================================
-- Adds:
--   * profiles.last_seen_at / last_active_at  — updated by a heartbeat
--   * auth_events                              — a login/logout audit log
--   * log_auth_event() / touch_presence()      — SECURITY DEFINER helpers so
--     a signed-in user can record their OWN events without needing broad
--     write access to these tables.
--
-- Presence is derived (not stored): given last_seen_at / last_active_at and
-- "now", the app decides Online / Idle / Offline. See lib/presence.ts.
-- Safe to run once on the existing project.
-- =====================================================================

-- ---- 1) presence columns on profiles --------------------------------
alter table profiles add column if not exists last_seen_at   timestamptz;
alter table profiles add column if not exists last_active_at timestamptz;

-- ---- 2) login / logout audit log ------------------------------------
create table if not exists auth_events (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references profiles (id) on delete cascade,
  kind        text not null check (kind in ('login', 'logout')),
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists auth_events_profile_idx on auth_events (profile_id, created_at desc);
create index if not exists auth_events_created_idx on auth_events (created_at desc);

alter table auth_events enable row level security;

-- Admins see everyone's history; a user may see their own. No insert/update/
-- delete policy — writes happen only through the SECURITY DEFINER function
-- below, so the log can't be forged or tampered with from the client.
drop policy if exists auth_events_select on auth_events;
create policy auth_events_select on auth_events for select to authenticated
  using (app_is_admin() or profile_id = auth.uid());

-- ---- 3) helper functions (run as owner, scoped to the caller) --------

-- Record a login or logout for the currently signed-in user.
create or replace function log_auth_event(p_kind text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_kind not in ('login', 'logout') then
    raise exception 'log_auth_event: invalid kind %', p_kind;
  end if;

  insert into auth_events (profile_id, kind, user_agent)
  values (auth.uid(), p_kind, left(coalesce(p_user_agent, ''), 400));

  if p_kind = 'login' then
    update profiles set last_seen_at = now(), last_active_at = now()
     where id = auth.uid();
  elsif p_kind = 'logout' then
    -- mark them offline immediately (no more heartbeats will arrive)
    update profiles set last_seen_at = null, last_active_at = null
     where id = auth.uid();
  end if;
end; $$;

-- Heartbeat: mark the caller present. p_active = are they interacting now?
create or replace function touch_presence(p_active boolean default true)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update profiles
     set last_seen_at   = now(),
         last_active_at = case when p_active then now() else last_active_at end
   where id = auth.uid();
end; $$;

grant execute on function log_auth_event(text, text) to authenticated;
grant execute on function touch_presence(boolean)     to authenticated;
