-- Error alarm for the operator: app errors (the worker reports them), failed GitHub runs (reported by a workflow) and
-- the AI budget at 80 % and 100 %. All go through the push queue as phone notifications to the operator.
create table if not exists jarvis_intern.fehler_meldungen (
  id bigint generated always as identity primary key,
  zeit timestamptz not null default now(),
  art text not null check (length(art) <= 40),
  text text not null check (length(text) <= 300)
);
revoke all on jarvis_intern.fehler_meldungen from public, authenticated, anon;

-- Callable by the app (also without login, e.g. on the public customer page). Limited: the same message at most once
-- per 30 minutes and at most 20 per day, so a broken page cannot flood the phone.
create or replace function public.fehler_melden(art text, text text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a text := left(regexp_replace(coalesce(fehler_melden.art, ''), '[^a-z0-9_-]', '', 'g'), 40);
        t text := left(coalesce(fehler_melden.text, ''), 300);
begin
  if a = '' or t = '' then return false; end if;
  if exists (select 1 from jarvis_intern.fehler_meldungen m where m.art = a and m.text = t and m.zeit > now() - interval '30 minutes')
     or (select count(*) from jarvis_intern.fehler_meldungen m where m.zeit > now() - interval '1 day') >= 20 then
    insert into jarvis_intern.fehler_meldungen as m (art, text) values (a, t);
    return false;
  end if;
  insert into jarvis_intern.fehler_meldungen as m (art, text) values (a, t);
  perform jarvis_intern.betreiber_melden('⚠️ Jarvis: ' || case a when 'app' then 'Fehler in der App' when 'einrichtung' then 'Firmenprüfung gescheitert' when 'github' then 'Ablauf fehlgeschlagen' when 'budget' then 'KI-Budget' else a end, t);
  delete from jarvis_intern.fehler_meldungen m where m.zeit < now() - interval '30 days';
  return true;
end $$;
revoke all on function public.fehler_melden(text, text) from public;
grant execute on function public.fehler_melden(text, text) to anon, authenticated;

-- AI budget: notify once when the monthly reservation crosses 80 % and 100 % of the limit.
create or replace function jarvis_intern.budget_gemeldet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.limit_usd > 0 and old.reserviert < new.limit_usd * 0.8 and new.reserviert >= new.limit_usd * 0.8 then
    perform public.fehler_melden('budget', format('80 %% des KI-Monatsbudgets verbraucht (%s von %s USD, %s).', round(new.reserviert, 2), round(new.limit_usd, 2), to_char(new.monat, 'MM/YYYY')));
  end if;
  if new.limit_usd > 0 and old.reserviert < new.limit_usd and new.reserviert >= new.limit_usd then
    perform public.fehler_melden('budget', format('KI-Monatsbudget aufgebraucht (%s USD, %s). Neue KI-Bewertungen und Steckbriefe pausieren bis zum Monatswechsel oder bis das Limit erhöht wird.', round(new.limit_usd, 2), to_char(new.monat, 'MM/YYYY')));
  end if;
  return new;
end $$;
drop trigger if exists jarvis_budget_gemeldet on jarvis_katalog.ki_budget;
create trigger jarvis_budget_gemeldet after update of reserviert on jarvis_katalog.ki_budget for each row execute function jarvis_intern.budget_gemeldet();
