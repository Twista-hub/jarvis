-- Search profile: quick exclusions from a 👎 hit (H2), further search profiles (H3) and a preview of last week's
-- matches before saving (H1). Changes only the named key, so a running search that writes its progress into the
-- same row is not overwritten. Row rights decide (only owners/administration may change the search profile).

create or replace function public.suchprofil_ausschluss(f uuid, wort text, entfernen boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  w text := lower(regexp_replace(trim(coalesce(wort, '')), '\s+', ' ', 'g'));
  liste jsonb;
begin
  if length(w) < 3 or length(w) > 60 then raise exception 'Ungültiges Wort'; end if;
  update public.suchprofile s
     set einstellungen = jsonb_set(s.einstellungen, '{ausschluss_schnell}',
       case when entfernen then coalesce((select jsonb_agg(x) from jsonb_array_elements_text(coalesce(s.einstellungen->'ausschluss_schnell', '[]')) x where x <> w), '[]')
            else (select jsonb_agg(distinct x) from (select jsonb_array_elements_text(coalesce(s.einstellungen->'ausschluss_schnell', '[]')) x union select w) t) end, true)
   where s.firma_id = f and s.bereich_id is null
     and (entfernen or jsonb_array_length(coalesce(s.einstellungen->'ausschluss_schnell', '[]')) < 40)
  returning s.einstellungen->'ausschluss_schnell' into liste;
  if liste is null then raise exception 'Suchprofil nicht gefunden, keine Berechtigung oder schon 40 Wörter'; end if;
  return liste;
end $$;
revoke all on function public.suchprofil_ausschluss(uuid, text, boolean) from public, anon;
grant execute on function public.suchprofil_ausschluss(uuid, text, boolean) to authenticated;

-- H3: the further profiles live in einstellungen->zusatzprofile (list of objects, at most 3), set as a whole.
create or replace function public.suchprofil_zusatz(f uuid, profile jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(profile) <> 'array' or jsonb_array_length(profile) > 3 or length(profile::text) > 20000 then
    raise exception 'Höchstens 3 weitere Suchprofile';
  end if;
  update public.suchprofile s set einstellungen = jsonb_set(s.einstellungen, '{zusatzprofile}', profile, true)
   where s.firma_id = f and s.bereich_id is null;
  if not found then raise exception 'Suchprofil nicht gefunden oder keine Berechtigung'; end if;
end $$;
revoke all on function public.suchprofil_zusatz(uuid, jsonb) from public, anon;
grant execute on function public.suchprofil_zusatz(uuid, jsonb) to authenticated;

-- H1: how many notices of the last days the profile's words, codes, area and contract value would have found.
-- Only the free pre-selection (no AI), at most 300 rows; the app compares the edited profile with the saved one.
create or replace function public.suchprofil_vorschau(f uuid, muster text, ausschluss text default '', cpv text[] default '{}',
  plz text[] default '{}', wert_min numeric default null, wert_max numeric default null, wert_unbekannt boolean default true, tage integer default 7)
returns table (id text, titel text, auftraggeber text, ort text, wert numeric, quell_datum timestamptz)
language sql stable security invoker set search_path = '' set statement_timeout = '8s' as $$
  with k as (
    select k.id, k.titel, k.auftraggeber, k.ort, k.quell_datum, k.cpv, k.plz,
           lower(k.titel || ' ' || k.beschreibung) as text,
           coalesce(nullif(k.roh #>> '{tender,value,amount}', '')::numeric,
                    (select sum((l #>> '{value,amount}')::numeric) from jsonb_array_elements(coalesce(k.roh #> '{tender,lots}', '[]')) l
                      where jsonb_typeof(l #> '{value,amount}') = 'number')) as wert
      from public.vergabekatalog k
     where public.meine_rolle(suchprofil_vorschau.f) in ('inhaber', 'admin')
       and k.quell_datum >= now() - make_interval(days => least(greatest(suchprofil_vorschau.tage, 1), 14))
       and k.status in ('offen', 'unbekannt', 'vergeben', 'abgeschlossen')
  )
  select k.id, k.titel, k.auftraggeber, k.ort, k.wert, k.quell_datum from k
   where (k.text ~ suchprofil_vorschau.muster
          or exists (select 1 from unnest(k.cpv) c, unnest(suchprofil_vorschau.cpv) p where c like p || '%'))
     and (suchprofil_vorschau.ausschluss = '' or k.text !~ suchprofil_vorschau.ausschluss)
     and (cardinality(suchprofil_vorschau.plz) = 0 or exists (select 1 from unnest(k.plz) p where left(p, 2) = any(suchprofil_vorschau.plz)))
     and (case when k.wert is null or k.wert <= 0 then suchprofil_vorschau.wert_unbekannt or (suchprofil_vorschau.wert_min is null and suchprofil_vorschau.wert_max is null)
               else (suchprofil_vorschau.wert_min is null or k.wert >= suchprofil_vorschau.wert_min) and (suchprofil_vorschau.wert_max is null or k.wert <= suchprofil_vorschau.wert_max) end)
   order by k.quell_datum desc
   limit 300
$$;
revoke all on function public.suchprofil_vorschau(uuid, text, text, text[], text[], numeric, numeric, boolean, integer) from public, anon;
grant execute on function public.suchprofil_vorschau(uuid, text, text, text[], text[], numeric, numeric, boolean, integer) to authenticated;
