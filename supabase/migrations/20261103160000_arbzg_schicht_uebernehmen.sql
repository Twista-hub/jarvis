-- Rechtsprüfung 03.11.2026, Arbeitsrecht A1 (docs/recht/pruefung-2026-11.md): taking over an open shift in the app
-- respects the Arbeitszeitgesetz (§ 3 max. 10 hours a day, § 5 at least 11 hours rest). The office gets warnings in the
-- shift plan (web/src/schichten.ts arbzgHinweise) and can confirm exceptions; staff cannot.
create or replace function jarvis_intern.netto_minuten(b time, e time) returns integer
language sql immutable set search_path = '' as $$
  select m - case when m > 540 then 45 when m > 360 then 30 else 0 end
    from (select (extract(epoch from (e - b + case when e <= b then interval '1 day' else interval '0' end)) / 60)::int as m) x
$$;
revoke all on function jarvis_intern.netto_minuten(time, time) from public, anon;
grant execute on function jarvis_intern.netto_minuten(time, time) to authenticated;

create or replace function public.schicht_uebernehmen(s uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare sc public.schichten; p record;
begin
  select * into sc from public.schichten where id = s for update;
  if not found or sc.personal_id is not null then return 'vergeben'; end if;
  if sc.datum < (now() at time zone 'Europe/Berlin')::date then return 'vorbei'; end if;
  select x.id, x.berufe, x.bereich_id, trim(x.vorname || ' ' || x.nachname) as name into p from public.personal x
   where x.firma_id = sc.firma_id and x.user_id = auth.uid() and public.meine_rolle(x.firma_id) is not null and x.status <> 'nicht'
     and (sc.bereich_id is null or jarvis_intern.im_bereich(x.firma_id, x.bereich_id, sc.bereich_id)) and (sc.beruf = '' or sc.beruf = any(x.berufe));
  if p.id is null then return 'nicht_passend'; end if;
  if exists (select 1 from public.personal_abwesenheiten a where a.personal_id = p.id and sc.datum between a.von and a.bis) then return 'abwesend'; end if;
  if exists (select 1 from public.schichten o where o.personal_id = p.id and o.datum = sc.datum and o.antwort <> 'abgesagt'
             and tsrange(o.datum + o.beginn, o.datum + o.ende + case when o.ende <= o.beginn then interval '1 day' else interval '0' end)
              && tsrange(sc.datum + sc.beginn, sc.datum + sc.ende + case when sc.ende <= sc.beginn then interval '1 day' else interval '0' end)) then return 'doppelt'; end if;
  -- Rechtsprüfung 03.11.2026 (A1): staff cannot take an open shift that breaks the Arbeitszeitgesetz: more than 10 hours
  -- of work that day (§ 3, statutory breaks deducted) or less than 11 hours rest to another shift (§ 5).
  if (select coalesce(sum(jarvis_intern.netto_minuten(o.beginn, o.ende)), 0) from public.schichten o
       where o.personal_id = p.id and o.datum = sc.datum and o.antwort <> 'abgesagt') + jarvis_intern.netto_minuten(sc.beginn, sc.ende) > 600
     or exists (select 1 from public.schichten o where o.personal_id = p.id and o.antwort <> 'abgesagt' and o.datum between sc.datum - 1 and sc.datum + 1
       and tsrange(o.datum + o.beginn - interval '11 hours', o.datum + o.ende + case when o.ende <= o.beginn then interval '1 day' else interval '0' end + interval '11 hours')
        && tsrange(sc.datum + sc.beginn, sc.datum + sc.ende + case when sc.ende <= sc.beginn then interval '1 day' else interval '0' end)) then return 'arbzg'; end if;
  update public.schichten set personal_id = p.id, antwort = 'zugesagt', beantwortet = now(), bereich_id = coalesce(bereich_id, p.bereich_id) where id = s;
  if sc.erstellt_von is not null then
    insert into public.push_warteschlange (user_id, titel, text, url)
    values (sc.erstellt_von, '🙋 Offene Schicht übernommen', p.name || ' · ' || to_char(sc.datum, 'DD.MM.') || ' ' || to_char(sc.beginn, 'HH24:MI') || ' Uhr', '/konto/schichten?woche=' || to_char(sc.datum, 'YYYY-MM-DD'));
  end if;
  return 'ok';
end $$;
