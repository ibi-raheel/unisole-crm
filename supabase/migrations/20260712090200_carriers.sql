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
