-- Rechtsprüfung D10: the change log no longer stores free text (notes, messages) or applicant names; it is cleaned up
-- every night after 12 months (jarvis_intern.loeschfristen). Existing entries are masked the same way.
create or replace function jarvis_intern.protokollieren() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  alt jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  neu jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  zeile jsonb := coalesce(neu, alt);
  firma uuid := (zeile->>'firma_id')::uuid;
  uid uuid := auth.uid();
  name text;
  liste jsonb := '[]';
  k text;
  ignorieren text[] := array['erstellt', 'geaendert', 'token_hash', 'steckbrief', 'roh', 'abgerufen', 'letzte_mail', 'id', 'firma_id'];
  kurz text := '';
  -- D10: free text (notes, messages, reasons) is never copied into the log, only that it changed.
  freitext text[] := array['notiz', 'text', 'beschreibung', 'bemerkung', 'storno_grund', 'nachricht', 'inhalt', 'antwort_text'];
begin
  -- Only changes made by a person in the app. Background jobs and cascades from deleting a login or a firm
  -- are not logged (the firm may already be gone in the same statement).
  if uid is null or firma is null or not exists (select 1 from public.firmen where id = firma) then
    return null;
  end if;
  name := left(coalesce(
    nullif(trim(coalesce(zeile->>'vorname', '') || ' ' || coalesce(zeile->>'nachname', '')), ''),
    zeile->>'titel', zeile->>'name', zeile->>'auftraggeber', zeile->>'email', zeile->>'anzeigename',
    case when tg_table_name = 'mitglied_bereiche' then
      (select nullif(m.anzeigename, '') from public.mitglieder m where m.firma_id = firma and m.user_id = (zeile->>'user_id')::uuid) end,
    case when tg_table_name = 'personal_abwesenheiten' then
      (select trim(p.vorname || ' ' || p.nachname) from public.personal p where p.id = (zeile->>'personal_id')::uuid) end,
    case when tg_table_name = 'ueberlassungen' then
      (select trim(p.vorname || ' ' || p.nachname) from public.personal p where p.id = (zeile->>'personal_id')::uuid) || ' bei ' || (zeile->>'entleiher') end,
    ''), 160);
  -- D10: applicants are logged without their name (the log is kept longer than a rejected application).
  if tg_table_name in ('bewerber', 'bewerber_dateien') then name := 'Bewerbung'; end if;
  if tg_op = 'UPDATE' then
    for k in select key from jsonb_each(neu) loop
      if not k = any(ignorieren) and (alt->k) is distinct from (neu->k) then
        liste := liste || jsonb_build_array(jsonb_build_object('feld', k,
          'alt', case when jsonb_typeof(alt->k) in ('object', 'array') or k = any(freitext) then null else left(alt->>k, 60) end,
          'neu', case when jsonb_typeof(neu->k) in ('object', 'array') then null when k = any(freitext) then 'geändert' else left(neu->>k, 60) end));
      end if;
    end loop;
    if jsonb_array_length(liste) = 0 then return null; end if;
  end if;
  if tg_table_name = 'personal_abwesenheiten' then
    kurz := coalesce(zeile->>'grund', '') || ' ' || coalesce(zeile->>'von', '') || ' bis ' || coalesce(zeile->>'bis', '');
    liste := case when tg_op = 'UPDATE' then liste else jsonb_build_array(jsonb_build_object('feld', 'zeitraum', 'alt', null, 'neu', kurz)) end;
  end if;
  insert into public.aenderungsprotokoll (firma_id, user_id, wer, bereich, aktion, datensatz, aenderungen)
  values (firma, uid,
    coalesce((select nullif(m.anzeigename, '') from public.mitglieder m where m.firma_id = firma and m.user_id = uid),
             (select u.email from auth.users u where u.id = uid), ''),
    tg_table_name, tg_op, name, liste);
  -- Keep twelve months; cleaned up now and then while writing.
  if random() < 0.02 then
    delete from public.aenderungsprotokoll where zeit < now() - interval '12 months';
  end if;
  return null;
end $$;

create or replace function jarvis_intern.loeschfristen(stichtag date default current_date)
returns table (tabelle text, geloescht bigint)
language plpgsql security definer set search_path = '' as $$
declare
  jahr date := date_trunc('year', stichtag)::date;
  n bigint;
begin
  delete from public.stempel where zeit < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'stempel'; geloescht := n; return next;
  delete from public.rundgang_scans where zeit < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'rundgang_scans'; geloescht := n; return next;
  delete from public.einsatz_bewertungen where datum < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'einsatz_bewertungen'; geloescht := n; return next;
  delete from public.personal_abwesenheiten where bis < jahr - interval '3 years';
  get diagnostics n = row_count; tabelle := 'personal_abwesenheiten'; geloescht := n; return next;
  delete from public.wachbuch where zeit < jahr - interval '3 years';
  get diagnostics n = row_count; tabelle := 'wachbuch'; geloescht := n; return next;
  -- D9: applicants past their deletion date whose firm has not opened Jarvis for 30 days (the app deletes files and rows
  -- itself when the office opens the page; this catches inactive firms). Files of the firm are removed with the account.
  delete from public.bewerber where loeschen_ab < stichtag - 30;
  get diagnostics n = row_count; tabelle := 'bewerber'; geloescht := n; return next;
  -- D10: change log 12 months (until now only cleaned up now and then while writing).
  delete from public.aenderungsprotokoll where zeit < now() - interval '12 months';
  get diagnostics n = row_count; tabelle := 'aenderungsprotokoll'; geloescht := n; return next;
  -- D5: customer portal links expire (default 12 months after creation or renewal).
  update public.kunden_portale set aktiv = false where aktiv and gueltig_bis < stichtag;
  get diagnostics n = row_count; tabelle := 'kunden_portale (abgelaufen)'; geloescht := n; return next;
end $$;
revoke all on function jarvis_intern.loeschfristen(date) from public, anon, authenticated;

update public.aenderungsprotokoll set datensatz = 'Bewerbung' where bereich in ('bewerber', 'bewerber_dateien');
update public.aenderungsprotokoll set aenderungen = (
  select coalesce(jsonb_agg(case when e->>'feld' in ('notiz', 'text', 'beschreibung', 'bemerkung', 'storno_grund', 'nachricht', 'inhalt', 'antwort_text')
    then jsonb_build_object('feld', e->>'feld', 'alt', null, 'neu', 'geändert') else e end), '[]'::jsonb)
  from jsonb_array_elements(aenderungen) e)
where jsonb_typeof(aenderungen) = 'array' and exists (select 1 from jsonb_array_elements(aenderungen) e where e->>'feld' in ('notiz', 'text', 'beschreibung', 'bemerkung', 'storno_grund', 'nachricht', 'inhalt', 'antwort_text'));
