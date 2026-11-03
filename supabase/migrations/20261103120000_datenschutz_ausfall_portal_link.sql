-- Rechtsprüfung 03.11.2026, Datenschutz (docs/recht/pruefung-2026-11.md D3, D5, D11):
-- * D3: a short-notice absence ("Ich falle kurzfristig aus") never stores a reason, old reasons are cleared. The
--   reason could be health data (Art. 9 DSGVO, e.g. "Kind krank") and was visible to the office and readers.
-- * D5: the customer portal lists security incidents only with time and site, no free text (names, injuries,
--   suspicions of crimes are Art. 10 data and go to the customer without login).
-- * D11: an expired hours link shows only its status, no longer the names and hours.

update public.personal_abwesenheiten set notiz = '' where kurzfristig and notiz <> '';
create or replace function jarvis_intern.ausfall_ohne_grund() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kurzfristig then new.notiz := ''; end if;
  return new;
end $$;
drop trigger if exists ausfall_ohne_grund on public.personal_abwesenheiten;
create trigger ausfall_ohne_grund before insert or update on public.personal_abwesenheiten for each row execute function jarvis_intern.ausfall_ohne_grund();

create or replace function public.portal_abrufen(token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p public.kunden_portale; ku boolean;
begin
  select * into p from public.kunden_portale where token_hash = encode(sha256(convert_to(portal_abrufen.token, 'UTF8')), 'hex') and aktiv;
  if not found then return null; end if;
  select coalesce(fp.kleinunternehmer, false) into ku from public.firmenprofil fp where fp.firma_id = p.firma_id;
  return jsonb_build_object(
    'firma', (select name from public.firmen where id = p.firma_id),
    'kunde', (select name from public.kunden where id = p.kunde_id),
    'kleinunternehmer', coalesce(ku, false),
    'nachweise', coalesce((select jsonb_agg(jsonb_build_object('monat', n.monat, 'titel', n.titel, 'summe', n.inhalt->'summe', 'bestaetigt_am', n.bestaetigt_am,
        'rueckfrage', n.rueckfrage, 'abgelaufen', n.gueltig_bis < now()) order by n.monat desc, n.erstellt desc)
      from public.nachweis_freigaben n where n.kunde_id = p.kunde_id and n.firma_id = p.firma_id and n.erstellt > now() - interval '13 months'), '[]'),
    'rechnungen', case when p.rechnungen_zeigen then coalesce((select jsonb_agg(jsonb_build_object('nummer', r.nummer, 'datum', r.datum, 'monat', r.monat, 'netto', r.netto,
        'ust_satz', r.ust_satz, 'ust_betrag', r.ust_betrag, 'kleinunternehmer', r.kleinunternehmer, 'art', r.art, 'bezug_nummer', r.bezug_nummer,
        'storniert', r.storniert_durch is not null, 'bezahlt_am', r.bezahlt_am, 'zahlungsziel_tage', r.zahlungsziel_tage) order by r.datum desc, r.nummer desc)
      from public.rechnungen r where r.kunde_id = p.kunde_id and r.firma_id = p.firma_id and r.status = 'ausgestellt' and r.datum > current_date - 730), '[]') end,
    'orte', case when p.berichte_zeigen then coalesce((select jsonb_agg(jsonb_build_object('name', o.name,
        'scans', (select count(*) from public.rundgang_scans s join public.kontrollpunkte kp on kp.id = s.kontrollpunkt_id where kp.einsatzort_id = o.id and s.zeit > now() - interval '14 days'),
        'letzter', (select max(s.zeit) from public.rundgang_scans s join public.kontrollpunkte kp on kp.id = s.kontrollpunkt_id where kp.einsatzort_id = o.id)) order by o.name)
      from public.einsatzorte o where o.kunde_id = p.kunde_id and o.firma_id = p.firma_id), '[]') end,
    'vorfaelle', case when p.berichte_zeigen then coalesce((select jsonb_agg(jsonb_build_object('zeit', w.zeit, 'ort', o.name) order by w.zeit desc)
      from public.wachbuch w join public.einsatzorte o on o.id = w.einsatzort_id where o.kunde_id = p.kunde_id and w.firma_id = p.firma_id and w.art = 'vorfall' and w.zeit > now() - interval '30 days'), '[]') end,
    'meldungen', coalesce((select jsonb_agg(jsonb_build_object('art', m.art, 'text', m.text, 'erstellt', m.erstellt, 'erledigt_am', m.erledigt_am) order by m.erstellt desc)
      from (select * from public.kunden_meldungen where kunde_id = p.kunde_id and firma_id = p.firma_id order by erstellt desc limit 20) m), '[]'));
end $$;

create or replace function public.nachweis_abrufen(token text)
returns table (id uuid, firma_id uuid, firma text, titel text, monat text, inhalt jsonb, bestaetigt_am timestamptz, bestaetigt_name text, rueckfrage boolean, abgelaufen boolean)
language sql stable security definer set search_path = '' as $$
  select n.id, n.firma_id, f.name, n.titel, n.monat, case when n.gueltig_bis < now() then null else n.inhalt end, n.bestaetigt_am, n.bestaetigt_name, n.rueckfrage, n.gueltig_bis < now()
    from public.nachweis_freigaben n join public.firmen f on f.id = n.firma_id
   where n.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;

notify pgrst, 'reload schema';
