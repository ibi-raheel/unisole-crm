-- =====================================================================
-- UniSole Dispatch CRM — the AI agents
-- =====================================================================
-- Four tables record everything the agents do (runs, steps, documents,
-- messages), and two triggers start the agents. Nothing existing changes.
--
--   agent_runs       one agent working one job (onboard carrier 12,
--                    invoice load 40). Its current step and status.
--   agent_steps      a line for every step taken: the audit trail.
--   agent_documents  every contract, onboarding package, rate
--                    confirmation, invoice and summary the agents wrote.
--   agent_outbox     every email, WhatsApp, DocuSign envelope and call,
--                    including practice-mode ones that were NOT sent.
--
-- The agents write with the service-role key (a trusted system process),
-- so the existing lifecycle triggers still log every status change and
-- still refuse illegal moves. People only READ these tables: admins see
-- all of it; a sales agent or dispatcher sees runs for carriers they can
-- already see (row-level security on carriers decides).
-- =====================================================================

create table agent_runs (
  id           bigint generated always as identity primary key,
  agent        text not null check (agent in ('onboarding', 'follow_up', 'paperwork', 'summary')),
  carrier_id   bigint references carriers (id) on delete cascade,
  load_id      bigint references loads (id) on delete cascade,
  status       text not null default 'queued'
               check (status in ('queued', 'waiting', 'needs_approval', 'done', 'failed')),
  step         text not null,
  context      jsonb not null default '{}'::jsonb,
  next_run_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on agent_runs (status, next_run_at);
create index on agent_runs (carrier_id, created_at);
create index on agent_runs ((context->>'envelope_ref')) where status = 'waiting';
-- At most one live onboarding per carrier: re-marking "Documents Sent" never doubles it.
create unique index agent_runs_one_onboarding on agent_runs (carrier_id)
  where agent = 'onboarding' and status in ('queued', 'waiting', 'needs_approval');

create table agent_steps (
  id          bigint generated always as identity primary key,
  run_id      bigint not null references agent_runs (id) on delete cascade,
  step        text not null,
  status      text not null check (status in ('ok', 'waiting', 'needs_approval', 'failed')),
  detail      text not null,
  created_at  timestamptz not null default now()
);
create index on agent_steps (run_id, created_at);

create table agent_documents (
  id          bigint generated always as identity primary key,
  run_id      bigint not null references agent_runs (id) on delete cascade,
  carrier_id  bigint references carriers (id) on delete cascade,
  load_id     bigint references loads (id) on delete cascade,
  kind        text not null check (kind in ('contract', 'onboarding_package', 'rate_confirmation', 'invoice', 'summary')),
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index on agent_documents (run_id);

create table agent_outbox (
  id            bigint generated always as identity primary key,
  run_id        bigint references agent_runs (id) on delete cascade,
  channel       text not null check (channel in ('email', 'whatsapp', 'esign', 'call')),
  to_addr       text not null,
  subject       text,
  body          text not null,
  status        text not null check (status in ('practice', 'sent', 'failed')),
  provider_ref  text,
  created_at    timestamptz not null default now()
);
create index on agent_outbox (run_id);
create index on agent_outbox (created_at desc);

-- ---------------------------------------------------------------------
-- Triggers that start the agents. In the database, so no code path (a
-- form, a bulk import, a direct SQL edit) can skip them.
-- ---------------------------------------------------------------------
create or replace function agents_on_carrier_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Documents Sent'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into agent_runs (agent, carrier_id, step) values ('onboarding', new.id, 'draft_contract')
    on conflict do nothing;  -- one live onboarding per carrier
  end if;
  return new;
end $$;

create trigger carriers_start_agents
  after insert or update of status on carriers
  for each row execute function agents_on_carrier_status();

create or replace function agents_on_load()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into agent_runs (agent, carrier_id, load_id, step) values ('paperwork', new.carrier_id, new.id, 'rate_confirmation');
  elsif new.load_status = 'Delivered' and old.load_status is distinct from 'Delivered' then
    insert into agent_runs (agent, carrier_id, load_id, step) values ('paperwork', new.carrier_id, new.id, 'invoice');
  end if;
  return new;
end $$;

create trigger loads_start_agents
  after insert or update of load_status on loads
  for each row execute function agents_on_load();

-- ---------------------------------------------------------------------
-- Row-level security: read-only for people; writes only by the service role.
-- ---------------------------------------------------------------------
alter table agent_runs      enable row level security;
alter table agent_steps     enable row level security;
alter table agent_documents enable row level security;
alter table agent_outbox    enable row level security;

create policy agent_runs_read on agent_runs for select to authenticated using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  or (carrier_id is not null and exists (select 1 from carriers c where c.id = agent_runs.carrier_id))
);
create policy agent_steps_read on agent_steps for select to authenticated using (
  exists (select 1 from agent_runs r where r.id = agent_steps.run_id)
);
create policy agent_documents_read on agent_documents for select to authenticated using (
  exists (select 1 from agent_runs r where r.id = agent_documents.run_id)
);
create policy agent_outbox_read on agent_outbox for select to authenticated using (
  exists (select 1 from agent_runs r where r.id = agent_outbox.run_id)
);

grant select on agent_runs, agent_steps, agent_documents, agent_outbox to authenticated;
