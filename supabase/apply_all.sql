-- =====================================================================
-- UniSole CRM — COMBINED apply-all script
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- Runs every migration in order, then seeds the truck types.
-- Run ONCE on a fresh project.
-- =====================================================================


-- =====  supabase/migrations/20260712090000_enums.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — Phase A, migration 1: enum types
-- =====================================================================
-- Enums are fixed lists of allowed values, enforced by the database.
-- If a value isn't in the list, the database refuses to store it.
--
-- NOTE on truck types: these are DELIBERATELY NOT an enum. The business
-- said the list will grow, so truck types live in their own editable
-- table (see migration 2), not here.
-- =====================================================================

-- Carrier status lifecycle (PRD §4.4.1). The em dash in
-- 'Signed — Awaiting First Load' is intentional — keep it exact everywhere.
create type carrier_status as enum (
  'Lead',
  'Documents Sent',
  'Documents Received',
  'Signed — Awaiting First Load',
  'Active',
  'No Agreement',
  'Dead'
);

-- Who a login is. 'system' is reserved now (costs nothing) so that future
-- AI/automations/agents act as an attributable, governed actor — see the
-- plan, Part 3 §16. No human is given this role.
create type user_role as enum (
  'sales_agent',
  'dispatcher',
  'admin',
  'system'
);

-- Follow-up (sales-side) classification (PRD §4.6).
create type follow_up_type as enum (
  'Call',
  'Text',
  'Email',
  'In-person'
);

create type follow_up_outcome as enum (
  'Interested',
  'Not interested',
  'Callback later',
  'Signed',
  'Went dead'
);

-- Dispatch-side note outcome (new table — see plan §2.8). Values are a
-- proposed starting set; confirm with the business before go-live.
create type dispatch_note_outcome as enum (
  'Load booked',
  'Carrier unresponsive',
  'Rate too low / declined',
  'No suitable loads',
  'Other'
);

-- Load payment + delivery states (PRD §4.7).
create type payment_status as enum (
  'Pending',
  'Invoice Created',
  'Paid'
);

create type load_status as enum (
  'En Route',
  'Delivered'
);


-- =====  supabase/migrations/20260712090100_reference_tables.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — Phase A, migration 2: reference / people tables
-- =====================================================================
-- truck_types, sales_agents, dispatchers, and profiles (which extends
-- Supabase Auth). These are referenced by ID everywhere else, so each
-- real-world thing is stored exactly once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- truck_types — editable lookup (plan decision #1). Add new types from an
-- admin screen without a developer or a migration.
-- ---------------------------------------------------------------------
create table truck_types (
  id          bigint generated always as identity primary key,
  code        text not null unique,             -- e.g. 'SD', 'SBT', 'SBT/DV'
  description text,                              -- plain-language name
  is_active   boolean not null default true,    -- retire a type without deleting old data
  created_at  timestamptz not null default now()
);

comment on table truck_types is
  'Editable list of truck types. Grows over time; never hard-code these.';

-- ---------------------------------------------------------------------
-- sales_agents (PRD §4.2)
-- ---------------------------------------------------------------------
create table sales_agents (
  id             bigint generated always as identity primary key,
  real_name      text not null,
  alias          text,                           -- US-client codename
  monthly_target integer not null default 0,     -- carriers signed per month
  is_active      boolean not null default true,  -- for agents who have left
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- dispatchers (PRD §4.3)
-- ---------------------------------------------------------------------
create table dispatchers (
  id             bigint generated always as identity primary key,
  real_name      text not null,
  alias          text,
  monthly_target numeric(12,2) not null default 0,  -- dollar target per month
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- profiles — extends Supabase Auth (plan §2.1).
-- Supabase Auth (auth.users) owns the real login + password. This table
-- only adds the business role and links. There is NO password column here.
-- id is the SAME id as the Supabase login, so auth.uid() joins straight in.
-- ---------------------------------------------------------------------
create table profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text,                      -- mirror of the login email, for convenience
  role                 user_role not null,
  linked_agent_id      bigint references sales_agents (id),
  linked_dispatcher_id bigint references dispatchers (id),
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),

  -- A sales-agent login must link to an agent; a dispatcher login to a
  -- dispatcher. Admin/system links to neither. This keeps access rules honest.
  constraint profiles_role_link_ck check (
    (role = 'sales_agent' and linked_agent_id is not null and linked_dispatcher_id is null) or
    (role = 'dispatcher'  and linked_dispatcher_id is not null and linked_agent_id is null) or
    (role in ('admin', 'system') and linked_agent_id is null and linked_dispatcher_id is null)
  )
);

comment on table profiles is
  'Business profile for each Supabase Auth user: role + link to agent/dispatcher. No passwords here.';


-- =====  supabase/migrations/20260712090200_carriers.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — Phase A, migration 3: carriers
-- =====================================================================
-- The core table. One row = one "sale" (PRD §4.4).
-- The business rules on this table (immutable agent, computed Active,
-- status history, dispatch ownership) are enforced by triggers in
-- migration 6 — the columns here just hold the data.
-- =====================================================================

create table carriers (
  id                      bigint generated always as identity primary key,

  -- Identity / contact
  company_name            text not null,
  contact_person          text,
  phone                   text,
  email                   text,
  mc_number               text,                 -- Motor Carrier authority number
  mc_age                  text,                 -- free text, e.g. '8M', '2M 1W'
  truck_type_id           bigint references truck_types (id),

  -- Sales ownership — IMMUTABLE (Rule 2, enforced by trigger). A carrier
  -- permanently belongs to the agent who signed it.
  sales_agent_id          bigint not null references sales_agents (id),

  -- Lifecycle
  status                  carrier_status not null default 'Lead',
  status_changed_at       timestamptz not null default now(),  -- auto-stamped by trigger
  docs_sent_at            date,
  docs_received_at        date,                 -- drives sales-agent monthly credit

  -- Dispatch ownership (Rule 7). Null until assigned. Owner once Active.
  -- Only an admin may change this; every change is logged (trigger, migration 6).
  dispatcher_id           bigint references dispatchers (id),
  date_assigned           date,

  -- Set AUTOMATICALLY by the database the moment a load is delivered
  -- (Rule 1). This stamp is the definition of "has become Active" and is
  -- used as the sales-agent visibility boundary. Never set by hand.
  first_load_delivered_at date,

  lead_source             text,
  remarks                 text,

  created_at              timestamptz not null default now(),
  created_by              uuid references profiles (id)
);

comment on table carriers is
  'One row = one sale. sales_agent_id is immutable; Active is computed; all status changes are logged — see triggers in migration 6.';
comment on column carriers.first_load_delivered_at is
  'Set only by the auto-Active trigger on load delivery. Marks the sales/dispatch handoff boundary.';


-- =====  supabase/migrations/20260712090300_history_and_activity.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — Phase A, migration 4: history & activity tables
-- =====================================================================
-- carrier_status_history      — audit of every status change (Rule 4)
-- carrier_dispatcher_history  — audit of every dispatcher change (Rule 7)
-- follow_ups                  — sales-side contact log (PRD §4.6)
-- carrier_dispatch_notes      — dispatch-side activation log (plan §2.8)
-- The two history tables are written ONLY by triggers (migration 6),
-- never directly by the app.
-- =====================================================================

-- ---------------------------------------------------------------------
-- carrier_status_history (Rule 4) — full journey of every sale
-- ---------------------------------------------------------------------
create table carrier_status_history (
  id         bigint generated always as identity primary key,
  carrier_id bigint not null references carriers (id) on delete cascade,
  old_status carrier_status,                    -- null on the very first row
  new_status carrier_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references profiles (id),     -- filled from auth.uid() by the trigger
  reason     text
);

create index on carrier_status_history (carrier_id, changed_at);

-- ---------------------------------------------------------------------
-- carrier_dispatcher_history (Rule 7) — who owned a carrier, when
-- ---------------------------------------------------------------------
create table carrier_dispatcher_history (
  id                bigint generated always as identity primary key,
  carrier_id        bigint not null references carriers (id) on delete cascade,
  old_dispatcher_id bigint references dispatchers (id),   -- null on first assignment
  new_dispatcher_id bigint references dispatchers (id),
  changed_at        timestamptz not null default now(),
  changed_by        uuid references profiles (id),        -- the admin who reassigned
  reason            text
);

create index on carrier_dispatcher_history (carrier_id, changed_at);

-- ---------------------------------------------------------------------
-- follow_ups — sales-side (PRD §4.6). The biggest current data gap.
-- ---------------------------------------------------------------------
create table follow_ups (
  id                 bigint generated always as identity primary key,
  carrier_id         bigint not null references carriers (id) on delete cascade,
  sales_agent_id     bigint not null references sales_agents (id),  -- who made the contact
  contacted_at       timestamptz not null default now(),
  type               follow_up_type not null,
  notes              text,
  outcome            follow_up_outcome,
  next_followup_date date,                        -- drives "who's due today"
  created_at         timestamptz not null default now()
);

create index on follow_ups (carrier_id, contacted_at);
create index on follow_ups (next_followup_date);

-- ---------------------------------------------------------------------
-- carrier_dispatch_notes — dispatch-side (plan §2.8). What the dispatcher
-- tried while getting a signed carrier's first load moving. Feeds the
-- stalled-sale report so a stuck carrier shows WHY it's stuck.
-- ---------------------------------------------------------------------
create table carrier_dispatch_notes (
  id               bigint generated always as identity primary key,
  carrier_id       bigint not null references carriers (id) on delete cascade,
  dispatcher_id    bigint not null references dispatchers (id),   -- who logged it
  noted_at         timestamptz not null default now(),
  note             text,
  outcome          dispatch_note_outcome,
  next_action_date date,
  created_at       timestamptz not null default now()
);

create index on carrier_dispatch_notes (carrier_id, noted_at);


-- =====  supabase/migrations/20260712090400_loads.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — Phase A, migration 5: loads
-- =====================================================================
-- Dispatch strength data (PRD §4.7). When a load is delivered, a trigger
-- (migration 6) flips its carrier to Active — this is the ONLY way a
-- carrier becomes Active.
-- =====================================================================

create table loads (
  id                 bigint generated always as identity primary key,
  carrier_id         bigint not null references carriers (id),
  dispatcher_id      bigint not null references dispatchers (id),

  pickup_date        date not null,             -- decides which month it counts toward (plan decision #3)
  pickup_location    text,                      -- City, State
  delivery_date      date,
  delivery_location  text,

  rate               numeric(14,2) not null,    -- what the load pays
  service_charge_pct numeric(6,4) not null,     -- company commission, e.g. 0.0400 = 4%

  -- amount_earned is COMPUTED by the database and cannot be typed by hand.
  -- 'stored' means it's saved on the row (fast to read/sum for targets).
  amount_earned      numeric(14,2)
                       generated always as (round(rate * service_charge_pct, 2)) stored,

  payment_status     payment_status not null default 'Pending',
  payment_route      text,                      -- Zelle, etc.
  load_status        load_status not null default 'En Route',
  remarks            text,
  created_at         timestamptz not null default now()
);

create index on loads (carrier_id);
create index on loads (dispatcher_id, pickup_date);   -- dispatcher monthly target
create index on loads (load_status);

comment on column loads.amount_earned is
  'Generated column: round(rate * service_charge_pct, 2). Cannot be set by hand.';


-- =====  supabase/migrations/20260712090500_functions_triggers.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — Phase A, migration 6: rule-enforcement triggers
-- =====================================================================
-- This is where the non-negotiable business rules become UNBREAKABLE.
-- They live in the database, so they hold no matter what the app code or
-- a manual edit does. Rules referenced below are from the plan / PRD:
--
--   Rule 1  Active is computed, never set by hand
--   Rule 2  sales_agent_id is immutable
--   Rule 3  strict status lifecycle (admins may override)
--   Rule 4  every status change is logged automatically
--   Rule 7  dispatch ownership: admin-only reassignment, fully logged
-- =====================================================================


-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- The Supabase login id of the acting user, but only if they have a
-- profile row (avoids a foreign-key error when writing history for an
-- as-yet-unprofiled auth user). Null in direct-SQL / service contexts.
create or replace function app_actor()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where id = auth.uid();
$$;

-- "Privileged" = allowed to bypass the status-lifecycle and dispatcher
-- rules. True when: (a) a trigger has flagged a system-driven action,
-- (b) there is no logged-in user (direct DB / service role — trusted), or
-- (c) the logged-in user is an admin or the reserved system role.
create or replace function app_is_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(current_setting('unisole.system_action', true) = 'on', false)
    or auth.uid() is null
    or exists (
      select 1 from profiles
      where id = auth.uid() and role in ('admin', 'system')
    );
$$;

-- The allowed forward moves in the carrier lifecycle (Rule 3).
-- Dead is an exit from any live stage; No Agreement only before signing.
create or replace function carrier_transition_allowed(
  old_status carrier_status,
  new_status carrier_status
)
returns boolean
language sql
immutable
as $$
  select case old_status
    when 'Lead'
      then new_status in ('Documents Sent', 'Dead', 'No Agreement')
    when 'Documents Sent'
      then new_status in ('Documents Received', 'Dead', 'No Agreement')
    when 'Documents Received'
      then new_status in ('Signed — Awaiting First Load', 'Dead', 'No Agreement')
    when 'Signed — Awaiting First Load'
      then new_status in ('Active', 'Dead')
    when 'Active'
      then new_status in ('Dead')
    else false  -- Dead / No Agreement are terminal (admins bypass this)
  end;
$$;


-- ---------------------------------------------------------------------
-- carriers: BEFORE INSERT/UPDATE — enforce Rules 1, 2, 3, 7 + stamps
-- ---------------------------------------------------------------------
create or replace function carriers_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    -- Rule 2: sales_agent_id can never change.
    if new.sales_agent_id is distinct from old.sales_agent_id then
      raise exception
        'sales_agent_id is immutable: a carrier permanently belongs to the agent who signed it (Rule 2).';
    end if;

    -- Rule 7: only an admin (or system) may set/change the dispatcher.
    if new.dispatcher_id is distinct from old.dispatcher_id and not app_is_privileged() then
      raise exception
        'Only an admin can assign or change a carrier''s dispatcher (Rule 7).';
    end if;

    -- Handoff auto-move (PRD §5.2): first dispatcher assignment on a
    -- carrier whose documents are in flips it to Awaiting First Load,
    -- unless the caller set the status explicitly in the same update.
    if old.dispatcher_id is null
       and new.dispatcher_id is not null
       and new.status = old.status
       and old.status = 'Documents Received' then
      new.status := 'Signed — Awaiting First Load';
      new.date_assigned := coalesce(new.date_assigned, current_date);
    end if;

    -- Stamp the moment status changes (used by the stalled-sale metric).
    if new.status is distinct from old.status then
      new.status_changed_at := now();
    end if;

    -- Rule 3: reject illegal jumps for ordinary users; admins bypass.
    if new.status is distinct from old.status
       and not app_is_privileged()
       and not carrier_transition_allowed(old.status, new.status) then
      raise exception
        'Illegal status change: % → % (Rule 3). Ask an admin to make corrections.',
        old.status, new.status;
    end if;
  end if;

  -- Rule 1: Active is only ever valid when a Delivered load exists for
  -- this carrier. Applies to INSERT and UPDATE, to EVERYONE (admins too):
  -- no human can mark a carrier Active by hand.
  if new.status = 'Active'
     and not exists (
       select 1 from loads
       where loads.carrier_id = new.id
         and loads.load_status = 'Delivered'
     ) then
    raise exception
      'A carrier becomes Active only when one of its loads is Delivered (Rule 1). This is automatic.';
  end if;

  return new;
end;
$$;

create trigger carriers_before_write
  before insert or update on carriers
  for each row execute function carriers_before_write();


-- ---------------------------------------------------------------------
-- carriers: AFTER INSERT/UPDATE — log history (Rules 4 & 7)
-- SECURITY DEFINER so history is always written, even once RLS is on.
-- ---------------------------------------------------------------------
create or replace function carriers_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text := nullif(current_setting('unisole.change_reason', true), '');
begin
  if tg_op = 'INSERT' then
    -- Record the opening status of every sale (old = null).
    insert into carrier_status_history (carrier_id, old_status, new_status, changed_by, reason)
    values (new.id, null, new.status, app_actor(), v_reason);

    if new.dispatcher_id is not null then
      insert into carrier_dispatcher_history
        (carrier_id, old_dispatcher_id, new_dispatcher_id, changed_by, reason)
      values (new.id, null, new.dispatcher_id, app_actor(), v_reason);
    end if;

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into carrier_status_history (carrier_id, old_status, new_status, changed_by, reason)
      values (new.id, old.status, new.status, app_actor(), v_reason);
    end if;

    if new.dispatcher_id is distinct from old.dispatcher_id then
      insert into carrier_dispatcher_history
        (carrier_id, old_dispatcher_id, new_dispatcher_id, changed_by, reason)
      values (new.id, old.dispatcher_id, new.dispatcher_id, app_actor(), v_reason);
    end if;
  end if;

  return null;
end;
$$;

create trigger carriers_after_write
  after insert or update on carriers
  for each row execute function carriers_after_write();


-- ---------------------------------------------------------------------
-- loads: AFTER INSERT/UPDATE — auto-flip carrier to Active (Rule 1)
-- SECURITY DEFINER so it works regardless of who books the load.
-- This is the ONLY code path that produces an Active carrier.
-- ---------------------------------------------------------------------
create or replace function loads_activate_carrier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.load_status = 'Delivered'
     and (tg_op = 'INSERT' or old.load_status is distinct from 'Delivered') then

    -- Flag this as a system-driven change so the carrier lifecycle trigger
    -- permits the move to Active. The Active guard (delivered load exists)
    -- still applies — and it now passes, because this row is delivered.
    perform set_config('unisole.system_action', 'on', true);

    update carriers
       set status = 'Active',
           first_load_delivered_at =
             coalesce(first_load_delivered_at, new.delivery_date, current_date)
     where id = new.carrier_id
       and status <> 'Active';

    perform set_config('unisole.system_action', 'off', true);
  end if;

  return null;
end;
$$;

create trigger loads_activate_carrier
  after insert or update on loads
  for each row execute function loads_activate_carrier();


-- =====  supabase/migrations/20260712090600_indexes.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — Phase A, migration 7: indexes
-- =====================================================================
-- Indexes make the common lookups instant. (Some are already created
-- next to their tables; these are the carrier-side ones that power the
-- dashboards and access filtering.)
-- =====================================================================

-- Stalled-sale metric (Rule 5) + pipeline counts: filter/sort by status
-- and how long it's been in that status.
create index on carriers (status);
create index on carriers (status, status_changed_at);

-- Access filtering + "my carriers" lists.
create index on carriers (sales_agent_id);
create index on carriers (dispatcher_id);

-- Sales-agent visibility boundary (sees only not-yet-active carriers) and
-- the "signed but never shipped" question.
create index on carriers (first_load_delivered_at);

-- Sales-agent monthly target: carriers signed (docs received) per month.
create index on carriers (docs_received_at);


-- =====  supabase/migrations/20260712090700_rls.sql  =====
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


-- =====  supabase/migrations/20260712090800_reporting.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — Phase B, migration 9: reporting views & functions
-- =====================================================================
-- The dashboards read from here so nothing is ever totalled by hand
-- (PRD §5.4, §6). Two kinds of object:
--
--   * VIEWS with security_invoker = on — respect the caller's RLS, so a
--     dispatcher sees only their slice, an admin sees all.
--   * FUNCTIONS (SECURITY DEFINER, access-guarded) for the monthly target
--     numbers, which must count ALL of a person's records regardless of
--     row visibility (Rule 6: an agent keeps credit for carriers that have
--     since gone Active and left their view).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Rule 5 — the stalled-sale headline. Carriers signed but not yet shipped.
-- ---------------------------------------------------------------------
create view stalled_carriers with (security_invoker = true) as
select
  c.id                                          as carrier_id,
  c.company_name,
  c.status_changed_at,
  (current_date - c.status_changed_at::date)    as days_stalled,
  c.dispatcher_id,
  d.real_name                                   as dispatcher_name,
  d.alias                                       as dispatcher_alias,
  c.sales_agent_id,
  sa.real_name                                  as sales_agent_name
from carriers c
left join dispatchers  d  on d.id  = c.dispatcher_id
left join sales_agents sa on sa.id = c.sales_agent_id
where c.status = 'Signed — Awaiting First Load'
order by days_stalled desc;

comment on view stalled_carriers is
  'Headline metric (Rule 5): who signed but never shipped, how long, under which dispatcher.';


-- ---------------------------------------------------------------------
-- Pipeline counts — how many carriers sit at each status.
-- ---------------------------------------------------------------------
create view carrier_pipeline_counts with (security_invoker = true) as
select status, count(*) as carriers
from carriers
group by status;


-- ---------------------------------------------------------------------
-- Follow-up health — last contact & count per carrier.
-- ---------------------------------------------------------------------
create view followup_health with (security_invoker = true) as
select
  c.id                                       as carrier_id,
  c.company_name,
  c.sales_agent_id,
  count(f.id)                                as total_followups,
  max(f.contacted_at)                        as last_followup_at,
  case when max(f.contacted_at) is not null
       then (current_date - max(f.contacted_at)::date)
  end                                        as days_since_last_followup
from carriers c
left join follow_ups f on f.carrier_id = c.id
group by c.id, c.company_name, c.sales_agent_id;


-- ---------------------------------------------------------------------
-- Dispatch strength — performance by lane (pickup → delivery).
-- ---------------------------------------------------------------------
create view dispatch_strength_by_lane with (security_invoker = true) as
select
  pickup_location,
  delivery_location,
  count(*)              as loads,
  avg(rate)             as avg_rate,
  sum(rate)             as total_rate,
  sum(amount_earned)    as total_earned
from loads
group by pickup_location, delivery_location;


-- ---------------------------------------------------------------------
-- Monthly target progress (Rule 6). SECURITY DEFINER so the count covers
-- ALL of the person's records, then an access guard limits WHO can ask.
-- p_month can be any date inside the month of interest.
-- ---------------------------------------------------------------------

-- Sales agent: carriers whose documents were received in the month.
create or replace function sales_agent_month_signed(p_agent_id bigint, p_month date)
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_is_admin() or p_agent_id = app_agent_id()) then
    raise exception 'Not allowed to view this agent''s progress.';
  end if;
  return (
    select count(*)::int from carriers
    where sales_agent_id = p_agent_id
      and docs_received_at >= date_trunc('month', p_month)::date
      and docs_received_at <  (date_trunc('month', p_month) + interval '1 month')::date
  );
end; $$;

-- Dispatcher: dollars earned on loads picked up in the month (decision #3).
create or replace function dispatcher_month_earned(p_dispatcher_id bigint, p_month date)
returns numeric language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_is_admin() or p_dispatcher_id = app_dispatcher_id()) then
    raise exception 'Not allowed to view this dispatcher''s progress.';
  end if;
  return (
    select coalesce(sum(amount_earned), 0) from loads
    where dispatcher_id = p_dispatcher_id
      and pickup_date >= date_trunc('month', p_month)::date
      and pickup_date <  (date_trunc('month', p_month) + interval '1 month')::date
  );
end; $$;

-- Admin dashboard: every agent vs target for a month.
create or replace function admin_sales_progress(p_month date)
returns table (sales_agent_id bigint, real_name text, monthly_target integer, carriers_signed integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Admin only.'; end if;
  return query
    select sa.id, sa.real_name, sa.monthly_target,
      (select count(*)::int from carriers c
       where c.sales_agent_id = sa.id
         and c.docs_received_at >= date_trunc('month', p_month)::date
         and c.docs_received_at <  (date_trunc('month', p_month) + interval '1 month')::date)
    from sales_agents sa
    where sa.is_active
    order by sa.real_name;
end; $$;

-- Admin dashboard: every dispatcher vs target for a month.
create or replace function admin_dispatcher_progress(p_month date)
returns table (dispatcher_id bigint, real_name text, monthly_target numeric, earned numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Admin only.'; end if;
  return query
    select d.id, d.real_name, d.monthly_target,
      (select coalesce(sum(l.amount_earned), 0) from loads l
       where l.dispatcher_id = d.id
         and l.pickup_date >= date_trunc('month', p_month)::date
         and l.pickup_date <  (date_trunc('month', p_month) + interval '1 month')::date)
    from dispatchers d
    where d.is_active
    order by d.real_name;
end; $$;


-- ---------------------------------------------------------------------
-- Grants: let logged-in users read the views and call the functions.
-- (RLS on the underlying tables still limits what the views return.)
-- ---------------------------------------------------------------------
grant select on stalled_carriers, carrier_pipeline_counts, followup_health,
                dispatch_strength_by_lane
  to authenticated;

grant execute on function sales_agent_month_signed(bigint, date)   to authenticated;
grant execute on function dispatcher_month_earned(bigint, date)    to authenticated;
grant execute on function admin_sales_progress(date)               to authenticated;
grant execute on function admin_dispatcher_progress(date)          to authenticated;


-- =====  supabase/seed.sql  =====
-- =====================================================================
-- UniSole Dispatch CRM — seed data
-- =====================================================================
-- Runs on `supabase db reset`. Keep this to safe, stable reference data.
-- =====================================================================

-- Truck types (known values so far — the business will add more from the
-- admin screen later). Idempotent so re-seeding doesn't duplicate.
insert into truck_types (code, description) values
  ('SD',     'Step Deck'),
  ('SBT',    'Straight Box Truck'),
  ('SBT/DV', 'Straight Box Truck / Dry Van'),
  ('PO',     'Power Only'),
  ('DV',     'Dry Van')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Creating the first admin (do this once, manually — cannot be pure SQL
-- because the login lives in Supabase Auth, not in our tables):
--
--   1. In the Supabase dashboard → Authentication → Users → "Add user",
--      create the admin's email + password. Copy the new user's UUID.
--   2. Run (replacing the UUID and email):
--
--        insert into profiles (id, email, role)
--        values ('00000000-0000-0000-0000-000000000000',
--                'admin@unisole.example', 'admin');
--
-- After that, the admin can create sales agents, dispatchers, and their
-- logins from inside the app.
-- ---------------------------------------------------------------------

