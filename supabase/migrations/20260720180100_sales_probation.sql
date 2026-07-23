-- =====================================================================
-- Probation sales role — a distinct sales login category.
-- =====================================================================
-- A sales_probation login links to a sales_agents record exactly like a
-- regular sales_agent, and — because app_agent_id() reads linked_agent_id
-- regardless of role — it inherits the same row-level access automatically
-- (sees only its own carriers, can work its own pre-active leads). It's a
-- separate, labelled category so probationary hires can be identified and
-- tracked. Run AFTER the enum migration. Safe to run once.
-- =====================================================================

alter table profiles drop constraint if exists profiles_role_link_ck;
alter table profiles add constraint profiles_role_link_ck check (
  (role in ('sales_agent', 'sales_probation')
     and linked_agent_id is not null and linked_dispatcher_id is null) or
  (role = 'dispatcher'
     and linked_dispatcher_id is not null and linked_agent_id is null) or
  (role in ('admin', 'system', 'sales_head', 'dispatch_head')
     and linked_agent_id is null and linked_dispatcher_id is null)
);
