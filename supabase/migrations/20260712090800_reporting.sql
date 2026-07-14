-- =====================================================================
-- UniSole Dispatch CRM — Phase B, migration 9: reporting views & functions
-- =====================================================================
-- The dashboards read from here so nothing is ever totalled by hand
-- (PRD §5.4, §6). Two kinds of object:
--
--   * VIEWS with security_invoker = on — respect the caller's RLS, so a
--     dispatcher sees only their slice, an admin sees all.
--   * FUNCTIONS (SECURITY DEFINER, access-guarded) for the monthly target
--     numbers, which must count ALL of a person's records regardless of
--     row visibility (Rule 6: an agent keeps credit for carriers that have
--     since gone Active and left their view).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Rule 5 — the stalled-sale headline. Carriers signed but not yet shipped.
-- ---------------------------------------------------------------------
create view stalled_carriers with (security_invoker = true) as
select
  c.id                                          as carrier_id,
  c.company_name,
  c.status_changed_at,
  (current_date - c.status_changed_at::date)    as days_stalled,
  c.dispatcher_id,
  d.real_name                                   as dispatcher_name,
  d.alias                                       as dispatcher_alias,
  c.sales_agent_id,
  sa.real_name                                  as sales_agent_name
from carriers c
left join dispatchers  d  on d.id  = c.dispatcher_id
left join sales_agents sa on sa.id = c.sales_agent_id
where c.status = 'Signed — Awaiting First Load'
order by days_stalled desc;

comment on view stalled_carriers is
  'Headline metric (Rule 5): who signed but never shipped, how long, under which dispatcher.';


-- ---------------------------------------------------------------------
-- Pipeline counts — how many carriers sit at each status.
-- ---------------------------------------------------------------------
create view carrier_pipeline_counts with (security_invoker = true) as
select status, count(*) as carriers
from carriers
group by status;


-- ---------------------------------------------------------------------
-- Follow-up health — last contact & count per carrier.
-- ---------------------------------------------------------------------
create view followup_health with (security_invoker = true) as
select
  c.id                                       as carrier_id,
  c.company_name,
  c.sales_agent_id,
  count(f.id)                                as total_followups,
  max(f.contacted_at)                        as last_followup_at,
  case when max(f.contacted_at) is not null
       then (current_date - max(f.contacted_at)::date)
  end                                        as days_since_last_followup
from carriers c
left join follow_ups f on f.carrier_id = c.id
group by c.id, c.company_name, c.sales_agent_id;


-- ---------------------------------------------------------------------
-- Dispatch strength — performance by lane (pickup → delivery).
-- ---------------------------------------------------------------------
create view dispatch_strength_by_lane with (security_invoker = true) as
select
  pickup_location,
  delivery_location,
  count(*)              as loads,
  avg(rate)             as avg_rate,
  sum(rate)             as total_rate,
  sum(amount_earned)    as total_earned
from loads
group by pickup_location, delivery_location;


-- ---------------------------------------------------------------------
-- Monthly target progress (Rule 6). SECURITY DEFINER so the count covers
-- ALL of the person's records, then an access guard limits WHO can ask.
-- p_month can be any date inside the month of interest.
-- ---------------------------------------------------------------------

-- Sales agent: carriers whose documents were received in the month.
create or replace function sales_agent_month_signed(p_agent_id bigint, p_month date)
returns integer language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_is_admin() or p_agent_id = app_agent_id()) then
    raise exception 'Not allowed to view this agent''s progress.';
  end if;
  return (
    select count(*)::int from carriers
    where sales_agent_id = p_agent_id
      and docs_received_at >= date_trunc('month', p_month)::date
      and docs_received_at <  (date_trunc('month', p_month) + interval '1 month')::date
  );
end; $$;

-- Dispatcher: dollars earned on loads picked up in the month (decision #3).
create or replace function dispatcher_month_earned(p_dispatcher_id bigint, p_month date)
returns numeric language plpgsql stable security definer set search_path = public as $$
begin
  if not (app_is_admin() or p_dispatcher_id = app_dispatcher_id()) then
    raise exception 'Not allowed to view this dispatcher''s progress.';
  end if;
  return (
    select coalesce(sum(amount_earned), 0) from loads
    where dispatcher_id = p_dispatcher_id
      and pickup_date >= date_trunc('month', p_month)::date
      and pickup_date <  (date_trunc('month', p_month) + interval '1 month')::date
  );
end; $$;

-- Admin dashboard: every agent vs target for a month.
create or replace function admin_sales_progress(p_month date)
returns table (sales_agent_id bigint, real_name text, monthly_target integer, carriers_signed integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Admin only.'; end if;
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

-- Admin dashboard: every dispatcher vs target for a month.
create or replace function admin_dispatcher_progress(p_month date)
returns table (dispatcher_id bigint, real_name text, monthly_target numeric, earned numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not app_is_admin() then raise exception 'Admin only.'; end if;
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


-- ---------------------------------------------------------------------
-- Grants: let logged-in users read the views and call the functions.
-- (RLS on the underlying tables still limits what the views return.)
-- ---------------------------------------------------------------------
grant select on stalled_carriers, carrier_pipeline_counts, followup_health,
                dispatch_strength_by_lane
  to authenticated;

grant execute on function sales_agent_month_signed(bigint, date)   to authenticated;
grant execute on function dispatcher_month_earned(bigint, date)    to authenticated;
grant execute on function admin_sales_progress(date)               to authenticated;
grant execute on function admin_dispatcher_progress(date)          to authenticated;
