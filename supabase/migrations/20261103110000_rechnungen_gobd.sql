-- Rechtsprüfung 03.11.2026 (docs/recht/pruefung-2026-11.md S1–S3, S22, S24): invoices follow GoBD and § 14 UStG.
-- * Draft and issued invoice are separate states. A draft has no number yet ("ENTWURF-…"), can be deleted and shows the
--   current master data. "Ausstellen" (public.rechnung_ausstellen) takes the next number from a counter per firm and year
--   (never reused, no gaps from deleted drafts), sets the invoice date and freezes sender, recipient, small-business
--   status, VAT rate and VAT amount in the row. From then on nothing of the content can change.
-- * An issued invoice cannot be deleted; it is cancelled by a cancellation invoice with its own number and negative
--   amounts (public.rechnung_stornieren). Cascading deletes (whole firm deleted) stay possible.

alter table public.rechnungen add column if not exists status text not null default 'ausgestellt' check (status in ('entwurf', 'ausgestellt'));
alter table public.rechnungen add column if not exists art text not null default 'rechnung' check (art in ('rechnung', 'storno'));
alter table public.rechnungen add column if not exists bezug_id uuid references public.rechnungen on delete set null;
alter table public.rechnungen add column if not exists bezug_nummer text not null default '' check (length(bezug_nummer) <= 40);
alter table public.rechnungen add column if not exists storniert_durch uuid references public.rechnungen on delete set null;
alter table public.rechnungen add column if not exists absender jsonb;
alter table public.rechnungen add column if not exists empfaenger jsonb;
alter table public.rechnungen add column if not exists kleinunternehmer boolean;
alter table public.rechnungen add column if not exists ust_betrag numeric(12, 2);
alter table public.rechnungen add column if not exists ausgestellt_am timestamptz;

-- Existing invoices were handed out as issued: freeze them with today's master data (best possible snapshot).
update public.rechnungen r set
  absender = jsonb_build_object('name', f.name, 'strasse', coalesce(f.strasse, ''), 'plz', coalesce(f.plz, ''), 'ort', coalesce(f.ort, ''),
    'telefon', coalesce(f.telefon, ''), 'email', coalesce(p.email, ''), 'ustid', coalesce(p.ustid, ''), 'steuernummer', coalesce(p.steuernummer, ''),
    'zahlungshinweis', coalesce(p.zahlungshinweis, '')),
  kleinunternehmer = coalesce(p.kleinunternehmer, false),
  ust_betrag = case when coalesce(p.kleinunternehmer, false) then 0 else round(r.netto * r.ust_satz / 100, 2) end,
  ausgestellt_am = r.erstellt
from public.firmen f
left join public.firmenprofil p on p.firma_id = f.id
where f.id = r.firma_id and r.absender is null;
update public.rechnungen r set empfaenger = jsonb_build_object('name', k.name, 'ansprechpartner', coalesce(k.ansprechpartner, ''),
    'strasse', coalesce(k.strasse, ''), 'plz', coalesce(k.plz, ''), 'ort', coalesce(k.ort, ''), 'email', coalesce(k.email, ''),
    'leitweg', coalesce(substring(k.notiz from '(?i)Leitweg(?:-ID)?:?\s*([0-9A-Za-z-]{5,46})'), ''))
  from public.kunden k where k.id = r.kunde_id and r.empfaenger is null;

alter table public.rechnungen alter column status set default 'entwurf';
alter table public.rechnungen drop constraint if exists rechnungen_entwurf_nummer;
alter table public.rechnungen add constraint rechnungen_entwurf_nummer check ((status = 'entwurf') = (nummer like 'ENTWURF-%'));
alter table public.rechnungen drop constraint if exists rechnungen_ausgestellt_vollstaendig;
alter table public.rechnungen add constraint rechnungen_ausgestellt_vollstaendig check (status = 'entwurf' or (absender is not null and kleinunternehmer is not null and ust_betrag is not null));

-- Number counter per firm and year, started at the highest number handed out so far.
create table if not exists jarvis_intern.rechnungsnummern (
  firma_id uuid not null references public.firmen on delete cascade,
  jahr integer not null,
  letzte integer not null,
  primary key (firma_id, jahr)
);
revoke all on jarvis_intern.rechnungsnummern from public, anon, authenticated;
insert into jarvis_intern.rechnungsnummern (firma_id, jahr, letzte)
select firma_id, substring(nummer from '^RE-(\d{4})-')::int, max(substring(nummer from '^RE-\d{4}-(\d+)$')::int)
  from public.rechnungen where nummer ~ '^RE-\d{4}-\d+$' group by 1, 2
on conflict (firma_id, jahr) do update set letzte = greatest(jarvis_intern.rechnungsnummern.letzte, excluded.letzte);

create or replace function jarvis_intern.naechste_rechnungsnummer(f uuid) returns text
language plpgsql set search_path = '' as $$
declare j integer := extract(year from (now() at time zone 'Europe/Berlin'))::int; n integer;
begin
  insert into jarvis_intern.rechnungsnummern (firma_id, jahr, letzte) values (f, j, 1)
  on conflict (firma_id, jahr) do update set letzte = jarvis_intern.rechnungsnummern.letzte + 1
  returning letzte into n;
  return 'RE-' || j || '-' || lpad(n::text, 4, '0');
end $$;
revoke all on function jarvis_intern.naechste_rechnungsnummer(uuid) from public, anon, authenticated;

-- Content of an issued invoice is fixed; only payment and dunning status may change. Status changes and the
-- "cancelled by" link only through the two functions below (they set jarvis.rechnung_fn for their transaction).
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
        new.status, new.art, new.bezug_id, new.bezug_nummer, new.absender, new.empfaenger, new.kleinunternehmer, new.ust_betrag, new.ausgestellt_am)
       is distinct from (old.firma_id, old.kunde_id, old.nummer, old.monat, old.datum, old.positionen, old.netto, old.ust_satz, old.zahlungsziel_tage,
        old.status, old.art, old.bezug_id, old.bezug_nummer, old.absender, old.empfaenger, old.kleinunternehmer, old.ust_betrag, old.ausgestellt_am) then
      raise exception 'Rechnungsinhalt ist unveränderlich (nur Zahlungs- und Mahnstatus)' using errcode = '42501';
    end if;
    if new.storniert_durch is distinct from old.storniert_durch and not (fn and old.storniert_durch is null) then
      raise exception 'Storno nur über die Funktion rechnung_stornieren' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists rechnung_unveraenderlich on public.rechnungen;
create trigger rechnung_unveraenderlich before insert or update or delete on public.rechnungen for each row execute function jarvis_intern.rechnung_unveraenderlich();

-- Who may issue and cancel: the same people who may create invoices (finance access, owner/admin/editor).
create or replace function jarvis_intern.darf_rechnungen(f uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select jarvis_intern.darf_finanzen(f, null) and public.meine_rolle(f) in ('inhaber', 'admin', 'bearbeiter')
$$;
revoke all on function jarvis_intern.darf_rechnungen(uuid) from public, anon;
grant execute on function jarvis_intern.darf_rechnungen(uuid) to authenticated;

create or replace function public.rechnung_ausstellen(r uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare x public.rechnungen; f public.firmen; p public.firmenprofil; k public.kunden; nr text; ku boolean;
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
  nr := jarvis_intern.naechste_rechnungsnummer(x.firma_id);
  perform set_config('jarvis.rechnung_fn', '1', true);
  update public.rechnungen set
    status = 'ausgestellt', nummer = nr, datum = (now() at time zone 'Europe/Berlin')::date, ausgestellt_am = now(),
    kleinunternehmer = ku, ust_satz = case when ku then 0 else x.ust_satz end,
    ust_betrag = case when ku then 0 else round(x.netto * x.ust_satz / 100, 2) end,
    absender = jsonb_build_object('name', f.name, 'strasse', coalesce(f.strasse, ''), 'plz', coalesce(f.plz, ''), 'ort', coalesce(f.ort, ''),
      'telefon', coalesce(f.telefon, ''), 'email', coalesce(p.email, ''), 'ustid', coalesce(p.ustid, ''), 'steuernummer', coalesce(p.steuernummer, ''),
      'zahlungshinweis', coalesce(p.zahlungshinweis, '')),
    empfaenger = jsonb_build_object('name', k.name, 'ansprechpartner', coalesce(k.ansprechpartner, ''), 'strasse', coalesce(k.strasse, ''),
      'plz', coalesce(k.plz, ''), 'ort', coalesce(k.ort, ''), 'email', coalesce(k.email, ''),
      'leitweg', coalesce(substring(k.notiz from '(?i)Leitweg(?:-ID)?:?\s*([0-9A-Za-z-]{5,46})'), ''))
  where id = r;
  perform set_config('jarvis.rechnung_fn', '', true);
  return nr;
end $$;
revoke all on function public.rechnung_ausstellen(uuid) from public, anon;
grant execute on function public.rechnung_ausstellen(uuid) to authenticated;

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
    bezug_id, bezug_nummer, absender, empfaenger, kleinunternehmer, ust_betrag, ausgestellt_am, bezahlt_am)
  values (x.firma_id, x.kunde_id, nr, x.monat, (now() at time zone 'Europe/Berlin')::date,
    coalesce((select jsonb_agg(e || jsonb_build_object('menge', -(e->>'menge')::numeric, 'betrag', -(e->>'betrag')::numeric)) from jsonb_array_elements(x.positionen) e), '[]'),
    -x.netto, x.ust_satz, x.zahlungsziel_tage, 'ausgestellt', 'storno', x.id, x.nummer, x.absender, x.empfaenger, x.kleinunternehmer, -x.ust_betrag, now(),
    (now() at time zone 'Europe/Berlin')::date)
  returning id into neu;
  update public.rechnungen set storniert_durch = neu where id = r;
  perform set_config('jarvis.rechnung_fn', '', true);
  return nr;
end $$;
revoke all on function public.rechnung_stornieren(uuid) from public, anon;
grant execute on function public.rechnung_stornieren(uuid) to authenticated;

-- Customer portal: only issued invoices, with the frozen VAT and cancellations.
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
    'vorfaelle', case when p.berichte_zeigen then coalesce((select jsonb_agg(jsonb_build_object('zeit', w.zeit, 'ort', o.name, 'text', w.text) order by w.zeit desc)
      from public.wachbuch w join public.einsatzorte o on o.id = w.einsatzort_id where o.kunde_id = p.kunde_id and w.firma_id = p.firma_id and w.art = 'vorfall' and w.zeit > now() - interval '30 days'), '[]') end,
    'meldungen', coalesce((select jsonb_agg(jsonb_build_object('art', m.art, 'text', m.text, 'erstellt', m.erstellt, 'erledigt_am', m.erledigt_am) order by m.erstellt desc)
      from (select * from public.kunden_meldungen where kunde_id = p.kunde_id and firma_id = p.firma_id order by erstellt desc limit 20) m), '[]'));
end $$;

notify pgrst, 'reload schema';
