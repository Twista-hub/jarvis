-- Benjamin authorises a temporary test allowance on 31 October 2026.
-- The monthly cap and per-request cap stay in place; the UTC day limit resets automatically.
create function jarvis_katalog.ki_tageslimit(zeitpunkt timestamptz) returns numeric
language sql immutable strict set search_path='' as $$
 select case when (zeitpunkt at time zone 'UTC')::date = date '2026-10-31' then 5::numeric else 3::numeric end
$$;
revoke all on function jarvis_katalog.ki_tageslimit(timestamptz) from public,anon,authenticated;

create or replace function jarvis_katalog.ki_reservieren(betrag numeric,zweck text) returns uuid
language plpgsql set search_path='' as $$
declare
 m date:=date_trunc('month',now())::date;
 i uuid;
 tageslimit numeric:=jarvis_katalog.ki_tageslimit(now());
begin
 if betrag<=0 or betrag>3 then return null; end if;
 insert into jarvis_katalog.ki_budget(monat) values(m) on conflict do nothing;
 perform 1 from jarvis_katalog.ki_budget where monat=m for update;
 if (select reserviert+betrag>limit_usd from jarvis_katalog.ki_budget where monat=m)
 or (select coalesce(sum(reserviert),0)+betrag>tageslimit from jarvis_katalog.ki_kosten
     where zeit>=(date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')) then return null; end if;
 update jarvis_katalog.ki_budget set reserviert=reserviert+betrag where monat=m;
 insert into jarvis_katalog.ki_kosten(zweck,reserviert) values(zweck,betrag) returning id into i;
 return i;
end $$;
revoke all on function jarvis_katalog.ki_reservieren(numeric,text) from public,anon,authenticated;
