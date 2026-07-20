-- =====================================================================
-- UniSole Dispatch CRM — admin approval workflow (change requests)
-- =====================================================================
-- Everyone EXCEPT admin now files a "change request" for four actions —
-- create carrier, create load, change a load's status, change a carrier's
-- status — instead of changing the system directly. An admin approves
-- (which applies the change) or rejects it. Requests are created by the
-- app; the actual mutation on approval is performed by the admin, so it
-- passes the existing RLS unchanged.
-- Safe to run once.
-- =====================================================================

create table if not exists change_requests (
  id           bigint generated always as identity primary key,
  requested_by uuid not null references profiles (id) on delete cascade,
  kind         text not null check (kind in
                 ('create_carrier', 'create_load', 'set_load_status', 'set_carrier_status')),
  payload      jsonb not null,          -- the proposed data / patch
  target_id    bigint,                  -- for updates: the carrier/load id
  summary      text,                    -- human-readable line for the queue
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references profiles (id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists change_requests_status_idx on change_requests (status, created_at desc);
create index if not exists change_requests_requester_idx on change_requests (requested_by, created_at desc);

alter table change_requests enable row level security;

-- A requester sees their own requests; an admin sees all.
drop policy if exists change_requests_select on change_requests;
create policy change_requests_select on change_requests for select to authenticated
  using (app_is_admin() or requested_by = auth.uid());

-- Anyone signed in may file a request, but only as themselves and only in
-- the 'pending' state (they can't self-approve).
drop policy if exists change_requests_insert on change_requests;
create policy change_requests_insert on change_requests for insert to authenticated
  with check (requested_by = auth.uid() and status = 'pending');

-- Only an admin may review (approve / reject).
drop policy if exists change_requests_update on change_requests;
create policy change_requests_update on change_requests for update to authenticated
  using (app_is_admin()) with check (app_is_admin());
