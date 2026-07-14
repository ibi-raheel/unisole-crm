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
