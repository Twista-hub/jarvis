-- Keep an optional company website with the firm and carry it through verified sign-up metadata.
alter table public.firmen add column website text not null default ''
  check (length(website) <= 300 and (website = '' or website ~ '^https://[^[:space:]]+$'));

create or replace function public.registrierung_abschliessen() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  u auth.users;
  m jsonb;
  f uuid;
  firmenname text;
  website_url text;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  select * into u from auth.users where id = auth.uid();
  m := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  firmenname := left(trim(coalesce(m->>'firma', '')), 200);
  if length(firmenname) < 2 then return null; end if;
  if exists (select 1 from public.mitglieder where user_id = auth.uid()) then return null; end if;
  website_url := left(trim(coalesce(m->>'website', '')), 300);
  if website_url <> '' and website_url !~ '^https://[^[:space:]]+$' then website_url := ''; end if;
  insert into public.firmen (name, paket, strasse, plz, ort, telefon, website)
  values (firmenname, 'kostenlos', left(coalesce(m->>'strasse', ''), 200), left(coalesce(m->>'plz', ''), 10),
          left(coalesce(m->>'ort', ''), 100), left(coalesce(m->>'telefon', ''), 40), website_url)
  returning id into f;
  insert into public.mitglieder (firma_id, user_id, rolle, alle_bereiche, anzeigename)
  values (f, u.id, 'inhaber', true, left(trim(coalesce(m->>'vorname', '') || ' ' || coalesce(m->>'nachname', '')), 200));
  insert into public.protokoll (firma_id, user_id, aktion) values (f, u.id, 'firma_angelegt');
  return f;
end $$;
