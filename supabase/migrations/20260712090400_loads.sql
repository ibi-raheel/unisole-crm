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
