-- Idea 40 (docs/ideen-arbeitsoberflaeche.md): customer portal. The office creates one secret link per customer; the
-- customer opens it without an account and sees confirmed/open service records (only sums, no staff names), optionally
-- invoices (only if someone with finance access switched it on) and patrol/incident reports for the customer's sites,
-- and can report defects or wishes. Only the hash of the link is stored. Reading and reporting go through
-- security-definer functions; the tables themselves are not readable without login.
create table if not exists public.kunden_portale (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  kunde_id uuid not null unique references public.kunden on delete cascade,
  token_hash text not null unique,
  aktiv boolean not null default true,
  rechnungen_zeigen boolean not null default false,
  berichte_zeigen boolean not null default false,
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now()
);
create table if not exists public.kunden_meldungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  kunde_id uuid not null references public.kunden on delete cascade,
  art text not null default 'mangel' check (art in ('mangel', 'wunsch', 'lob')),
  text text not null check (length(trim(text)) between 3 and 2000),
  name text not null default '' check (length(name) <= 120),
  erstellt timestamptz not null default now(),
  erledigt_am timestamptz
);
create index if not exists kunden_meldungen_offen on public.kunden_meldungen (firma_id, erstellt desc);

alter table public.kunden_portale enable row level security;
alter table public.kunden_meldungen enable row level security;
-- Office of the customer's area; switching on invoices needs finance access.
create policy verwalten on public.kunden_portale for all to authenticated
  using (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_portale.firma_id and public.darf_bearbeiten(k.firma_id, k.bereich_id)))
  with check (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_portale.firma_id and public.darf_bearbeiten(k.firma_id, k.bereich_id))
    and (not rechnungen_zeigen or jarvis_intern.darf_finanzen(firma_id, null)));
create policy lesen on public.kunden_meldungen for select to authenticated using
  (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_meldungen.firma_id and public.darf_bereich(k.firma_id, k.bereich_id)));
create policy bearbeiten on public.kunden_meldungen for update to authenticated
  using (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_meldungen.firma_id and public.darf_bearbeiten(k.firma_id, k.bereich_id)))
  with check (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_meldungen.firma_id and public.darf_bearbeiten(k.firma_id, k.bereich_id)));
create policy loeschen on public.kunden_meldungen for delete to authenticated
  using (exists (select 1 from public.kunden k where k.id = kunde_id and k.firma_id = kunden_meldungen.firma_id and public.darf_bearbeiten(k.firma_id, k.bereich_id)));
revoke all on public.kunden_portale, public.kunden_meldungen from anon;
grant select, insert, update, delete on public.kunden_portale to authenticated;
revoke all on public.kunden_meldungen from authenticated;
grant select, delete on public.kunden_meldungen to authenticated;
grant update (erledigt_am) on public.kunden_meldungen to authenticated;

-- Public (no login): everything the portal shows, only with the right link and only for this customer.
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
        'ust_satz', r.ust_satz, 'bezahlt_am', r.bezahlt_am, 'zahlungsziel_tage', r.zahlungsziel_tage) order by r.datum desc, r.nummer desc)
      from public.rechnungen r where r.kunde_id = p.kunde_id and r.firma_id = p.firma_id and r.datum > current_date - 730), '[]') end,
    'orte', case when p.berichte_zeigen then coalesce((select jsonb_agg(jsonb_build_object('name', o.name,
        'scans', (select count(*) from public.rundgang_scans s join public.kontrollpunkte kp on kp.id = s.kontrollpunkt_id where kp.einsatzort_id = o.id and s.zeit > now() - interval '14 days'),
        'letzter', (select max(s.zeit) from public.rundgang_scans s join public.kontrollpunkte kp on kp.id = s.kontrollpunkt_id where kp.einsatzort_id = o.id)) order by o.name)
      from public.einsatzorte o where o.kunde_id = p.kunde_id and o.firma_id = p.firma_id), '[]') end,
    'vorfaelle', case when p.berichte_zeigen then coalesce((select jsonb_agg(jsonb_build_object('zeit', w.zeit, 'ort', o.name, 'text', w.text) order by w.zeit desc)
      from public.wachbuch w join public.einsatzorte o on o.id = w.einsatzort_id where o.kunde_id = p.kunde_id and w.firma_id = p.firma_id and w.art = 'vorfall' and w.zeit > now() - interval '30 days'), '[]') end,
    'meldungen', coalesce((select jsonb_agg(jsonb_build_object('art', m.art, 'text', m.text, 'erstellt', m.erstellt, 'erledigt_am', m.erledigt_am) order by m.erstellt desc)
      from (select * from public.kunden_meldungen where kunde_id = p.kunde_id and firma_id = p.firma_id order by erstellt desc limit 20) m), '[]'));
end $$;

-- Customer reports a defect, wish or praise; at most 10 a day per customer. The creator of the link gets a phone message.
create or replace function public.portal_melden(token text, art text, text text, name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare p public.kunden_portale; t text := left(trim(coalesce(portal_melden.text, '')), 2000);
begin
  select * into p from public.kunden_portale where token_hash = encode(sha256(convert_to(portal_melden.token, 'UTF8')), 'hex') and aktiv;
  if not found or length(t) < 3 or coalesce(portal_melden.art, '') not in ('mangel', 'wunsch', 'lob') then return false; end if;
  if (select count(*) from public.kunden_meldungen m where m.kunde_id = p.kunde_id and m.erstellt > now() - interval '1 day') >= 10 then return false; end if;
  insert into public.kunden_meldungen (firma_id, kunde_id, art, text, name) values (p.firma_id, p.kunde_id, portal_melden.art, t, left(trim(coalesce(portal_melden.name, '')), 120));
  if p.erstellt_von is not null then
    insert into public.push_warteschlange (user_id, titel, text, url) values (p.erstellt_von,
      case portal_melden.art when 'mangel' then '⚠️ Mangel gemeldet' when 'wunsch' then '💬 Kundenwunsch' else '👍 Lob vom Kunden' end,
      left((select k.name from public.kunden k where k.id = p.kunde_id), 60) || ': ' || left(t, 100), '/konto/kundenportal');
  end if;
  return true;
end $$;
revoke all on function public.portal_abrufen(text), public.portal_melden(text, text, text, text) from public;
grant execute on function public.portal_abrufen(text), public.portal_melden(text, text, text, text) to anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['kunden_portale', 'kunden_meldungen'] loop
    execute format('drop trigger if exists protokoll on public.%I', t);
    execute format('create trigger protokoll after insert or update or delete on public.%I for each row execute function jarvis_intern.protokollieren()', t);
  end loop;
end $$;
