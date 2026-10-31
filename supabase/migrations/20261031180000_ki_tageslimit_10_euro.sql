-- Benjamin, 31 October 2026: daily KI limit 10 euros (about 11 USD; amounts are kept in USD) from now on.
-- The monthly cap (ki_budget.limit_usd) and the per-request cap in ki_reservieren stay unchanged.
create or replace function jarvis_katalog.ki_tageslimit(zeitpunkt timestamptz) returns numeric
language sql immutable strict set search_path='' as $$
 select 11::numeric
$$;
revoke all on function jarvis_katalog.ki_tageslimit(timestamptz) from public,anon,authenticated;
