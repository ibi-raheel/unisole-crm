# UniSole CRM — Database (Supabase)

This folder is the **database layer** of the UniSole Dispatch CRM. It defines
every table, the business rules that can't be broken, the access wall, and the
reports the dashboards read from. It targets **Supabase** (managed PostgreSQL),
hosted in the **Mumbai** region.

> Plain-language note: nothing here is a "screen." This is the back room where
> data lives and the rules are enforced. The screens (the Next.js app) come next
> and sit on top of this.

## What's here

`migrations/` — applied in filename order to build the database:

| File | Builds |
|---|---|
| `…090000_enums.sql` | Fixed value-lists (statuses, roles, payment/load states) |
| `…090100_reference_tables.sql` | Truck types, sales agents, dispatchers, `profiles` |
| `…090200_carriers.sql` | The core "one sale = one row" table |
| `…090300_history_and_activity.sql` | Status/dispatcher history, follow-ups, dispatch notes |
| `…090400_loads.sql` | Loads + auto-calculated `amount_earned` |
| `…090500_functions_triggers.sql` | The unbreakable rules (see below) |
| `…090600_indexes.sql` | Speed for the common lookups |
| `…090700_rls.sql` | Row-level security — the access wall |
| `…090800_reporting.sql` | Views + functions for the dashboards |

`seed.sql` — starter data (the five known truck types) and how to create the
first admin login.

## The rules this database enforces (can't be bypassed)

1. **Active is automatic** — only delivering a load makes a carrier Active; no
   one can set it by hand.
2. **A carrier's sales agent never changes.**
3. **Status must follow the proper order** — admins can override to fix mistakes.
4. **Every status change is logged** automatically.
5. **Dispatch ownership** — once Active the dispatcher owns the carrier; only an
   admin can reassign, and every change is logged.
6. **`amount_earned` is computed** by the database, never typed.
7. **Access wall** — an agent sees only their own not-yet-active carriers; a
   dispatcher sees their assigned carriers and loads; an admin sees everything.

## How to apply it (for whoever sets up Supabase)

1. Create a Supabase project in the **Mumbai (ap-south-1)** region.
2. Link it and push the migrations:
   ```
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   (Or run `supabase db reset` locally to apply migrations **and** `seed.sql`.)
3. Create the first admin login: Supabase dashboard → Authentication → add a
   user, then insert their `profiles` row as shown in `seed.sql`.

After that, the admin can add sales agents, dispatchers, and their logins.

## Quick sanity checks (run in the Supabase SQL editor)

- Change a carrier's `sales_agent_id` → should error (Rule 2).
- Set a carrier to `Active` with no delivered load → should error (Rule 1).
- Set a load's `load_status` to `Delivered` → its carrier flips to `Active`,
  `first_load_delivered_at` fills in, and a `carrier_status_history` row appears.
- `select * from stalled_carriers;` → lists signed-but-not-shipped carriers.
