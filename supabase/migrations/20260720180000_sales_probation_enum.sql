-- Probation sales role. Run this FIRST, alone (enum values must be committed
-- before they can be referenced by the constraint in the next migration).
alter type user_role add value if not exists 'sales_probation';
