-- Standard solution for customers in another EU country (instead of waiting for the tax adviser): an explicit customer
-- switch "Reverse Charge EU" for services taxable in the customer's country (§ 3a Abs. 2 UStG, e.g. staff for a firm in
-- Austria). Not for work on buildings in Germany: there German VAT applies (§ 3a Abs. 3 Nr. 1 UStG), so it is never
-- switched on automatically. The invoice then carries 0 %, the note "Steuerschuldnerschaft des Leistungsempfängers" and
-- both VAT IDs; it is frozen like § 13b (reverse_charge) plus the kind (reverse_charge_eu) for VAT return box 21, the
-- EC sales list and the DATEV revenue account.
alter table public.kunden add column if not exists reverse_charge_eu boolean not null default false;
alter table public.kunden drop constraint if exists kunden_rc_eu;
alter table public.kunden add constraint kunden_rc_eu check (not (reverse_charge_eu and (privat or ust_13b)));
alter table public.rechnungen add column if not exists reverse_charge_eu boolean not null default false;
alter table public.rechnungen drop constraint if exists rechnungen_rc_eu;
alter table public.rechnungen add constraint rechnungen_rc_eu check (not reverse_charge_eu or reverse_charge);

create or replace function public.rechnung_ausstellen(r uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare x public.rechnungen; f public.firmen; p public.firmenprofil; k public.kunden; nr text; ku boolean; rc boolean;
begin
  select * into x from public.rechnungen where id = r for update;
  if x.id is null or not jarvis_intern.darf_rechnungen(x.firma_id) then raise exception 'Rechnung nicht gefunden' using errcode = '42501'; end if;
  if x.status <> 'entwurf' then raise exception 'Rechnung ist schon ausgestellt'; end if;
  select * into f from public.firmen where id = x.firma_id;
  select * into p from public.firmenprofil where firma_id = x.firma_id;
  select * into k from public.kunden where id = x.kunde_id and firma_id = x.firma_id;
  if coalesce(p.steuernummer, '') = '' and coalesce(p.ustid, '') = '' then raise exception 'Im Firmenprofil fehlt die Steuernummer oder USt-IdNr.'; end if;
  if coalesce(f.strasse, '') = '' or coalesce(f.ort, '') = '' then raise exception 'Im Firmenprofil fehlt die Anschrift der Firma.'; end if;
  if k.id is null then raise exception 'Der Kunde dieser Rechnung fehlt.'; end if;
  ku := coalesce(p.kleinunternehmer, false);
  -- § 13b UStG: the customer owes the VAT (cleaning for a cleaning firm, construction work for a builder). Not for small
  -- businesses (§ 19 has priority). The customer's VAT ID belongs on the invoice.
  rc := (coalesce(k.ust_13b, false) or coalesce(k.reverse_charge_eu, false)) and not ku;
  if rc and coalesce(k.ustid, '') = '' then raise exception 'Für eine Rechnung ohne Umsatzsteuer (Reverse Charge) fehlt die USt-IdNr. des Kunden (Kunden & Einsatzorte).'; end if;
  if rc and coalesce(k.reverse_charge_eu, false) and (coalesce(k.land, 'DE') = 'DE' or k.land not in ('AT','BE','BG','CY','CZ','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK')) then
    raise exception 'Reverse Charge EU geht nur bei Kunden mit Sitz in einem anderen EU-Land.'; end if;
  nr := jarvis_intern.naechste_rechnungsnummer(x.firma_id);
  perform set_config('jarvis.rechnung_fn', '1', true);
  update public.rechnungen set
    status = 'ausgestellt', nummer = nr, datum = (now() at time zone 'Europe/Berlin')::date, ausgestellt_am = now(),
    kleinunternehmer = ku, reverse_charge = rc, reverse_charge_eu = rc and coalesce(k.reverse_charge_eu, false), ust_satz = case when ku or rc then 0 else x.ust_satz end,
    ust_betrag = case when ku or rc then 0 else round(x.netto * x.ust_satz / 100, 2) end,
    absender = jsonb_build_object('name', f.name, 'strasse', coalesce(f.strasse, ''), 'plz', coalesce(f.plz, ''), 'ort', coalesce(f.ort, ''),
      'land', coalesce(nullif(p.land, 'XX'), 'DE'),
      'telefon', coalesce(f.telefon, ''), 'email', coalesce(p.email, ''), 'ustid', coalesce(p.ustid, ''), 'steuernummer', coalesce(p.steuernummer, ''),
      'zahlungshinweis', coalesce(p.zahlungshinweis, '')),
    empfaenger = jsonb_build_object('name', k.name, 'ansprechpartner', coalesce(k.ansprechpartner, ''), 'strasse', coalesce(k.strasse, ''),
      'plz', coalesce(k.plz, ''), 'ort', coalesce(k.ort, ''), 'land', coalesce(k.land, 'DE'), 'privat', coalesce(k.privat, false), 'email', coalesce(k.email, ''), 'ustid', coalesce(k.ustid, ''),
      'leitweg', coalesce(nullif(k.leitweg_id, ''), substring(k.notiz from '(?i)Leitweg(?:-ID)?:?\s*([0-9A-Za-z-]{5,46})'), ''))
  where id = r;
  perform set_config('jarvis.rechnung_fn', '', true);
  return nr;
end $$;


create or replace function public.rechnung_stornieren(r uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare x public.rechnungen; nr text; neu uuid;
begin
  select * into x from public.rechnungen where id = r for update;
  if x.id is null or not jarvis_intern.darf_rechnungen(x.firma_id) then raise exception 'Rechnung nicht gefunden' using errcode = '42501'; end if;
  if x.status <> 'ausgestellt' or x.art <> 'rechnung' then raise exception 'Nur ausgestellte Rechnungen können storniert werden'; end if;
  if x.storniert_durch is not null then raise exception 'Rechnung ist schon storniert'; end if;
  nr := jarvis_intern.naechste_rechnungsnummer(x.firma_id);
  perform set_config('jarvis.rechnung_fn', '1', true);
  insert into public.rechnungen (firma_id, kunde_id, nummer, monat, datum, positionen, netto, ust_satz, zahlungsziel_tage, status, art,
    bezug_id, bezug_nummer, absender, empfaenger, kleinunternehmer, ust_betrag, ausgestellt_am, bezahlt_am, reverse_charge, reverse_charge_eu)
  values (x.firma_id, x.kunde_id, nr, x.monat, (now() at time zone 'Europe/Berlin')::date,
    coalesce((select jsonb_agg(e || jsonb_build_object('menge', -(e->>'menge')::numeric, 'betrag', -(e->>'betrag')::numeric)) from jsonb_array_elements(x.positionen) e), '[]'),
    -x.netto, x.ust_satz, x.zahlungsziel_tage, 'ausgestellt', 'storno', x.id, x.nummer, x.absender, x.empfaenger, x.kleinunternehmer, -x.ust_betrag, now(),
    (now() at time zone 'Europe/Berlin')::date, x.reverse_charge, x.reverse_charge_eu)
  returning id into neu;
  update public.rechnungen set storniert_durch = neu where id = r;
  perform set_config('jarvis.rechnung_fn', '', true);
  return nr;
end $$;

notify pgrst, 'reload schema';
