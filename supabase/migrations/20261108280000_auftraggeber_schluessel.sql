-- Unique buyer keys (08.11.2026): the buyer id in the catalogue was a hash of the notice's buyer identifier, but in many
-- German notices that identifier is generic, so hundreds of different authorities shared one id (follow a buyer, buyer
-- filter, /konto/auftraggeber, re-tender radar). The key is now built in the database from the name and the postal
-- code of the buyer: 'bks:<name-slug>[:<plz>]'. Notices without a buyer name get a key of their own.
-- Existing follows (auftraggeber_abos) and contacts (auftraggeber_kontakte) are moved to the new keys where the
-- mapping is clear.

create or replace function jarvis_intern.ag_schluessel(name text, roh jsonb, katalog_id text) returns text
language sql immutable set search_path = '' as $$
  select case when jarvis_intern.ag_slug(name) is null or jarvis_intern.ag_slug(name) = 'auftraggeber-nicht-angegeben'
    then 'bks:unbekannt:' || left(coalesce(katalog_id, ''), 300)
    else 'bks:' || jarvis_intern.ag_slug(name) || coalesce(':' || nullif(left(regexp_replace(coalesce(
      roh->'buyer'->'address'->>'postalCode',
      (select p->'address'->>'postalCode' from jsonb_array_elements(case when jsonb_typeof(roh->'parties') = 'array' then roh->'parties' else '[]'::jsonb end) p
        where p->>'id' = roh->'buyer'->>'id' limit 1), ''), '[^0-9]', '', 'g'), 5), ''), '') end
$$;

create or replace function jarvis_intern.ag_schluessel_setzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.auftraggeber_id := jarvis_intern.ag_schluessel(new.auftraggeber, new.roh, new.id);
  return new;
end $$;
drop trigger if exists ag_schluessel on public.vergabekatalog;
create trigger ag_schluessel before insert or update of auftraggeber, roh, auftraggeber_id on public.vergabekatalog
  for each row when (new.quelle = 'bks') execute function jarvis_intern.ag_schluessel_setzen();

-- Old → new key per notice.
create temporary table ag_umzug as
  select v.id, v.auftraggeber_id as alt, jarvis_intern.ag_schluessel(v.auftraggeber, v.roh, v.id) as neu, v.auftraggeber
  from public.vergabekatalog v where v.quelle = 'bks';
create index on ag_umzug (alt);

-- Follows: the stored name tells which authority was meant; otherwise only a clear (single) new key.
create temporary table ag_abo_umzug as
  select a.firma_id, a.auftraggeber_id as alt, a.name, a.erstellt,
    coalesce(
      (select u.neu from ag_umzug u where u.alt = a.auftraggeber_id and jarvis_intern.ag_slug(u.auftraggeber) = jarvis_intern.ag_slug(a.name)
        group by u.neu order by count(*) desc limit 1),
      (select min(u.neu) from ag_umzug u where u.alt = a.auftraggeber_id having count(distinct u.neu) = 1)) as neu
  from public.auftraggeber_abos a;
delete from public.auftraggeber_abos a using ag_abo_umzug z
  where a.firma_id = z.firma_id and a.auftraggeber_id = z.alt and z.neu is not null and z.neu <> z.alt;
insert into public.auftraggeber_abos (firma_id, auftraggeber_id, name, erstellt)
  select distinct on (firma_id, neu) firma_id, neu, name, erstellt from ag_abo_umzug where neu is not null and neu <> alt
  on conflict do nothing;

-- Contacts: a single new key, or the one authority among the firm's own procedures with that old key.
update public.auftraggeber_kontakte k set auftraggeber_schluessel = z.neu
from (
  select k2.id, coalesce(
    (select min(u.neu) from ag_umzug u where u.alt = k2.auftraggeber_schluessel having count(distinct u.neu) = 1),
    (select min(u.neu) from ag_umzug u join public.vorgaenge g on g.katalog_id = u.id and g.firma_id = k2.firma_id
      where u.alt = k2.auftraggeber_schluessel having count(distinct u.neu) = 1)) as neu
  from public.auftraggeber_kontakte k2
) z
where k.id = z.id and z.neu is not null and z.neu <> k.auftraggeber_schluessel;

-- Rewrite the catalogue (the trigger computes the key).
update public.vergabekatalog v set auftraggeber_id = u.neu from ag_umzug u where v.id = u.id and v.auftraggeber_id <> u.neu;

drop table ag_abo_umzug;
drop table ag_umzug;

notify pgrst, 'reload schema';
