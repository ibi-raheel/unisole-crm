-- =====================================================================
-- UniSole Dispatch CRM — Phase A, migration 7: indexes
-- =====================================================================
-- Indexes make the common lookups instant. (Some are already created
-- next to their tables; these are the carrier-side ones that power the
-- dashboards and access filtering.)
-- =====================================================================

-- Stalled-sale metric (Rule 5) + pipeline counts: filter/sort by status
-- and how long it's been in that status.
create index on carriers (status);
create index on carriers (status, status_changed_at);

-- Access filtering + "my carriers" lists.
create index on carriers (sales_agent_id);
create index on carriers (dispatcher_id);

-- Sales-agent visibility boundary (sees only not-yet-active carriers) and
-- the "signed but never shipped" question.
create index on carriers (first_load_delivered_at);

-- Sales-agent monthly target: carriers signed (docs received) per month.
create index on carriers (docs_received_at);
