-- =====================================================================
-- UniSole Dispatch CRM — Phase B, migration 8: row-level security (RLS)
-- =====================================================================
-- This is the access wall, enforced INSIDE the database (PRD §3, "never
-- by hiding things in the UI"). Once RLS is on, a table returns only the
-- rows the logged-in user is allowed to see — even if the app has a bug.
--
-- Access matrix:
--   sales_agent — own carriers ONLY while not yet Active; own follow-ups
--   dispatcher  — carriers assigned to them; their loads & dispatch notes
--   admin       — everything; the only role that can reassign a dispatcher
-- =====================================================================


-- ---------------------------------------------------------------------
-- Identity helpers. SECURITY DEFINER so they can read `profiles` without
-- being blocked by profiles' own RLS (prevents recursion).
-- ---------------------------------------------------------------------
create or replace function app_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'system'));
$$;

create or replace function app_agent_id()
returns bigint language sql stable security definer set search_path = public as $$
  select linked_agent_id from profiles where id = auth.uid();
$$;

create or replace function app_dispatcher_id()
returns bigint language sql stable security definer set search_path = public as $$
  select linked_dispatcher_id from profiles where id = auth.uid();
$$;

-- Can the current user see this carrier? Used by the child tables so their
-- policies don't have to re-implement (or recurse into) carrier RLS.
create or replace function app_can_see_carrier(p_carrier_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from carriers c
    where c.id = p_carrier_id and (
      app_is_admin()
      or (c.sales_agent_id = app_agent_id() and c.first_load_delivered_at is null)
      or c.dispatcher_id = app_dispatcher_id()
    )
  );
$$;


-- ---------------------------------------------------------------------
-- Turn RLS on for every table. With RLS on and no matching policy, access
-- is denied by default — so we add exactly the policies we want below.
-- ---------------------------------------------------------------------
alter table profiles                   enable row level security;
alter table sales_agents               enable row level security;
alter table dispatchers                enable row level security;
alter table truck_types                enable row level security;
alter table carriers                   enable row level security;
alter table carrier_status_history     enable row level security;
alter table carrier_dispatcher_history enable row level security;
alter table follow_ups                 enable row level security;
alter table carrier_dispatch_notes     enable row level security;
alter table loads                      enable row level security;


-- ---------------------------------------------------------------------
-- profiles — read your own; admins manage all
-- ---------------------------------------------------------------------
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or app_is_admin());
create policy profiles_admin_write on profiles for all to authenticated
  using (app_is_admin()) with check (app_is_admin());


-- ---------------------------------------------------------------------
-- Reference tables — everyone signed in can read (needed for labels /
-- dropdowns); only admins can change them.
-- ---------------------------------------------------------------------
create policy truck_types_select on truck_types for select to authenticated using (true);
create policy truck_types_admin  on truck_types for all    to authenticated
  using (app_is_admin()) with check (app_is_admin());

create policy sales_agents_select on sales_agents for select to authenticated using (true);
create policy sales_agents_admin  on sales_agents for all    to authenticated
  using (app_is_admin()) with check (app_is_admin());

create policy dispatchers_select on dispatchers for select to authenticated using (true);
create policy dispatchers_admin  on dispatchers for all    to authenticated
  using (app_is_admin()) with check (app_is_admin());


-- ---------------------------------------------------------------------
-- carriers — the core access rule (Rule 7 / access matrix)
-- ---------------------------------------------------------------------
-- Read: admin all; agent own & not-yet-active; dispatcher assigned.
create policy carriers_select on carriers for select to authenticated
  using (
    app_is_admin()
    or (sales_agent_id = app_agent_id() and first_load_delivered_at is null)
    or dispatcher_id = app_dispatcher_id()
  );

-- Insert: an agent creates their own carriers; admin can create any.
create policy carriers_insert on carriers for insert to authenticated
  with check (
    app_is_admin()
    or sales_agent_id = app_agent_id()
  );

-- Update: admin any; agent only their own pre-active carriers. Dispatchers
-- do NOT update carriers directly — they act via loads & dispatch notes,
-- and the auto-Active flip runs as a privileged trigger (bypasses RLS).
create policy carriers_update on carriers for update to authenticated
  using (
    app_is_admin()
    or (sales_agent_id = app_agent_id() and first_load_delivered_at is null)
  )
  with check (
    app_is_admin()
    or (sales_agent_id = app_agent_id() and first_load_delivered_at is null)
  );
-- (No delete policy: records are never hard-deleted.)


-- ---------------------------------------------------------------------
-- History tables — READ-ONLY to users; written ONLY by the triggers
-- (which run as SECURITY DEFINER and bypass RLS). No insert/update/delete
-- policy exists, so no user can write or tamper with the audit trail.
-- ---------------------------------------------------------------------
create policy status_history_select on carrier_status_history for select to authenticated
  using (app_can_see_carrier(carrier_id));

create policy dispatcher_history_select on carrier_dispatcher_history for select to authenticated
  using (app_can_see_carrier(carrier_id));


-- ---------------------------------------------------------------------
-- follow_ups — sales-side. Agent manages their own; admin all.
-- ---------------------------------------------------------------------
create policy follow_ups_all on follow_ups for all to authenticated
  using (app_is_admin() or sales_agent_id = app_agent_id())
  with check (app_is_admin() or sales_agent_id = app_agent_id());


-- ---------------------------------------------------------------------
-- carrier_dispatch_notes — dispatch-side. Dispatcher manages own; admin all.
-- ---------------------------------------------------------------------
create policy dispatch_notes_all on carrier_dispatch_notes for all to authenticated
  using (app_is_admin() or dispatcher_id = app_dispatcher_id())
  with check (app_is_admin() or dispatcher_id = app_dispatcher_id());


-- ---------------------------------------------------------------------
-- loads — dispatch-side. Dispatcher manages own; admin all.
-- ---------------------------------------------------------------------
create policy loads_all on loads for all to authenticated
  using (app_is_admin() or dispatcher_id = app_dispatcher_id())
  with check (app_is_admin() or dispatcher_id = app_dispatcher_id());
