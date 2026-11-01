-- N2 Förderprogramme in der App and N3 Neuausschreibungs-Radar.

-- N2: funding programmes from the Förderdatenbank des Bundes (CC BY-ND 4.0 DE). Stored: only the original title,
-- the link and the publication day; the app shows our own assessment next to it, never a changed description.
create table if not exists public.foerderprogramme (
  id text primary key check (length(id) <= 600),
  titel text not null check (length(titel) <= 600),
  link text not null check (link ~ '^https://www\.foerderdatenbank\.de/'),
  veroeffentlicht date,
  erfasst timestamptz not null default now()
);
alter table public.foerderprogramme enable row level security;
create policy lesen on public.foerderprogramme for select to authenticated using
  (exists (select 1 from public.mitglieder m where m.user_id = (select auth.uid()) and m.aktiv and m.rolle <> 'mitarbeiter'));
revoke all on public.foerderprogramme from anon, authenticated;
grant select on public.foerderprogramme to authenticated;

-- The daily AI assessment per firm (main search profile) and what the firm did with it.
create table if not exists public.foerder_bewertungen (
  firma_id uuid not null references public.firmen on delete cascade,
  programm_id text not null references public.foerderprogramme on delete cascade,
  punkte integer not null check (punkte between 1 and 10),
  grund text not null default '' check (length(grund) <= 600),
  bewertet timestamptz not null default now(),
  stand text not null default 'neu' check (stand in ('neu', 'gemerkt', 'erledigt', 'ausgeblendet')),
  primary key (firma_id, programm_id)
);
create index if not exists foerder_bewertungen_firma on public.foerder_bewertungen (firma_id, bewertet desc);
alter table public.foerder_bewertungen enable row level security;
create policy lesen on public.foerder_bewertungen for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
-- Marking (merken, erledigt, ausblenden) is open to everyone who works on tenders; only the column "stand".
create policy markieren on public.foerder_bewertungen for update to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'));
revoke all on public.foerder_bewertungen from anon, authenticated;
grant select on public.foerder_bewertungen to authenticated;
grant update (stand) on public.foerder_bewertungen to authenticated;
-- Also independent of column grants: people change only "stand", the assessment stays as the search wrote it.
create or replace function jarvis_intern.foerder_nur_stand() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and (new.firma_id, new.programm_id, new.punkte, new.grund, new.bewertet)
      is distinct from (old.firma_id, old.programm_id, old.punkte, old.grund, old.bewertet) then
    raise exception 'Nur der Stand kann geändert werden';
  end if;
  return new;
end $$;
drop trigger if exists nur_stand on public.foerder_bewertungen;
create trigger nur_stand before update on public.foerder_bewertungen for each row execute function jarvis_intern.foerder_nur_stand();

-- N3: when does an awarded contract end? In this order: the contract period of the award notice, the contract period
-- announced in the tender, or award date (or announced start) plus the announced duration. "verlaengerung_bis" is
-- the latest date including all options to extend. Kept as columns so the radar can use an index.
alter table public.vergabekatalog
  add column if not exists laufzeit_ende date,
  add column if not exists laufzeit_art text check (laufzeit_art in ('vertrag', 'bekanntmachung', 'geschaetzt')),
  add column if not exists verlaengerung_bis date;

create or replace function jarvis_intern.datum_oder_null(t text) returns date
language plpgsql immutable set search_path = '' as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}' then return null; end if;
  return left(t, 10)::date;
exception when others then return null;
end $$;

create or replace function jarvis_intern.laufzeit_berechnen() returns trigger
language plpgsql set search_path = '' as $$
declare
  perioden jsonb := '[]';
  ende_periode date;
  beginn date;
  dauer integer;
  verl date;
begin
  if jsonb_typeof(new.roh #> '{tender,contractPeriod}') = 'object' then
    perioden := perioden || jsonb_build_array(new.roh #> '{tender,contractPeriod}');
  end if;
  if jsonb_typeof(new.roh #> '{tender,lots}') = 'array' then
    perioden := perioden || coalesce((select jsonb_agg(l -> 'contractPeriod') from jsonb_array_elements(new.roh #> '{tender,lots}') l
                                       where jsonb_typeof(l -> 'contractPeriod') = 'object'), '[]');
  end if;
  select max(jarvis_intern.datum_oder_null(p ->> 'endDate')),
         min(jarvis_intern.datum_oder_null(p ->> 'startDate')),
         max(case when jsonb_typeof(p -> 'durationInDays') = 'number' and (p ->> 'durationInDays')::numeric between 1 and 5000
                  then (p ->> 'durationInDays')::numeric::integer end),
         max(jarvis_intern.datum_oder_null(p ->> 'maxExtentDate'))
    into ende_periode, beginn, dauer, verl
    from jsonb_array_elements(perioden) p;
  new.laufzeit_ende := null; new.laufzeit_art := null;
  if new.vertragsende is not null then
    new.laufzeit_ende := new.vertragsende; new.laufzeit_art := 'vertrag';
  elsif ende_periode is not null then
    new.laufzeit_ende := ende_periode; new.laufzeit_art := 'bekanntmachung';
  elsif dauer is not null and (jsonb_array_length(new.zuschlaege) > 0 or new.status in ('vergeben', 'abgeschlossen')) then
    beginn := coalesce(beginn,
      (select max(jarvis_intern.datum_oder_null(z ->> 'datum')) from jsonb_array_elements(new.zuschlaege) z),
      new.quell_datum::date);
    new.laufzeit_ende := beginn + dauer; new.laufzeit_art := 'geschaetzt';
  end if;
  new.verlaengerung_bis := case when verl > new.laufzeit_ende then verl end;
  return new;
end $$;

drop trigger if exists laufzeit on public.vergabekatalog;
create trigger laufzeit before insert or update of roh, vertragsende, zuschlaege, status, quell_datum on public.vergabekatalog
  for each row execute function jarvis_intern.laufzeit_berechnen();
-- Fill the existing rows (the trigger runs on this update).
update public.vergabekatalog set vertragsende = vertragsende;
create index if not exists vergabekatalog_laufzeit on public.vergabekatalog (laufzeit_ende) where laufzeit_ende is not null;

-- Contracts in the firm's field (same word pattern, codes and area as the search profile) that end in the coming
-- months, with a note when the buyer has already published a follow-up tender.
create or replace function public.neuausschreibung_radar(f uuid, muster text, ausschluss text default '', cpv text[] default '{}',
  plz text[] default '{}', monate integer default 48)
returns table (id text, titel text, auftraggeber text, auftraggeber_id text, ort text, link text, ende date, ende_art text,
  verlaengerung_bis date, gewinner text, wert numeric, neu_id text, neu_titel text)
language sql stable security invoker set search_path = '' set statement_timeout = '8s' as $$
  with k as (
    select k.*, lower(k.titel || ' ' || k.beschreibung) as text
      from public.vergabekatalog k
     where coalesce(public.meine_rolle(neuausschreibung_radar.f), 'mitarbeiter') <> 'mitarbeiter'
       and k.laufzeit_ende between current_date - 90 and current_date + make_interval(months => least(greatest(neuausschreibung_radar.monate, 1), 60))
       and (jsonb_array_length(k.zuschlaege) > 0 or k.status in ('vergeben', 'abgeschlossen'))
  ), passend as (
    select k.* from k
     where (k.text ~ neuausschreibung_radar.muster
            or exists (select 1 from unnest(k.cpv) c, unnest(neuausschreibung_radar.cpv) p where c like p || '%'))
       and (neuausschreibung_radar.ausschluss = '' or k.text !~ neuausschreibung_radar.ausschluss)
       and (cardinality(neuausschreibung_radar.plz) = 0 or exists (select 1 from unnest(k.plz) p where left(p, 2) = any(neuausschreibung_radar.plz)))
     order by k.laufzeit_ende
     limit 200
  )
  select p.id, p.titel, p.auftraggeber, p.auftraggeber_id, p.ort, p.link, p.laufzeit_ende, p.laufzeit_art, p.verlaengerung_bis,
         coalesce((select string_agg(distinct g, ', ') from jsonb_array_elements(p.zuschlaege) z, jsonb_array_elements_text(z -> 'gewinner') g), ''),
         (select sum((z ->> 'wert')::numeric) from jsonb_array_elements(p.zuschlaege) z
           where jsonb_typeof(z -> 'wert') = 'number' and (z ->> 'wert')::numeric between 1000 and 10000000000 and coalesce(z ->> 'waehrung', 'EUR') in ('EUR', '')),
         n.id, n.titel
    from passend p
    left join lateral (
      select n.id, n.titel from public.vergabekatalog n
       where n.auftraggeber_id = p.auftraggeber_id and n.id <> p.id and n.status in ('offen', 'unbekannt')
         and n.quell_datum > p.quell_datum + interval '90 days'
         and exists (select 1 from unnest(n.cpv) a, unnest(p.cpv) b where left(a, 4) = left(b, 4))
       order by n.quell_datum desc limit 1
    ) n on true
   order by p.laufzeit_ende
$$;
revoke all on function public.neuausschreibung_radar(uuid, text, text, text[], text[], integer) from public, anon;
grant execute on function public.neuausschreibung_radar(uuid, text, text, text[], text[], integer) to authenticated;

notify pgrst, 'reload schema';
