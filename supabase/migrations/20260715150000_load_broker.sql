-- =====================================================================
-- UniSole Dispatch CRM — broker information on loads
-- =====================================================================
-- A load is sourced from a freight broker. Dispatchers record who the
-- broker is when booking the load. All optional free text. RLS and the
-- existing loads policies apply unchanged.
-- Safe to run once.
-- =====================================================================

alter table loads add column if not exists broker_name    text;  -- brokerage / company
alter table loads add column if not exists broker_mc      text;  -- broker MC# (authority)
alter table loads add column if not exists broker_contact text;  -- person / phone / email
