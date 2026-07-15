-- =====================================================================
-- UniSole Dispatch CRM — RLS hardening (security review)
-- =====================================================================
-- Before: the loads / dispatch-notes / follow-ups write policies only
-- checked that the row's dispatcher_id (or sales_agent_id) was the caller's
-- own id — NOT that the caller was actually related to the carrier. Because
-- carrier ids are sequential/guessable, an authenticated dispatcher could
-- INSERT loads (or notes) against carriers they were never assigned to —
-- inflating their own earnings/targets and even flipping a carrier Active.
-- A sales agent could likewise attach follow-ups to carriers they don't own.
--
-- Fix: tighten each WITH CHECK (insert/update) to also require
-- app_can_see_carrier(carrier_id) — i.e. the carrier must actually be theirs
-- (assigned dispatcher / owning agent) or the caller must be an admin. The
-- USING (read) clause is left unchanged so history stays visible.
--
-- Legitimate flows are unaffected: dispatchers only book loads on carriers
-- assigned to them, agents only follow up on their own carriers. Admins are
-- unrestricted. Safe to run once (drops + recreates the three policies).
-- =====================================================================

-- ---- loads ----------------------------------------------------------
drop policy if exists loads_all on loads;
create policy loads_all on loads for all to authenticated
  using (app_is_admin() or dispatcher_id = app_dispatcher_id())
  with check (
    app_is_admin()
    or (dispatcher_id = app_dispatcher_id() and app_can_see_carrier(carrier_id))
  );

-- ---- carrier_dispatch_notes -----------------------------------------
drop policy if exists dispatch_notes_all on carrier_dispatch_notes;
create policy dispatch_notes_all on carrier_dispatch_notes for all to authenticated
  using (app_is_admin() or dispatcher_id = app_dispatcher_id())
  with check (
    app_is_admin()
    or (dispatcher_id = app_dispatcher_id() and app_can_see_carrier(carrier_id))
  );

-- ---- follow_ups -----------------------------------------------------
drop policy if exists follow_ups_all on follow_ups;
create policy follow_ups_all on follow_ups for all to authenticated
  using (app_is_admin() or sales_agent_id = app_agent_id())
  with check (
    app_is_admin()
    or (sales_agent_id = app_agent_id() and app_can_see_carrier(carrier_id))
  );
