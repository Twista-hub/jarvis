-- Open KI reservations (no settlement because the page stopped waiting or the worker ended) used to stay charged at
-- their worst case forever and blocked the daily limit (31 Oct: 3.07 USD in two firm research calls).
-- Before every new reservation, reservations open for more than an hour are settled at an estimate: their reserved
-- worst case, but at most 0.50 USD (a firm research with web search usually costs a few cents to about 0.30 USD).
create or replace function jarvis_katalog.ki_reservieren(betrag numeric,zweck text) returns uuid
language plpgsql set search_path='' as $$
declare
 m date:=date_trunc('month',now())::date;
 i uuid;
 alt record;
 tageslimit numeric:=jarvis_katalog.ki_tageslimit(now());
begin
 if betrag<=0 or betrag>3 then return null; end if;
 for alt in select id, reserviert from jarvis_katalog.ki_kosten
            where verbraucht is null and zeit < now() - interval '1 hour' order by zeit for update skip locked loop
   perform jarvis_katalog.ki_abschliessen(alt.id, least(alt.reserviert, 0.50));
 end loop;
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
