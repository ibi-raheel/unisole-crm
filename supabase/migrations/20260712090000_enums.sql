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
