-- Rechtsprüfung S17: customers can be marked as private persons (not a business). Invoices to them carry the note on the
-- recipient's two-year retention duty (§ 14 Abs. 4 Satz 1 Nr. 9, § 14b Abs. 1 Satz 5 UStG; required for work connected with
-- a property such as cleaning, building or garden work) and reminders use the consumer default interest (§ 288 Abs. 1 BGB).
-- The flag is frozen into the issued invoice. § 13b is impossible for private persons.
alter table public.kunden add column if not exists privat boolean not null default false;
alter table public.kunden drop constraint if exists kunden_privat_13b;
alter table public.kunden add constraint kunden_privat_13b check (not (privat and ust_13b));

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
  rc := coalesce(k.ust_13b, false) and not ku;
  if rc and coalesce(k.ustid, '') = '' then raise exception 'Für eine Rechnung nach § 13b fehlt die USt-IdNr. des Kunden (Kunden & Einsatzorte).'; end if;
  nr := jarvis_intern.naechste_rechnungsnummer(x.firma_id);
  perform set_config('jarvis.rechnung_fn', '1', true);
  update public.rechnungen set
    status = 'ausgestellt', nummer = nr, datum = (now() at time zone 'Europe/Berlin')::date, ausgestellt_am = now(),
    kleinunternehmer = ku, reverse_charge = rc, ust_satz = case when ku or rc then 0 else x.ust_satz end,
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

notify pgrst, 'reload schema';
