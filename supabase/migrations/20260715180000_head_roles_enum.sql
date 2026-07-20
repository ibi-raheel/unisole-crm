-- =====================================================================
-- UniSole Dispatch CRM — new roles: sales_head, dispatch_head (part 1/2)
-- =====================================================================
-- Postgres will not let a brand-new enum value be USED in the same
-- transaction that adds it, so the ADD VALUE statements live in their own
-- migration. RUN THIS FIRST, on its own, then run the _head_roles.sql part.
-- =====================================================================

alter type user_role add value if not exists 'sales_head';
alter type user_role add value if not exists 'dispatch_head';
