-- =====================================================================
-- UniSole Dispatch CRM — sales agents keep READ-ONLY view after handoff
-- =====================================================================
-- Previously a sales agent lost sight of a carrier the moment it went
-- Active (first_load_delivered_at set) — it "handed off" to the dispatcher.
-- Business decision: the agent who signed a carrier should still be able to
-- SEE it (and its loads/history) forever, read-only. Editing an active
-- carrier, and every dispatch/load WRITE, remain blocked for agents.
--
-- Safe to run once (drops + recreates policies / replaces one function).
-- =====================================================================

-- 1) carriers — agent may SELECT all carriers they signed (active or not).
--    NOTE: the carriers_update policy is intentionally left unchanged, so an
--    agent still cannot edit a carrier once it is Active.
drop policy if exists carriers_select on carriers;
create policy carriers_select on carriers for select to authenticated
  using (
    app_is_admin()
    or sales_agent_id = app_agent_id()
    or dispatcher_id = app_dispatcher_id()
  );

-- 2) visibility helper — the owning agent can "see" the carrier regardless of
--    Active status. This drives status/dispatcher-history reads. The dispatch
--    and load WRITE policies that also call this STILL require
--    dispatcher_id = app_dispatcher_id(), so an agent gains no write power over
--    dispatch data — a dispatcher's app_agent_id() is null, so the new agent
--    clause never helps them either (the load-booking hardening is preserved).
create or replace function app_can_see_carrier(p_carrier_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from carriers c
    where c.id = p_carrier_id and (
      app_is_admin()
      or c.sales_agent_id = app_agent_id()
      or c.dispatcher_id = app_dispatcher_id()
    )
  );
$$;

-- 3) loads — anyone who can see the carrier may READ its loads. This is a
--    SELECT-only policy (additive), so the owning agent can view loads on the
--    carrier detail page without gaining update/delete on them.
drop policy if exists loads_visible_read on loads;
create policy loads_visible_read on loads for select to authenticated
  using (app_can_see_carrier(carrier_id));
