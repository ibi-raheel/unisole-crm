-- =====================================================================
-- UniSole Dispatch CRM — manager-driven sales model
-- =====================================================================
-- New role split:
--   * Sales agent  -> VIEW ONLY. They only see their own carriers and
--                     performance; they can no longer add carriers, change
--                     status, or log follow-ups.
--   * Sales head   -> the manager: adds carriers for agents and updates
--                     their status (Dead / revive, etc). (Active is still
--                     automatic on pickup and cannot be set by hand.)
-- Enforced at the database, not just the UI. Safe to run once.
-- =====================================================================

-- carriers: only admin / sales head create carriers (agents are view-only).
drop policy if exists carriers_insert on carriers;
create policy carriers_insert on carriers for insert to authenticated
  with check (app_is_admin() or app_is_sales_head());

-- carriers: only admin / sales head / dispatch head update carriers.
-- (Agents can no longer edit; heads handle their side's changes.)
drop policy if exists carriers_update on carriers;
create policy carriers_update on carriers for update to authenticated
  using (app_is_admin() or app_is_sales_head() or app_is_dispatch_head())
  with check (app_is_admin() or app_is_sales_head() or app_is_dispatch_head());

-- follow_ups: agents may still READ follow-ups on their own carriers (for
-- their performance view), but only admin / sales head may WRITE them.
drop policy if exists follow_ups_all on follow_ups;
create policy follow_ups_all on follow_ups for all to authenticated
  using (app_is_admin() or app_is_sales_head() or sales_agent_id = app_agent_id())
  with check (app_is_admin() or app_is_sales_head());
