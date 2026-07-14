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

    -- Rule 3: validate the user's OWN status change first (before the system
    -- auto-move below), rejecting illegal jumps for ordinary users.
    if new.status is distinct from old.status
       and not app_is_privileged()
       and not carrier_transition_allowed(old.status, new.status) then
      raise exception
        'Illegal status change: % → % (Rule 3). Ask an admin to make corrections.',
        old.status, new.status;
    end if;

    -- Handoff auto-move (PRD §5.2): once a carrier is at "Documents Received"
    -- AND has a dispatcher, it becomes "Signed — Awaiting First Load". This
    -- fires whichever happens second — assigning the dispatcher, or reaching
    -- Documents Received — so the order they're done in doesn't matter.
    if new.dispatcher_id is not null
       and new.status = 'Documents Received' then
      new.status := 'Signed — Awaiting First Load';
      new.date_assigned := coalesce(new.date_assigned, current_date);
    end if;

    -- Stamp the moment status changes (used by the stalled-sale metric).
    if new.status is distinct from old.status then
      new.status_changed_at := now();
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
