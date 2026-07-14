-- =====================================================================
-- UniSole Dispatch CRM — seed data
-- =====================================================================
-- Runs on `supabase db reset`. Keep this to safe, stable reference data.
-- =====================================================================

-- Truck types (known values so far — the business will add more from the
-- admin screen later). Idempotent so re-seeding doesn't duplicate.
insert into truck_types (code, description) values
  ('SD',     'Step Deck'),
  ('SBT',    'Straight Box Truck'),
  ('SBT/DV', 'Straight Box Truck / Dry Van'),
  ('PO',     'Power Only'),
  ('DV',     'Dry Van')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- Creating the first admin (do this once, manually — cannot be pure SQL
-- because the login lives in Supabase Auth, not in our tables):
--
--   1. In the Supabase dashboard → Authentication → Users → "Add user",
--      create the admin's email + password. Copy the new user's UUID.
--   2. Run (replacing the UUID and email):
--
--        insert into profiles (id, email, role)
--        values ('00000000-0000-0000-0000-000000000000',
--                'admin@unisole.example', 'admin');
--
-- After that, the admin can create sales agents, dispatchers, and their
-- logins from inside the app.
-- ---------------------------------------------------------------------
