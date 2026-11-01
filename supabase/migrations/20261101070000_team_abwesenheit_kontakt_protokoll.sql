-- Firma & Team: absences with a period (G2, neutral reasons), an optional photo per worker (G3), a contact person per location (G4)
-- and a change log that only owners can read (G5).

-- G2: absences (holiday, sick, other) with a period. Visible and editable like the worker itself.
create table if not exists public.personal_abwesenheiten (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  von date not null,
  bis date not null,
  -- Neutral reasons only: a "sick" reason would be health data (Art. 9 GDPR) and is not needed for planning.
  grund text not null default 'urlaub' check (grund in ('urlaub', 'schulung', 'abwesend')),
  notiz text not null default '' check (length(notiz) <= 200),
  erstellt timestamptz not null default now(),
  check (bis >= von and bis - von <= 366)
);
create index if not exists personal_abwesenheiten_person on public.personal_abwesenheiten (personal_id, bis);
alter table public.personal_abwesenheiten enable row level security;
create policy lesen on public.personal_abwesenheiten for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_abwesenheiten.firma_id and public.darf_bereich(p.firma_id, p.bereich_id)));
create policy verwalten on public.personal_abwesenheiten for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_abwesenheiten.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_abwesenheiten.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
grant select, insert, update, delete on public.personal_abwesenheiten to authenticated;
revoke all on public.personal_abwesenheiten from anon;

-- G3: whether a photo is stored for the worker (the file lives in the private bucket, served after a rights check).
alter table public.personal add column if not exists foto boolean not null default false;

-- G4: contact person per location.
alter table public.bereiche
  add column if not exists ansprechpartner text not null default '' check (length(ansprechpartner) <= 120),
  add column if not exists telefon text not null default '' check (length(telefon) <= 40),
  add column if not exists email text not null default '' check (length(email) <= 200);

-- G5: change log. Written only by triggers (security definer), read only by the firm's owners.
create table if not exists public.aenderungsprotokoll (
  id bigint generated always as identity primary key,
  firma_id uuid not null references public.firmen on delete cascade,
  user_id uuid,
  wer text not null default '',
  bereich text not null,
  aktion text not null check (aktion in ('INSERT', 'UPDATE', 'DELETE')),
  datensatz text not null default '',
  aenderungen jsonb not null default '[]',
  zeit timestamptz not null default now()
);
create index if not exists aenderungsprotokoll_firma_zeit on public.aenderungsprotokoll (firma_id, zeit desc);
alter table public.aenderungsprotokoll enable row level security;
create policy lesen on public.aenderungsprotokoll for select to authenticated using (public.meine_rolle(firma_id) = 'inhaber');
revoke all on public.aenderungsprotokoll from anon, authenticated;
grant select on public.aenderungsprotokoll to authenticated;

create or replace function jarvis_intern.protokollieren() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  alt jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  neu jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  zeile jsonb := coalesce(neu, alt);
  firma uuid := (zeile->>'firma_id')::uuid;
  uid uuid := auth.uid();
  name text;
  liste jsonb := '[]';
  k text;
  ignorieren text[] := array['erstellt', 'geaendert', 'token_hash', 'steckbrief', 'roh', 'abgerufen', 'letzte_mail', 'id', 'firma_id'];
  kurz text := '';
begin
  -- Only changes made by a person in the app. Background jobs and cascades from deleting a login or a firm
  -- are not logged (the firm may already be gone in the same statement).
  if uid is null or firma is null or not exists (select 1 from public.firmen where id = firma) then
    return null;
  end if;
  name := left(coalesce(
    nullif(trim(coalesce(zeile->>'vorname', '') || ' ' || coalesce(zeile->>'nachname', '')), ''),
    zeile->>'titel', zeile->>'name', zeile->>'auftraggeber', zeile->>'email', zeile->>'anzeigename',
    case when tg_table_name = 'mitglied_bereiche' then
      (select nullif(m.anzeigename, '') from public.mitglieder m where m.firma_id = firma and m.user_id = (zeile->>'user_id')::uuid) end,
    case when tg_table_name = 'personal_abwesenheiten' then
      (select trim(p.vorname || ' ' || p.nachname) from public.personal p where p.id = (zeile->>'personal_id')::uuid) end,
    ''), 160);
  if tg_op = 'UPDATE' then
    for k in select key from jsonb_each(neu) loop
      if not k = any(ignorieren) and (alt->k) is distinct from (neu->k) then
        liste := liste || jsonb_build_array(jsonb_build_object('feld', k,
          'alt', case when jsonb_typeof(alt->k) in ('object', 'array') then null else left(alt->>k, 60) end,
          'neu', case when jsonb_typeof(neu->k) in ('object', 'array') then null else left(neu->>k, 60) end));
      end if;
    end loop;
    if jsonb_array_length(liste) = 0 then return null; end if;
  end if;
  if tg_table_name = 'personal_abwesenheiten' then
    kurz := coalesce(zeile->>'grund', '') || ' ' || coalesce(zeile->>'von', '') || ' bis ' || coalesce(zeile->>'bis', '');
    liste := case when tg_op = 'UPDATE' then liste else jsonb_build_array(jsonb_build_object('feld', 'zeitraum', 'alt', null, 'neu', kurz)) end;
  end if;
  insert into public.aenderungsprotokoll (firma_id, user_id, wer, bereich, aktion, datensatz, aenderungen)
  values (firma, uid,
    coalesce((select nullif(m.anzeigename, '') from public.mitglieder m where m.firma_id = firma and m.user_id = uid),
             (select u.email from auth.users u where u.id = uid), ''),
    tg_table_name, tg_op, name, liste);
  -- Keep twelve months; cleaned up now and then while writing.
  if random() < 0.02 then
    delete from public.aenderungsprotokoll where zeit < now() - interval '12 months';
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['personal', 'personal_abwesenheiten', 'mitglieder', 'einladungen', 'bereiche', 'vorgaenge',
    'firmenunterlagen', 'referenzen', 'kalkulationsvorlagen', 'kalkulationsprofile', 'angebotsmappen', 'suchprofile',
    'firmen_tarifvertraege', 'mitglied_bereiche']
  loop
    execute format('drop trigger if exists protokoll on public.%I', t);
    execute format('create trigger protokoll after insert or update or delete on public.%I for each row execute function jarvis_intern.protokollieren()', t);
  end loop;
end $$;
