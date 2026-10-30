-- Registration with name, firm and address. The data travels in the sign-up (auth user metadata); after the
-- e-mail is confirmed, registrierung_abschliessen() creates the firm right away when the address is unlocked
-- (freigaben), otherwise it stores a request that the operator unlocks on /konto/freischalten.

alter table public.firmen
  add column strasse text not null default '' check (length(strasse) <= 200),
  add column plz text not null default '' check (length(plz) <= 10),
  add column ort text not null default '' check (length(ort) <= 100),
  add column telefon text not null default '' check (length(telefon) <= 40);

-- Operators of Jarvis (WP Digital Ranger): may see and unlock registrations.
create table public.betreiber (email text primary key check (email = lower(email)));
alter table public.betreiber enable row level security; -- no policies: read only through the functions below
insert into public.betreiber (email) values ('benschiffer79@gmail.com');

create table public.registrierungen (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  vorname text not null default '',
  nachname text not null default '',
  firma text not null default '',
  strasse text not null default '',
  plz text not null default '',
  ort text not null default '',
  telefon text not null default '',
  erstellt timestamptz not null default now(),
  freigeschaltet timestamptz
);
alter table public.registrierungen enable row level security;
create policy registrierung_selbst on public.registrierungen for select to authenticated using (user_id = auth.uid());

create or replace function public.ist_betreiber() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.betreiber b join auth.users u on u.email = b.email where u.id = auth.uid())
$$;

-- Called after login when the person has no firm yet. Returns the new firm's id, or null while the request waits.
create or replace function public.registrierung_abschliessen() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u auth.users;
  m jsonb;
  f uuid;
  firmenname text;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  select * into u from auth.users where id = auth.uid();
  m := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  firmenname := left(trim(coalesce(m->>'firma', '')), 200);
  if length(firmenname) < 2 then return null; end if; -- no registration data (e.g. invited employee)
  if exists (select 1 from public.mitglieder where user_id = auth.uid()) then return null; end if;
  if not exists (select 1 from public.freigaben where email = lower(u.email)) then
    insert into public.registrierungen (user_id, email, vorname, nachname, firma, strasse, plz, ort, telefon)
    values (u.id, lower(u.email), left(coalesce(m->>'vorname', ''), 100), left(coalesce(m->>'nachname', ''), 100), firmenname,
            left(coalesce(m->>'strasse', ''), 200), left(coalesce(m->>'plz', ''), 10), left(coalesce(m->>'ort', ''), 100), left(coalesce(m->>'telefon', ''), 40))
    on conflict (user_id) do nothing;
    return null;
  end if;
  insert into public.firmen (name, strasse, plz, ort, telefon)
  values (firmenname, left(coalesce(m->>'strasse', ''), 200), left(coalesce(m->>'plz', ''), 10), left(coalesce(m->>'ort', ''), 100), left(coalesce(m->>'telefon', ''), 40))
  returning id into f;
  insert into public.mitglieder (firma_id, user_id, rolle, alle_bereiche, anzeigename)
  values (f, u.id, 'inhaber', true, left(trim(coalesce(m->>'vorname', '') || ' ' || coalesce(m->>'nachname', '')), 200));
  insert into public.protokoll (firma_id, user_id, aktion) values (f, u.id, 'firma_angelegt');
  update public.registrierungen set freigeschaltet = coalesce(freigeschaltet, now()) where user_id = u.id;
  return f;
end $$;

create or replace function public.registrierungen_offen()
returns table (user_id uuid, email text, vorname text, nachname text, firma text, strasse text, plz text, ort text, telefon text, erstellt timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt'; end if;
  return query select r.user_id, r.email, r.vorname, r.nachname, r.firma, r.strasse, r.plz, r.ort, r.telefon, r.erstellt
    from public.registrierungen r where r.freigeschaltet is null order by r.erstellt;
end $$;

-- Unlocks the address; the firm is created on the person's next visit (registrierung_abschliessen). Returns the e-mail.
create or replace function public.registrierung_freischalten(person uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare e text;
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt'; end if;
  update public.registrierungen set freigeschaltet = now() where user_id = person and freigeschaltet is null returning email into e;
  if e is null then raise exception 'unbekannt'; end if;
  insert into public.freigaben (email, notiz) values (e, 'Registrierung') on conflict (email) do nothing;
  return e;
end $$;

revoke all on function public.ist_betreiber(), public.registrierung_abschliessen(), public.registrierungen_offen(), public.registrierung_freischalten(uuid) from public, anon;
grant execute on function public.ist_betreiber(), public.registrierung_abschliessen(), public.registrierungen_offen(), public.registrierung_freischalten(uuid) to authenticated;
