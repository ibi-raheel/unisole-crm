-- =====================================================================
-- UniSole Dispatch CRM — sales_head & dispatch_head (part 2/2)
-- =====================================================================
-- Run AFTER 20260715180000_head_roles_enum.sql (the enum values must be
-- committed first). This migration is authoritative for the carrier/loads
-- read policies, so it also delivers the "sales agent keeps read-only view
-- after handoff" behaviour (supersedes 20260715170000).
--
-- Model:
--   sales_head    — sees the whole sales side; may reassign a carrier's
--                   sales agent (relaxes the old immutability rule) and edit
--                   carriers. Every agent change is logged.
--   dispatch_head — sees the whole dispatch side; may reassign a carrier's
--                   dispatcher and manage all loads / dispatch notes.
--   admin         — everything, incl. the first sales→dispatch handoff and
--                   creating logins. (unchanged)
-- Heads link to no specific agent/dispatcher (like admin).
-- =====================================================================

-- ---- profiles: heads link to neither agent nor dispatcher -----------
alter table profiles drop constraint if exists profiles_role_link_ck;
alter table profiles add constraint profiles_role_link_ck check (
  (role = 'sales_agent' and linked_agent_id is not null and linked_dispatcher_id is null) or
  (role = 'dispatcher'  and linked_dispatcher_id is not null and linked_agent_id is null) or
  (role in ('admin', 'system', 'sales_head', 'dispatch_head')
     and linked_agent_id is null and linked_dispatcher_id is null)
);

-- ---- identity helpers (SECURITY DEFINER, bypass profiles' own RLS) ---
create or replace function app_is_sales_head()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'sales_head');
$$;

create or replace function app_is_dispatch_head()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'dispatch_head');
$$;

-- ---- who can "see" a carrier (drives child-table read policies) ------
-- Admin + both heads see all; the owning agent sees theirs (active or not);
-- the assigned dispatcher sees theirs. WRITE policies that also call this
-- keep their own dispatcher_id/sales_agent_id guards, so read access here
-- grants no extra write power.
create or replace function app_can_see_carrier(p_carrier_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from carriers c
    where c.id = p_carrier_id and (
      app_is_admin()
      or app_is_sales_head()
      or app_is_dispatch_head()
      or c.sales_agent_id = app_agent_id()
      or c.dispatcher_id = app_dispatcher_id()
    )
  );
$$;

-- ---- log of sales-agent reassignments (parallel to dispatcher history) -
create table if not exists carrier_agent_history (
  id           bigint generated always as identity primary key,
  carrier_id   bigint not null references carriers (id),
  old_agent_id bigint references sales_agents (id),
  new_agent_id bigint references sales_agents (id),
  changed_by   uuid references profiles (id),
  reason       text,
  changed_at   timestamptz not null default now()
);
create index if not exists carrier_agent_history_idx on carrier_agent_history (carrier_id, changed_at desc);
alter table carrier_agent_history enable row level security;
drop policy if exists agent_history_select on carrier_agent_history;
create policy agent_history_select on carrier_agent_history for select to authenticated
  using (app_can_see_carrier(carrier_id));

-- ---- carriers: read + write --------------------------------------------
drop policy if exists carriers_select on carriers;
create policy carriers_select on carriers for select to authenticated
  using (
    app_is_admin()
    or app_is_sales_head()
    or app_is_dispatch_head()
    or sales_agent_id = app_agent_id()
    or dispatcher_id = app_dispatcher_id()
  );

drop policy if exists carriers_update on carriers;
create policy carriers_update on carriers for update to authenticated
  using (
    app_is_admin()
    or app_is_sales_head()
    or app_is_dispatch_head()
    or (sales_agent_id = app_agent_id() and first_load_delivered_at is null)
  )
  with check (
    app_is_admin()
    or app_is_sales_head()
    or app_is_dispatch_head()
    or (sales_agent_id = app_agent_id() and first_load_delivered_at is null)
  );

-- ---- loads: dispatch_head manages all; anyone who can see the carrier reads
drop policy if exists loads_all on loads;
create policy loads_all on loads for all to authenticated
  using (app_is_admin() or app_is_dispatch_head() or dispatcher_id = app_dispatcher_id())
  with check (
    app_is_admin()
    or app_is_dispatch_head()
    or (dispatcher_id = app_dispatcher_id() and app_can_see_carrier(carrier_id))
  );

drop policy if exists loads_visible_read on loads;
create policy loads_visible_read on loads for select to authenticated
  using (app_can_see_carrier(carrier_id));

-- ---- dispatch notes: dispatch_head manages all ----------------------
drop policy if exists dispatch_notes_all on carrier_dispatch_notes;
create policy dispatch_notes_all on carrier_dispatch_notes for all to authenticated
  using (app_is_admin() or app_is_dispatch_head() or dispatcher_id = app_dispatcher_id())
  with check (
    app_is_admin()
    or app_is_dispatch_head()
    or (dispatcher_id = app_dispatcher_id() and app_can_see_carrier(carrier_id))
  );

-- ---- follow-ups: sales_head manages all -----------------------------
drop policy if exists follow_ups_all on follow_ups;
create policy follow_ups_all on follow_ups for all to authenticated
  using (app_is_admin() or app_is_sales_head() or sales_agent_id = app_agent_id())
  with check (
    app_is_admin()
    or app_is_sales_head()
    or (sales_agent_id = app_agent_id() and app_can_see_carrier(carrier_id))
  );

-- ---- presence / activity: heads see their own team ------------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated
  using (
    id = auth.uid()
    or app_is_admin()
    or (app_is_sales_head() and role = 'sales_agent')
    or (app_is_dispatch_head() and role = 'dispatcher')
  );

drop policy if exists auth_events_select on auth_events;
create policy auth_events_select on auth_events for select to authenticated
  using (
    app_is_admin()
    or profile_id = auth.uid()
    or (app_is_sales_head() and exists (
          select 1 from profiles p where p.id = auth_events.profile_id and p.role = 'sales_agent'))
    or (app_is_dispatch_head() and exists (
          select 1 from profiles p where p.id = auth_events.profile_id and p.role = 'dispatcher'))
  );

-- ---- dashboards: let heads read the target leaderboards -------------
create or replace function admin_sales_progress(p_month date)
returns table (sales_agent_id bigint, real_name text, monthly_target integer, carriers_signed integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_is_admin() or app_is_sales_head() or app_is_dispatch_head()) then
    raise exception 'Not allowed.';
  end if;
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

create or replace function admin_dispatcher_progress(p_month date)
returns table (dispatcher_id bigint, real_name text, monthly_target numeric, earned numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_is_admin() or app_is_sales_head() or app_is_dispatch_head()) then
    raise exception 'Not allowed.';
  end if;
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

-- ---- triggers: permit head reassignments + log agent changes --------
create or replace function carriers_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    -- Sales agent may now be changed by an admin or a sales_head (logged in
    -- the AFTER trigger). Everyone else is still blocked.
    if new.sales_agent_id is distinct from old.sales_agent_id
       and not (app_is_admin() or app_is_sales_head()) then
      raise exception
        'Only an admin or sales head can change a carrier''s sales agent.';
    end if;

    -- Dispatcher may be set/changed by admin/system (privileged) or a
    -- dispatch_head. Ordinary users cannot.
    if new.dispatcher_id is distinct from old.dispatcher_id
       and not (app_is_privileged() or app_is_dispatch_head()) then
      raise exception
        'Only an admin or dispatch head can assign or change a carrier''s dispatcher.';
    end if;

    -- Rule 3: validate the user's own status change (before the system move).
    if new.status is distinct from old.status
       and not app_is_privileged()
       and not carrier_transition_allowed(old.status, new.status) then
      raise exception
        'Illegal status change: % → % (Rule 3). Ask an admin to make corrections.',
        old.status, new.status;
    end if;

    -- Handoff auto-move (PRD §5.2).
    if new.dispatcher_id is not null
       and new.status = 'Documents Received' then
      new.status := 'Signed — Awaiting First Load';
      new.date_assigned := coalesce(new.date_assigned, current_date);
    end if;

    if new.status is distinct from old.status then
      new.status_changed_at := now();
    end if;
  end if;

  -- Rule 1: Active only ever valid with a Delivered load. Applies to everyone.
  if new.status = 'Active'
     and not exists (
       select 1 from loads
       where loads.carrier_id = new.id and loads.load_status = 'Delivered'
     ) then
    raise exception
      'A carrier becomes Active only when one of its loads is Delivered (Rule 1). This is automatic.';
  end if;

  return new;
end; $$;

create or replace function carriers_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reason text := nullif(current_setting('unisole.change_reason', true), '');
begin
  if tg_op = 'INSERT' then
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
    -- NEW: log sales-agent reassignments.
    if new.sales_agent_id is distinct from old.sales_agent_id then
      insert into carrier_agent_history
        (carrier_id, old_agent_id, new_agent_id, changed_by, reason)
      values (new.id, old.sales_agent_id, new.sales_agent_id, app_actor(), v_reason);
    end if;
  end if;

  return null;
end; $$;
