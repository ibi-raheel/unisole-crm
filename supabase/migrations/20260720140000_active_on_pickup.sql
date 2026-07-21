-- =====================================================================
-- UniSole Dispatch CRM — activate on PICKUP instead of delivery
-- =====================================================================
-- Business change (owner decision): a carrier now becomes Active the moment
-- it picks up a load — i.e. as soon as a load is booked (default En Route) —
-- instead of waiting for the load to be Delivered. Active is still automatic
-- and still cannot be set by hand. Safe to run once.
-- =====================================================================

-- The ONLY path to Active: booking a load. Fires on any load insert/update;
-- if the carrier isn't Active yet, it becomes Active immediately.
create or replace function loads_activate_carrier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('unisole.system_action', 'on', true);
  update carriers
     set status = 'Active',
         first_load_delivered_at =
           coalesce(first_load_delivered_at, new.pickup_date, current_date)
   where id = new.carrier_id
     and status <> 'Active';
  perform set_config('unisole.system_action', 'off', true);
  return null;
end;
$$;

-- Rule 1 guard: Active is valid once ANY load exists for the carrier
-- (pickup), not only a Delivered one. Recreates the full trigger with just
-- that condition changed (keeps head-reassignment permissions + logging).
create or replace function carriers_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.sales_agent_id is distinct from old.sales_agent_id
       and not (app_is_admin() or app_is_sales_head()) then
      raise exception 'Only an admin or sales head can change a carrier''s sales agent.';
    end if;

    if new.dispatcher_id is distinct from old.dispatcher_id
       and not (app_is_privileged() or app_is_dispatch_head()) then
      raise exception 'Only an admin or dispatch head can assign or change a carrier''s dispatcher.';
    end if;

    if new.status is distinct from old.status
       and not app_is_privileged()
       and not carrier_transition_allowed(old.status, new.status) then
      raise exception 'Illegal status change: % → % (Rule 3). Ask an admin to make corrections.',
        old.status, new.status;
    end if;

    if new.dispatcher_id is not null and new.status = 'Documents Received' then
      new.status := 'Signed — Awaiting First Load';
      new.date_assigned := coalesce(new.date_assigned, current_date);
    end if;

    if new.status is distinct from old.status then
      new.status_changed_at := now();
    end if;
  end if;

  if new.status = 'Active'
     and not exists (select 1 from loads where loads.carrier_id = new.id) then
    raise exception
      'A carrier becomes Active only when it picks up a load. This is automatic.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Sales head may create carriers (needed for the Excel lead import), on
-- behalf of any agent. Agents still only create their own; admins any.
-- ---------------------------------------------------------------------
drop policy if exists carriers_insert on carriers;
create policy carriers_insert on carriers for insert to authenticated
  with check (
    app_is_admin() or app_is_sales_head() or sales_agent_id = app_agent_id()
  );
