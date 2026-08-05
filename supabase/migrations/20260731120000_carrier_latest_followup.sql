-- =====================================================================
-- Efficient "latest follow-up per carrier" for the carriers list.
-- =====================================================================
-- The carriers list previously fetched ALL follow-ups for the 50 visible
-- carriers and reduced in JS — which grows unbounded as agents log more
-- follow-ups ("after some time of dialing the list stops loading"). This
-- view returns exactly one row per carrier (its most recent follow-up),
-- backed by an index so it stays fast at any volume. security_invoker so
-- row-level security still applies (viewers see only follow-ups they can read).
-- Safe to run once.
-- =====================================================================

create index if not exists follow_ups_carrier_contacted_idx
  on follow_ups (carrier_id, contacted_at desc);

create or replace view carrier_latest_followup with (security_invoker = true) as
  select distinct on (carrier_id) carrier_id, type, contacted_at
  from follow_ups
  order by carrier_id, contacted_at desc;

grant select on carrier_latest_followup to authenticated;
