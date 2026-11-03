-- Rechtsprüfung D13 / R-M7 (Art. 20 DSGVO, Data Act Art. 23 ff. switching): owners and admins download all data of
-- their firm as JSON in one go (/konto/firmendaten.zip). One security definer call instead of ~80 requests. Tables with
-- access secrets (portal and invitation tokens, calendar feeds) and pure read markers are left out; finance tables only
-- with finance access.
create or replace function public.firmendaten_export(f uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  tabellen text[] := array['aenderungsprotokoll','angebotsabgaben','angebotsergebnisse','angebotsmappen','aufgaben','auftraggeber_abos',
    'auftraggeber_kontakte','bedarf_bestaetigungen','belege','bereiche','betriebsmittel','bewerber','bewerber_dateien','bieterfragen',
    'boerse_auftraege','boerse_interessen','chat_nachrichten','checklisten_punkte','eigene_termine','einsaetze','einsatz_bewertungen',
    'einsatzorte','einsatzplaene','firmen_kennzahlen','firmen_qualifikationen','firmen_tarifvertraege','firmen_zertifikate','firmenprofil',
    'firmenunterlagen','foerder_bewertungen','fuehrerschein_kontrollen','kalkulationen','kalkulationsprofile','kalkulationsvorlagen',
    'kontrollpunkte','kunden','kunden_meldungen','kunden_preise','leistungsverzeichnisse','mitglied_bereiche','mitglieder','mitteilungen',
    'nachkalkulation_werte','nachweis_erinnerungen','nachweis_freigaben','partner','partner_anfragen','partner_preise','partnerprofile',
    'personal','personal_abwesenheiten','personal_loehne','personal_nachweise','protokoll','psa_ausgaben','rechnungen','rechnungsvorlagen',
    'referenzen','rundgang_scans','schichten','spesen','stempel','stundenzettel','suchprofile','textbausteine','treffer_feedback',
    'ueberlassungen','unterschriften','unterweisung_teilnahmen','unterweisungen','urlaubskonten','us_bieterprofil','vertraege','vertretungen',
    'vorgaenge','vorgang_freigaben','vorgang_notizen','wachbuch','zeitkonten'];
  finanzen text[] := array['rechnungen','rechnungsvorlagen','kunden_preise','personal_loehne','belege','nachkalkulation_werte','kalkulationen',
    'kalkulationsprofile','kalkulationsvorlagen','partner_preise','spesen'];
  t text; j jsonb; erg jsonb := '{}'; fin boolean;
begin
  if coalesce(public.meine_rolle(f), '') not in ('inhaber', 'admin') then raise exception 'Nur Inhaber und Admins' using errcode = '42501'; end if;
  fin := jarvis_intern.darf_finanzen(f, null);
  select to_jsonb(x) into j from public.firmen x where x.id = f;
  erg := erg || jsonb_build_object('firmen', jsonb_build_array(j));
  foreach t in array tabellen loop
    continue when t = any(finanzen) and not fin;
    continue when to_regclass('public.' || t) is null;
    continue when not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t and c.column_name = 'firma_id');
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.firma_id = $1', t) into j using f;
    erg := erg || jsonb_build_object(t, j);
  end loop;
  return erg;
end $$;
revoke all on function public.firmendaten_export(uuid) from public, anon;
grant execute on function public.firmendaten_export(uuid) to authenticated;
