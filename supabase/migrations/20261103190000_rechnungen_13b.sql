-- Rechtsprüfung 03.11.2026, Steuern S4 (docs/recht/pruefung-2026-11.md): reverse charge (§ 13b Abs. 2 Nr. 4 and Nr. 8
-- UStG). A customer can be marked as owing the VAT (cleaning services for a cleaning firm, construction work for a
-- construction firm). Issuing an invoice for such a customer: 0 % VAT, the mandatory note "Steuerschuldnerschaft des
-- Leistungsempfängers" (§ 14a Abs. 5 UStG) and the customer's VAT ID, frozen like the rest of the invoice.
alter table public.kunden add column if not exists ust_13b boolean not null default false;
alter table public.kunden add column if not exists ustid text not null default '' check (length(ustid) <= 20);
alter table public.rechnungen add column if not exists reverse_charge boolean not null default false;

create or replace function jarvis_intern.rechnung_unveraenderlich() returns trigger
language plpgsql set search_path = '' as $$
declare fn boolean := coalesce(current_setting('jarvis.rechnung_fn', true), '') = '1';
begin
  if tg_op = 'INSERT' then
    if not fn and (new.status <> 'entwurf' or new.art <> 'rechnung' or new.storniert_durch is not null or new.bezug_id is not null) then
      raise exception 'Neue Rechnungen beginnen als Entwurf' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    -- Whole firm deleted (cascade from public.firmen): allowed, the firm was warned and offered an export.
    if old.status <> 'entwurf' and pg_trigger_depth() < 2 then
      raise exception 'Ausgestellte Rechnungen werden nicht gelöscht, sondern storniert' using errcode = '42501';
    end if;
    return old;
  end if;
  -- Actions of foreign keys (customer deleted → kunde_id null, cancelled pair deleted with the firm) run one level deeper.
  if pg_trigger_depth() >= 2 then return new; end if;
  if old.status = 'entwurf' and not fn then
    if new.status <> 'entwurf' then raise exception 'Ausstellen nur über die Funktion rechnung_ausstellen' using errcode = '42501'; end if;
    return new;
  end if;
  if old.status = 'ausgestellt' then
    if (new.firma_id, new.kunde_id, new.nummer, new.monat, new.datum, new.positionen, new.netto, new.ust_satz, new.zahlungsziel_tage,
        new.status, new.art, new.bezug_id, new.bezug_nummer, new.absender, new.empfaenger, new.kleinunternehmer, new.ust_betrag, new.ausgestellt_am, new.reverse_charge)
       is distinct from (old.firma_id, old.kunde_id, old.nummer, old.monat, old.datum, old.positionen, old.netto, old.ust_satz, old.zahlungsziel_tage,
        old.status, old.art, old.bezug_id, old.bezug_nummer, old.absender, old.empfaenger, old.kleinunternehmer, old.ust_betrag, old.ausgestellt_am, old.reverse_charge) then
      raise exception 'Rechnungsinhalt ist unveränderlich (nur Zahlungs- und Mahnstatus)' using errcode = '42501';
    end if;
    if new.storniert_durch is distinct from old.storniert_durch and not (fn and old.storniert_durch is null) then
      raise exception 'Storno nur über die Funktion rechnung_stornieren' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

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
      'telefon', coalesce(f.telefon, ''), 'email', coalesce(p.email, ''), 'ustid', coalesce(p.ustid, ''), 'steuernummer', coalesce(p.steuernummer, ''),
      'zahlungshinweis', coalesce(p.zahlungshinweis, '')),
    empfaenger = jsonb_build_object('name', k.name, 'ansprechpartner', coalesce(k.ansprechpartner, ''), 'strasse', coalesce(k.strasse, ''),
      'plz', coalesce(k.plz, ''), 'ort', coalesce(k.ort, ''), 'email', coalesce(k.email, ''), 'ustid', coalesce(k.ustid, ''),
      'leitweg', coalesce(substring(k.notiz from '(?i)Leitweg(?:-ID)?:?\s*([0-9A-Za-z-]{5,46})'), ''))
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
    bezug_id, bezug_nummer, absender, empfaenger, kleinunternehmer, ust_betrag, ausgestellt_am, bezahlt_am, reverse_charge)
  values (x.firma_id, x.kunde_id, nr, x.monat, (now() at time zone 'Europe/Berlin')::date,
    coalesce((select jsonb_agg(e || jsonb_build_object('menge', -(e->>'menge')::numeric, 'betrag', -(e->>'betrag')::numeric)) from jsonb_array_elements(x.positionen) e), '[]'),
    -x.netto, x.ust_satz, x.zahlungsziel_tage, 'ausgestellt', 'storno', x.id, x.nummer, x.absender, x.empfaenger, x.kleinunternehmer, -x.ust_betrag, now(),
    (now() at time zone 'Europe/Berlin')::date, x.reverse_charge)
  returning id into neu;
  update public.rechnungen set storniert_durch = neu where id = r;
  perform set_config('jarvis.rechnung_fn', '', true);
  return nr;
end $$;

notify pgrst, 'reload schema';
