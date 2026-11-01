-- Calculation templates by name (e.g. "Gastro", "Reinigung", "Event") and a comparison with published
-- award values of similar tenders from the shared catalogue.

create table if not exists public.kalkulationsprofile (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  eingaben jsonb not null check (jsonb_typeof(eingaben) = 'object' and length(eingaben::text) <= 4000),
  erstellt timestamptz not null default now(),
  unique (firma_id, name)
);
alter table public.kalkulationsprofile enable row level security;
create policy lesen on public.kalkulationsprofile for select to authenticated using (jarvis_intern.darf_finanzen(firma_id, null));
create policy verwalten on public.kalkulationsprofile for all to authenticated
  using (jarvis_intern.darf_finanzen(firma_id, null) and public.darf_bearbeiten(firma_id, null))
  with check (jarvis_intern.darf_finanzen(firma_id, null) and public.darf_bearbeiten(firma_id, null));
grant select, insert, update, delete on public.kalkulationsprofile to authenticated;
revoke all on public.kalkulationsprofile from anon;

create or replace function jarvis_intern.kalkulationsprofile_limit() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.kalkulationsprofile where firma_id = new.firma_id and id <> new.id) >= 30 then
    raise exception 'Höchstens 30 Kalkulationsvorlagen je Firma';
  end if;
  return new;
end $$;
drop trigger if exists kalkulationsprofile_limit on public.kalkulationsprofile;
create trigger kalkulationsprofile_limit before insert on public.kalkulationsprofile for each row execute function jarvis_intern.kalkulationsprofile_limit();

-- Awarded tenders with a published value that share a CPV group (first 5 digits) or a key word.
create or replace function public.zuschlag_vergleich(f uuid, worte text[] default '{}', cpv text[] default '{}', ohne text default '')
returns table (id text, titel text, auftraggeber text, ort text, datum timestamptz, wert numeric, gewinner text, link text)
language sql stable security invoker set search_path = '' as $$
  with z as (
    select k.id, k.titel, k.auftraggeber, k.ort, k.link, k.cpv, k.titel || ' ' || k.beschreibung as text, a
    from public.vergabekatalog k, jsonb_array_elements(k.zuschlaege) a
    where public.meine_rolle(f) in ('inhaber','admin','bearbeiter','leser','standortleitung')
      and k.id <> ohne
      and jsonb_typeof(a->'wert') = 'number' and (a->>'wert')::numeric > 0
      and coalesce(a->>'waehrung', 'EUR') in ('EUR', '')
  )
  select z.id, z.titel, z.auftraggeber, z.ort, (z.a->>'datum')::timestamptz, (z.a->>'wert')::numeric,
         coalesce((select string_agg(g, ', ') from jsonb_array_elements_text(z.a->'gewinner') g), ''), z.link
  from z
  where (cardinality(cpv) > 0 and exists (select 1 from unnest(z.cpv) c, unnest(cpv) q where left(c, 5) = left(q, 5)))
     or (cardinality(worte) > 0 and to_tsvector('german', z.text) @@ to_tsquery('german',
          (select string_agg(quote_literal(w) || ':*', ' | ') from unnest(worte[1:6]) w where w ~ '^[[:alpha:]äöüÄÖÜß]{4,40}$')))
  order by (z.a->>'datum') desc nulls last
  limit 12
$$;
revoke all on function public.zuschlag_vergleich(uuid, text[], text[], text) from public, anon;
grant execute on function public.zuschlag_vergleich(uuid, text[], text[], text) to authenticated;
