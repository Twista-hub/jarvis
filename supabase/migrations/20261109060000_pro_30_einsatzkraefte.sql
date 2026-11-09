-- Pro (and the 30-day trial) with 30 instead of 25 field workers (Benjamin 09.11.2026, after the competitor check:
-- rota software for security firms is sold as a flat rate). Same function as 20261107020000, only this value changed.
-- Keep in step with GRENZEN in web/src/plaene.ts.
create or replace function jarvis_intern.plan_grenze(plan text, art text) returns integer
language sql immutable set search_path = '' as $$
  select case art
    when 'suchprofile'       then case plan when 'kostenlos' then 1 when 'basis' then 3 when 'pro' then 10 when 'probe' then 10 else null end
    when 'laender'           then case plan when 'kostenlos' then 1 when 'basis' then 2 else null end
    when 'buero'             then case plan when 'kostenlos' then 1 when 'basis' then 3 when 'pro' then 5 when 'probe' then 5 when 'business' then 15 else null end
    when 'einsatzkraefte'    then case plan when 'kostenlos' then 0 when 'basis' then 0 when 'pro' then 30 when 'probe' then 30 when 'business' then 100 else null end
    when 'standorte'         then case plan when 'kostenlos' then 1 when 'basis' then 1 when 'pro' then 5 when 'probe' then 5 else null end
    when 'steckbriefe'       then case plan when 'kostenlos' then 0 when 'basis' then 5 when 'pro' then 30 when 'probe' then 10 when 'business' then 100 else null end
    when 'arbeitsoberflaeche' then case when plan in ('kostenlos', 'basis') then 0 else 1 end
    when 'unterlagen'        then case when plan = 'kostenlos' then 0 else 1 end
    when 'taeglich'          then case when plan = 'kostenlos' then 0 else 1 end
  end
$$;
revoke all on function jarvis_intern.plan_grenze(text, text) from public, anon, authenticated;
