-- Everyone who registers and confirms the e-mail gets a firm right away, in the free plan "kostenlos"
-- (what it includes is decided later). The manual unlock by the operator is no longer needed.
alter table public.firmen drop constraint firmen_paket_check;
alter table public.firmen add constraint firmen_paket_check check (paket in ('kostenlos', 'test', 'basis', 'pro', 'erfolg'));

drop function public.registrierung_freischalten(uuid);
drop function public.registrierungen_offen();
drop function public.ist_betreiber();
drop table public.registrierungen;
drop table public.betreiber;

-- Called after login when the person has no firm yet. Login is only possible with a confirmed e-mail.
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
  insert into public.firmen (name, paket, strasse, plz, ort, telefon)
  values (firmenname, 'kostenlos', left(coalesce(m->>'strasse', ''), 200), left(coalesce(m->>'plz', ''), 10), left(coalesce(m->>'ort', ''), 100), left(coalesce(m->>'telefon', ''), 40))
  returning id into f;
  insert into public.mitglieder (firma_id, user_id, rolle, alle_bereiche, anzeigename)
  values (f, u.id, 'inhaber', true, left(trim(coalesce(m->>'vorname', '') || ' ' || coalesce(m->>'nachname', '')), 200));
  insert into public.protokoll (firma_id, user_id, aktion) values (f, u.id, 'firma_angelegt');
  return f;
end $$;

-- Creating a firm by hand (people without registration data) is open too, also in the free plan.
create or replace function public.firma_anlegen(name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare f uuid;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  insert into public.firmen (name, paket) values (firma_anlegen.name, 'kostenlos') returning id into f;
  insert into public.mitglieder (firma_id, user_id, rolle, alle_bereiche) values (f, auth.uid(), 'inhaber', true);
  insert into public.protokoll (firma_id, user_id, aktion) values (f, auth.uid(), 'firma_angelegt');
  return f;
end $$;
