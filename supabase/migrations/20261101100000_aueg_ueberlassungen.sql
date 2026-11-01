-- N13 AÜG-Wächter: assignments of temporary workers to a hirer (Entleiher) with a period. The app computes the
-- equal pay date (9 months, § 8 Abs. 4 AÜG) and the maximum assignment period (18 months, § 1 Abs. 1b AÜG); earlier
-- assignments to the same hirer count when the gap between them is not more than three months.
create table if not exists public.ueberlassungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  entleiher text not null check (length(trim(entleiher)) between 2 and 200),
  von date not null,
  bis date,
  vorgang_id uuid,
  notiz text not null default '' check (length(notiz) <= 300),
  erstellt timestamptz not null default now(),
  check (bis is null or bis >= von),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete set null (vorgang_id)
);
create index if not exists ueberlassungen_person on public.ueberlassungen (personal_id, von);
alter table public.ueberlassungen enable row level security;
create policy lesen on public.ueberlassungen for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = ueberlassungen.firma_id and public.darf_bereich(p.firma_id, p.bereich_id))
   and public.meine_rolle(firma_id) <> 'mitarbeiter');
create policy verwalten on public.ueberlassungen for all to authenticated
  using (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = ueberlassungen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)))
  with check (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = ueberlassungen.firma_id and public.darf_bearbeiten(p.firma_id, p.bereich_id)));
grant select, insert, update, delete on public.ueberlassungen to authenticated;
revoke all on public.ueberlassungen from anon;

-- The change log names the person and the hirer ("Eva Muster bei Messe Berlin").
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
    case when tg_table_name = 'ueberlassungen' then
      (select trim(p.vorname || ' ' || p.nachname) from public.personal p where p.id = (zeile->>'personal_id')::uuid) || ' bei ' || (zeile->>'entleiher') end,
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

drop trigger if exists protokoll on public.ueberlassungen;
create trigger protokoll after insert or update or delete on public.ueberlassungen for each row execute function jarvis_intern.protokollieren();
