#!/bin/bash
# Throwaway database for the end-to-end test: Supabase stand-ins (auth schema, roles), all migrations, two accounts and
# the example firm. Connection via the usual PG* variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
set -euo pipefail
cd "$(dirname "$0")/../../.."
ende=$(grep -n "^grant usage on schema public to authenticated;" supabase/tests/rechte_test.sql | head -1 | cut -d: -f1)
head -n "$ende" supabase/tests/rechte_test.sql | sed "s|^\\\\ir ../migrations/|\\\\i $PWD/supabase/migrations/|" > /tmp/basis.sql
psql -v ON_ERROR_STOP=1 -q -f /tmp/basis.sql > /dev/null
psql -v ON_ERROR_STOP=1 -q <<'SQL'
-- PostgREST 12 passes the JWT as request.jwt.claims (JSON), like Supabase.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('test.uid', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid $$;
insert into auth.users (id, email) values
  ('0000000b-0000-4000-8000-00000000be01', 'inhaber@test.invalid'),   -- owner with the example firm
  ('0000000b-0000-4000-8000-00000000ae01', 'neu@test.invalid');       -- new sign-up without a firm
insert into public.freigaben (email) values ('inhaber@test.invalid'), ('neu@test.invalid') on conflict do nothing;
select set_config('test.uid', '0000000b-0000-4000-8000-00000000be01', false);
set role authenticated;
select public.firma_anlegen('WP Digital Ranger');
reset role;
SQL
psql -v ON_ERROR_STOP=1 -q -v nutzer=0000000b-0000-4000-8000-00000000be01 -f supabase/demo/beispielfirma.sql 2>&1 | grep -oE "angelegt|ERROR.*" || true
echo "Testdatenbank bereit"
