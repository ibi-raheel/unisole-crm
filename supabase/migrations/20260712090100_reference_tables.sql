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
