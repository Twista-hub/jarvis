-- Invoices from WP Digital Ranger (operator) to Crewtender customers, written on the operator page (Benjamin 03.11.2026).
-- * Number range CT-<year>-<0001>, without gaps, per calendar year.
-- * Issuer and recipient are frozen on the invoice (later changes of the firm do not alter issued invoices).
-- * Issued invoices cannot be changed or deleted (GoBD). A mistake is corrected with a cancellation invoice
--   (negative amounts, own number, reference to the original).
-- * Customers outside Germany only once the issuer has a VAT ID (reverse charge); until then refused.
-- * Only possible with the issuer's tax number (§ 34a UStDV for small businesses; § 14 Abs. 4 UStG otherwise).
-- * Kept 8 years after the end of the year (§ 147 AO, Buchungsbelege); no automatic deletion before that.
create table if not exists jarvis_intern.betreiber_rechnungen (
  id uuid primary key default gen_random_uuid(),
  nummer text not null unique,
  firma_id uuid references public.firmen on delete set null,
  datum date not null default (now() at time zone 'Europe/Berlin')::date,
  leistungszeitraum text not null check (length(leistungszeitraum) between 1 and 100),
  aussteller jsonb not null,
  empfaenger jsonb not null,
  positionen jsonb not null check (jsonb_typeof(positionen) = 'array' and jsonb_array_length(positionen) between 1 and 20),
  summe numeric(12, 2) not null,
  hinweis text not null default '' check (length(hinweis) <= 500),
  storno_von uuid references jarvis_intern.betreiber_rechnungen,
  storniert_durch uuid references jarvis_intern.betreiber_rechnungen,
  erstellt timestamptz not null default now()
);
revoke all on jarvis_intern.betreiber_rechnungen from public, anon, authenticated;

-- Issued invoices stay as they are; only the cancellation link may be set once.
create or replace function jarvis_intern.betreiber_rechnung_fest() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() >= 2 then return old; end if;  -- cascades are not expected here, but keep the usual pattern
    raise exception 'Ausgestellte Rechnungen werden nicht gelöscht (Aufbewahrung)' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'storniert_durch' - 'firma_id') is distinct from (to_jsonb(old) - 'storniert_durch' - 'firma_id')
     or (old.storniert_durch is not null and new.storniert_durch is distinct from old.storniert_durch)
     or (new.firma_id is distinct from old.firma_id and new.firma_id is not null) then
    raise exception 'Ausgestellte Rechnungen werden nicht geändert; bitte stornieren' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists betreiber_rechnung_fest on jarvis_intern.betreiber_rechnungen;
create trigger betreiber_rechnung_fest before update or delete on jarvis_intern.betreiber_rechnungen
  for each row execute function jarvis_intern.betreiber_rechnung_fest();

create or replace function jarvis_intern.betreiber_rechnung_nummer(d date) returns text
language plpgsql set search_path = '' as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtext('betreiber_rechnung_nummer'));
  select coalesce(max(substring(nummer from '^CT-\d{4}-(\d+)$')::integer), 0) + 1 into n
    from jarvis_intern.betreiber_rechnungen where nummer like 'CT-' || extract(year from d)::text || '-%';
  return 'CT-' || extract(year from d)::text || '-' || lpad(n::text, 4, '0');
end $$;
revoke all on function jarvis_intern.betreiber_rechnung_nummer(date) from public, anon, authenticated;

-- positionen: [{"text": "Crewtender Pro, November 2026", "menge": 1, "preis": 149.00}, ...]
-- aussteller: {"name", "firma", "strasse", "ort", "email", "steuernummer", "ust_id", "kleinunternehmer"} from the web code.
create or replace function public.betreiber_rechnung_anlegen(f uuid, positionen jsonb, zeitraum text, aussteller jsonb, hinweis text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p jsonb; summe numeric := 0; saubere jsonb := '[]'; e jsonb; nr text; i uuid; menge numeric; preis numeric; t text;
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  if coalesce(trim(aussteller->>'steuernummer'), '') = '' and coalesce(trim(aussteller->>'ust_id'), '') = '' then
    raise exception 'STEUERNUMMER_FEHLT';
  end if;
  if coalesce(trim(zeitraum), '') = '' then raise exception 'ZEITRAUM_FEHLT'; end if;
  if jsonb_typeof(positionen) <> 'array' or jsonb_array_length(positionen) not between 1 and 20 then raise exception 'POSITIONEN_FEHLEN'; end if;
  for p in select * from jsonb_array_elements(positionen) loop
    t := left(trim(coalesce(p->>'text', '')), 300);
    menge := (p->>'menge')::numeric; preis := (p->>'preis')::numeric;
    if t = '' or menge is null or preis is null or menge <= 0 or menge > 100000 or abs(preis) > 1000000 then raise exception 'POSITION_UNGUELTIG'; end if;
    saubere := saubere || jsonb_build_object('text', t, 'menge', menge, 'preis', round(preis, 2));
    summe := summe + round(menge * round(preis, 2), 2);
  end loop;
  select jsonb_build_object('firma', x.name, 'strasse', x.strasse, 'plz', x.plz, 'ort', x.ort,
           'land', coalesce(fp.land, 'DE'),
           'inhaber', (select u.email::text from public.mitglieder m join auth.users u on u.id = m.user_id
                        where m.firma_id = x.id and m.rolle = 'inhaber' and m.aktiv order by m.erstellt limit 1))
    into e from public.firmen x left join public.firmenprofil fp on fp.firma_id = x.id where x.id = f;
  if e is null then raise exception 'NICHT_GEFUNDEN'; end if;
  if coalesce(e->>'strasse', '') = '' or coalesce(e->>'ort', '') = '' then raise exception 'ANSCHRIFT_FEHLT'; end if;
  -- Customers abroad: place of supply and reverse charge need a VAT ID and tax advice first (§ 3a Abs. 2, § 13b UStG).
  if e->>'land' <> 'DE' and coalesce(trim(aussteller->>'ust_id'), '') = '' then raise exception 'AUSLAND'; end if;
  nr := jarvis_intern.betreiber_rechnung_nummer((now() at time zone 'Europe/Berlin')::date);
  insert into jarvis_intern.betreiber_rechnungen (nummer, firma_id, leistungszeitraum, aussteller, empfaenger, positionen, summe, hinweis)
    values (nr, f, left(trim(zeitraum), 100), aussteller, e, saubere, summe, left(coalesce(hinweis, ''), 500))
    returning id into i;
  return jsonb_build_object('id', i, 'nummer', nr);
end $$;

-- Cancellation: a new invoice with negative amounts and a reference to the original.
create or replace function public.betreiber_rechnung_stornieren(r uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o jarvis_intern.betreiber_rechnungen; nr text; i uuid;
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  select * into o from jarvis_intern.betreiber_rechnungen where id = r for update;
  if o.id is null then raise exception 'NICHT_GEFUNDEN'; end if;
  if o.storniert_durch is not null or o.storno_von is not null then raise exception 'SCHON_STORNIERT'; end if;
  nr := jarvis_intern.betreiber_rechnung_nummer((now() at time zone 'Europe/Berlin')::date);
  insert into jarvis_intern.betreiber_rechnungen (nummer, firma_id, leistungszeitraum, aussteller, empfaenger, positionen, summe, hinweis, storno_von)
    values (nr, o.firma_id, o.leistungszeitraum, o.aussteller, o.empfaenger,
            (select jsonb_agg(x || jsonb_build_object('preis', -(x->>'preis')::numeric)) from jsonb_array_elements(o.positionen) x),
            -o.summe, 'Stornorechnung zu ' || o.nummer || ' vom ' || to_char(o.datum, 'DD.MM.YYYY'), o.id)
    returning id into i;
  update jarvis_intern.betreiber_rechnungen set storniert_durch = i where id = o.id;
  return jsonb_build_object('id', i, 'nummer', nr);
end $$;

create or replace function public.betreiber_rechnungen_liste() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  return query select to_jsonb(r) from jarvis_intern.betreiber_rechnungen r order by r.datum desc, r.nummer desc limit 500;
end $$;

create or replace function public.betreiber_rechnung(r uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  return (select to_jsonb(x) || jsonb_build_object('storno_nummer', (select s.nummer from jarvis_intern.betreiber_rechnungen s where s.id = coalesce(x.storniert_durch, x.storno_von)))
            from jarvis_intern.betreiber_rechnungen x where x.id = r);
end $$;

revoke all on function public.betreiber_rechnung_anlegen(uuid, jsonb, text, jsonb, text), public.betreiber_rechnung_stornieren(uuid),
  public.betreiber_rechnungen_liste(), public.betreiber_rechnung(uuid) from public, anon;
grant execute on function public.betreiber_rechnung_anlegen(uuid, jsonb, text, jsonb, text), public.betreiber_rechnung_stornieren(uuid),
  public.betreiber_rechnungen_liste(), public.betreiber_rechnung(uuid) to authenticated;
notify pgrst, 'reload schema';
