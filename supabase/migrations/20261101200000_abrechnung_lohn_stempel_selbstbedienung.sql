-- T34 Rechnungsentwurf, T35 Lohnliste, T36 Spesen, T37 Arbeitszeitkonto, T38 Branchenzuschläge, T39 Unterschrift,
-- T40 Kunde bestätigt online, T41 Stempeluhr, T43 Einladung per Link, T44 offene Schichten übernehmen, T45 Geburtstage.

-- ---------- T34: invoice drafts (finance access only) ----------
alter table public.firmenprofil add column if not exists steuernummer text not null default '' check (length(steuernummer) <= 30);
alter table public.firmenprofil add column if not exists kleinunternehmer boolean not null default false;
alter table public.firmenprofil add column if not exists zahlungshinweis text not null default '' check (length(zahlungshinweis) <= 300);
alter table public.kunden_preise add column if not exists zuschlag_nacht numeric(5, 2) not null default 0 check (zuschlag_nacht between 0 and 300);
alter table public.kunden_preise add column if not exists zuschlag_sonntag numeric(5, 2) not null default 0 check (zuschlag_sonntag between 0 and 300);
alter table public.kunden_preise add column if not exists zuschlag_feiertag numeric(5, 2) not null default 0 check (zuschlag_feiertag between 0 and 300);
create table if not exists public.rechnungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  kunde_id uuid references public.kunden on delete set null,
  nummer text not null check (length(nummer) between 1 and 40),
  monat text not null check (monat ~ '^\d{4}-\d{2}$'),
  datum date not null,
  positionen jsonb not null default '[]',
  netto numeric(12, 2) not null default 0,
  ust_satz numeric(4, 2) not null default 19,
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now(),
  unique (firma_id, nummer)
);
alter table public.rechnungen enable row level security;
create policy finanzen on public.rechnungen for all to authenticated
  using (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'))
  with check (jarvis_intern.darf_finanzen(firma_id, null) and public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'));
revoke all on public.rechnungen from anon;
grant select, insert, delete on public.rechnungen to authenticated;

-- ---------- T35 / T45: personnel number and birthday ----------
alter table public.personal add column if not exists personalnummer text not null default '' check (length(personalnummer) <= 20);
alter table public.personal add column if not exists geburtstag date;

-- ---------- T36: expenses with receipt photo ----------
create table if not exists public.spesen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  datum date not null,
  art text not null default 'sonstiges' check (art in ('tanken', 'parken', 'material', 'verpflegung', 'fahrkarte', 'sonstiges')),
  betrag numeric(9, 2) not null check (betrag > 0 and betrag <= 5000),
  notiz text not null default '' check (length(notiz) <= 300),
  beleg_mime text check (beleg_mime is null or beleg_mime in ('application/pdf', 'image/png', 'image/jpeg')),
  status text not null default 'erfasst' check (status in ('erfasst', 'freigegeben', 'abgelehnt')),
  freigegeben_von uuid,
  freigegeben_am timestamptz,
  erstellt timestamptz not null default now()
);
create index if not exists spesen_monat on public.spesen (firma_id, datum);
alter table public.spesen enable row level security;
create policy lesen on public.spesen for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = spesen.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.spesen for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = spesen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = spesen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
create policy eigene_lesen on public.spesen for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = spesen.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_erfassen on public.spesen for insert to authenticated with check
  (status = 'erfasst' and freigegeben_von is null and freigegeben_am is null and datum <= (now() at time zone 'Europe/Berlin')::date and datum >= (now() at time zone 'Europe/Berlin')::date - 90
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = spesen.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_loeschen on public.spesen for delete to authenticated using
  (status = 'erfasst' and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = spesen.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.spesen from anon;
grant select, insert, update, delete on public.spesen to authenticated;

-- ---------- T37: working time account (start balance per person) ----------
create table if not exists public.zeitkonten (
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid primary key references public.personal on delete cascade,
  ab date not null,
  startsaldo_min integer not null default 0 check (startsaldo_min between -60000 and 60000)
);
alter table public.zeitkonten enable row level security;
create policy lesen on public.zeitkonten for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = zeitkonten.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.zeitkonten for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = zeitkonten.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = zeitkonten.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
create policy eigene_lesen on public.zeitkonten for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = zeitkonten.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.zeitkonten from anon;
grant select, insert, update, delete on public.zeitkonten to authenticated;

-- ---------- T38: sector surcharges (temporary work): percentages per step for a customer ----------
alter table public.kunden add column if not exists bz_tarif text not null default '' check (length(bz_tarif) <= 80);
alter table public.kunden add column if not exists bz_prozente numeric(5, 2)[] not null default '{}' check (cardinality(bz_prozente) <= 5);

-- ---------- T39: signatures drawn on the phone (image in R2) ----------
create table if not exists public.unterschriften (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  art text not null check (art in ('psa', 'stunden')),
  bezug text not null default '' check (length(bezug) <= 40),
  erstellt timestamptz not null default now()
);
create index if not exists unterschriften_person on public.unterschriften (personal_id, art, erstellt desc);
alter table public.unterschriften enable row level security;
create policy lesen on public.unterschriften for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = unterschriften.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy eigene on public.unterschriften for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = unterschriften.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_unterschreiben on public.unterschriften for insert to authenticated with check
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = unterschriften.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.unterschriften from anon;
grant select, insert on public.unterschriften to authenticated;

-- ---------- T40: customer confirms the proof of work online via a secret link ----------
create table if not exists public.nachweis_freigaben (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  kunde_id uuid references public.kunden on delete cascade,
  einsatz text not null default '' check (length(einsatz) <= 160),
  monat text not null check (monat ~ '^\d{4}-\d{2}$'),
  titel text not null default '' check (length(titel) <= 200),
  inhalt jsonb not null,
  token_hash text not null unique,
  gueltig_bis timestamptz not null default now() + interval '30 days',
  bestaetigt_am timestamptz,
  bestaetigt_name text not null default '' check (length(bestaetigt_name) <= 120),
  anmerkung text not null default '' check (length(anmerkung) <= 1000),
  rueckfrage boolean not null default false,
  unterschrift boolean not null default false,
  erstellt_von uuid default auth.uid(),
  erstellt timestamptz not null default now()
);
alter table public.nachweis_freigaben enable row level security;
create policy verwalten on public.nachweis_freigaben for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'));
revoke all on public.nachweis_freigaben from anon;
grant select, insert, update, delete on public.nachweis_freigaben to authenticated;

-- Public (no login): only with the token, only the fixed content, only once.
create or replace function public.nachweis_abrufen(token text)
returns table (id uuid, firma_id uuid, firma text, titel text, monat text, inhalt jsonb, bestaetigt_am timestamptz, bestaetigt_name text, rueckfrage boolean, abgelaufen boolean)
language sql stable security definer set search_path = '' as $$
  select n.id, n.firma_id, f.name, n.titel, n.monat, n.inhalt, n.bestaetigt_am, n.bestaetigt_name, n.rueckfrage, n.gueltig_bis < now()
    from public.nachweis_freigaben n join public.firmen f on f.id = n.firma_id
   where n.token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex')
$$;
create or replace function public.nachweis_bestaetigen(token text, name text, anmerkung text, rueckfrage boolean, unterschrift boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare n public.nachweis_freigaben;
begin
  select * into n from public.nachweis_freigaben where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex') and bestaetigt_am is null and gueltig_bis > now() for update;
  if not found or length(trim(coalesce(nachweis_bestaetigen.name, ''))) < 2 then return null; end if;
  update public.nachweis_freigaben set bestaetigt_am = now(), bestaetigt_name = left(trim(nachweis_bestaetigen.name), 120), anmerkung = left(coalesce(nachweis_bestaetigen.anmerkung, ''), 1000),
    rueckfrage = coalesce(nachweis_bestaetigen.rueckfrage, false), unterschrift = coalesce(nachweis_bestaetigen.unterschrift, false) where id = n.id;
  if n.erstellt_von is not null then
    insert into public.push_warteschlange (user_id, titel, text, url) values (n.erstellt_von,
      case when coalesce(nachweis_bestaetigen.rueckfrage, false) then '❓ Rückfrage zum Leistungsnachweis' else '✅ Leistungsnachweis bestätigt' end,
      left(n.titel, 80) || ' · ' || left(trim(nachweis_bestaetigen.name), 60), '/konto/leistungsnachweis?monat=' || n.monat);
  end if;
  return n.id;
end $$;
revoke all on function public.nachweis_abrufen(text), public.nachweis_bestaetigen(text, text, text, boolean, boolean) from public;
grant execute on function public.nachweis_abrufen(text), public.nachweis_bestaetigen(text, text, text, boolean, boolean) to anon, authenticated;

-- ---------- T41: time clock (time is always the server's; only "at the site yes/no" is stored, no coordinates) ----------
create table if not exists public.stempel (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  art text not null check (art in ('kommen', 'pause', 'weiter', 'gehen')),
  zeit timestamptz not null default now(),
  einsatz text not null default '' check (length(einsatz) <= 160),
  am_ort boolean,
  erstellt timestamptz not null default now()
);
create index if not exists stempel_person on public.stempel (personal_id, zeit desc);
alter table public.stempel enable row level security;
create policy lesen on public.stempel for select to authenticated using
  (public.meine_rolle(firma_id) <> 'mitarbeiter'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stempel.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy eigene_lesen on public.stempel for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stempel.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_stempeln on public.stempel for insert to authenticated with check
  (zeit between now() - interval '2 minutes' and now() + interval '1 minute'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = stempel.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
revoke all on public.stempel from anon;
grant select, insert on public.stempel to authenticated;

-- ---------- T43: invitation link for a staff member without e-mail, linked to the personnel record ----------
alter table public.einladungen add column if not exists personal_id uuid references public.personal on delete cascade;
create or replace function public.einladung_annehmen(token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.einladungen;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  select * into e from public.einladungen where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and angenommen is null and gueltig_bis>now() for update;
  if not found then raise exception 'Einladung ungültig oder abgelaufen'; end if;
  -- Link invitations (no address) only for staff with a personnel record; otherwise the address must match.
  if e.email = '' then
    if e.personal_id is null or e.rolle <> 'mitarbeiter' then raise exception 'Einladung ungültig'; end if;
  elsif lower(e.email)<>lower(coalesce((select email from auth.users where id=auth.uid()),'')) then raise exception 'Einladung gilt für eine andere E-Mail-Adresse'; end if;
  if e.rolle='standortleitung' and cardinality(e.bereich_ids)<>1 then raise exception 'Standortleitung braucht genau einen Bereich'; end if;
  if e.rolle='standortleitung' and exists (select 1 from public.bereiche x join public.bereiche kind on kind.parent_id=x.id and kind.art='standort' where x.firma_id=e.firma_id and x.id=e.bereich_ids[1]) then raise exception 'Bitte einen einzelnen Standort statt einer Region wählen'; end if;
  if e.personal_id is not null and exists (select 1 from public.personal p where p.id = e.personal_id and p.user_id is not null and p.user_id <> auth.uid()) then raise exception 'Diese Personalakte ist schon mit einem anderen Zugang verknüpft'; end if;
  insert into public.mitglieder (firma_id,user_id,rolle,anzeigename,funktion,finanzen,alle_bereiche)
    values (e.firma_id,auth.uid(),e.rolle,coalesce(nullif(e.anzeigename,''),nullif(e.email,''),'Einsatzkraft'),e.funktion,e.finanzen and e.rolle in ('bearbeiter','leser'),cardinality(e.bereich_ids)=0 and e.rolle <> 'standortleitung')
    on conflict (firma_id,user_id) do update set rolle=excluded.rolle, aktiv=true, anzeigename=excluded.anzeigename,
      funktion=excluded.funktion, finanzen=excluded.finanzen, alle_bereiche=excluded.alle_bereiche;
  delete from public.mitglied_bereiche where firma_id=e.firma_id and user_id=auth.uid();
  insert into public.mitglied_bereiche (firma_id,user_id,bereich_id) select e.firma_id,auth.uid(),unnest(e.bereich_ids) on conflict do nothing;
  if e.personal_id is not null then
    update public.personal set user_id = null where firma_id = e.firma_id and user_id = auth.uid() and id <> e.personal_id;
    update public.personal set user_id = auth.uid() where id = e.personal_id and firma_id = e.firma_id;
  end if;
  update public.einladungen set angenommen=now() where id=e.id;
  insert into public.protokoll(firma_id,user_id,aktion,details) values(e.firma_id,auth.uid(),'einladung_angenommen',jsonb_build_object('rolle',e.rolle));
  return e.firma_id;
end $$;

-- ---------- T44: open shifts that matching staff can take (first come, first served) ----------
alter table public.schichten add column if not exists beruf text not null default '' check (length(beruf) <= 120);
create policy offene_lesen on public.schichten for select to authenticated using
  (personal_id is null and datum >= (now() at time zone 'Europe/Berlin')::date
   and exists (select 1 from public.personal p where p.firma_id = schichten.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null and p.status <> 'nicht'
                and (schichten.bereich_id is null or jarvis_intern.im_bereich(p.firma_id, p.bereich_id, schichten.bereich_id))
                and (schichten.beruf = '' or schichten.beruf = any(p.berufe))));
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
  update public.schichten set personal_id = p.id, antwort = 'zugesagt', beantwortet = now(), bereich_id = coalesce(bereich_id, p.bereich_id) where id = s;
  if sc.erstellt_von is not null then
    insert into public.push_warteschlange (user_id, titel, text, url)
    values (sc.erstellt_von, '🙋 Offene Schicht übernommen', p.name || ' · ' || to_char(sc.datum, 'DD.MM.') || ' ' || to_char(sc.beginn, 'HH24:MI') || ' Uhr', '/konto/schichten?woche=' || to_char(sc.datum, 'YYYY-MM-DD'));
  end if;
  return 'ok';
end $$;
revoke all on function public.schicht_uebernehmen(uuid) from public, anon;
grant execute on function public.schicht_uebernehmen(uuid) to authenticated;

-- New open shifts are announced to matching staff (same area, matching job).
create or replace function jarvis_intern.schicht_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if new.personal_id is null then
    if tg_op = 'INSERT' then
      insert into public.push_warteschlange (user_id, titel, text, url)
      select distinct p.user_id, '🔓 Offene Schicht ' || to_char(new.datum, 'DD.MM.') || ' · ' || to_char(new.beginn, 'HH24:MI') || '–' || to_char(new.ende, 'HH24:MI'),
             coalesce(nullif(new.ort, ''), 'Wer zuerst übernimmt, bekommt sie'), '/konto/ich#offen'
        from public.personal p join public.mitglieder m on m.firma_id = p.firma_id and m.user_id = p.user_id and m.aktiv
       where p.firma_id = new.firma_id and p.user_id is not null and p.status <> 'nicht' and p.user_id is distinct from auth.uid()
         and (new.bereich_id is null or jarvis_intern.im_bereich(p.firma_id, p.bereich_id, new.bereich_id)) and (new.beruf = '' or new.beruf = any(p.berufe));
    end if;
    return null;
  end if;
  select p.user_id into u from public.personal p where p.id = new.personal_id and p.firma_id = new.firma_id;
  if u is not null and u is distinct from auth.uid()
     and exists (select 1 from public.mitglieder m where m.firma_id = new.firma_id and m.user_id = u and m.aktiv) then
    insert into public.push_warteschlange (user_id, titel, text, url)
    values (u, '📅 Neue Schicht ' || to_char(new.datum, 'DD.MM.') || ' · ' || to_char(new.beginn, 'HH24:MI') || '–' || to_char(new.ende, 'HH24:MI'),
            coalesce(nullif(new.ort, ''), 'Bitte zusagen oder absagen'), '/konto/ich#schichten');
  end if;
  return null;
end $$;
drop trigger if exists schicht_push on public.schichten;
create trigger schicht_push after insert or update of personal_id on public.schichten for each row execute function jarvis_intern.schicht_push();

do $$
declare t text;
begin
  foreach t in array array['rechnungen', 'spesen', 'zeitkonten', 'stempel', 'nachweis_freigaben'] loop
    execute format('drop trigger if exists protokoll on public.%I', t);
    execute format('create trigger protokoll after insert or update or delete on public.%I for each row execute function jarvis_intern.protokollieren()', t);
  end loop;
end $$;
