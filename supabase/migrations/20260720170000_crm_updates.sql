-- =====================================================================
-- UniSole Dispatch CRM — CRM updates batch
-- =====================================================================
--  1) Sales agents can change the status of their own (pre-active) leads
--     again — and log follow-ups on them. (They still can't ADD carriers;
--     the sales head does that.)
--  2) Audit table for admin edits to a load's amount, with a reason.
-- Safe to run once.
-- =====================================================================

-- 1) carriers: agent may update their own pre-active carriers again.
drop policy if exists carriers_update on carriers;
create policy carriers_update on carriers for update to authenticated
  using (
    app_is_admin() or app_is_sales_head() or app_is_dispatch_head()
    or (sales_agent_id = app_agent_id() and first_load_delivered_at is null)
  )
  with check (
    app_is_admin() or app_is_sales_head() or app_is_dispatch_head()
    or (sales_agent_id = app_agent_id() and first_load_delivered_at is null)
  );

-- follow-ups writable by agent (own carriers) again, plus admin / sales head.
drop policy if exists follow_ups_all on follow_ups;
create policy follow_ups_all on follow_ups for all to authenticated
  using (app_is_admin() or app_is_sales_head() or sales_agent_id = app_agent_id())
  with check (
    app_is_admin() or app_is_sales_head()
    or (sales_agent_id = app_agent_id() and app_can_see_carrier(carrier_id))
  );

-- 2) load amount-change audit: who changed a load's rate, from/to, and why.
create table if not exists load_amount_changes (
  id         bigint generated always as identity primary key,
  load_id    bigint not null references loads (id),
  old_rate   numeric(14,2),
  new_rate   numeric(14,2),
  reason     text,
  changed_by uuid references profiles (id),
  changed_at timestamptz not null default now()
);
create index if not exists load_amount_changes_idx on load_amount_changes (load_id, changed_at desc);

alter table load_amount_changes enable row level security;

-- Readable by anyone who can see the load's carrier; only admins record one.
drop policy if exists load_amount_changes_select on load_amount_changes;
create policy load_amount_changes_select on load_amount_changes for select to authenticated
  using (app_can_see_carrier((select l.carrier_id from loads l where l.id = load_id)));

drop policy if exists load_amount_changes_insert on load_amount_changes;
create policy load_amount_changes_insert on load_amount_changes for insert to authenticated
  with check (app_is_admin());
