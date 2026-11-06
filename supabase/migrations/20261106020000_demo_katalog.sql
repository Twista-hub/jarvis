-- Öffentliche Demo (Benjamin 06.11.2026): Jeder kann ohne Anmeldung in den echten öffentlichen Bekanntmachungen suchen
-- (amtliche Quellen mit offener Lizenz, die auch auf /ausschreibungen gezeigt werden). Keine KI, keine Kundendaten:
-- keine Bewertungen, keine Treffer, keine Steckbriefe von Kunden. Dazu neutrale Beispiel-Steckbriefe, einmalig von der
-- KI nur aus der öffentlichen Bekanntmachung geschrieben (alarm/demo_steckbriefe.py), ohne Bezug zu einer Firma.
create table if not exists jarvis_intern.demo_steckbriefe (
  katalog_id text primary key check (length(katalog_id) <= 400),
  titel text not null check (length(titel) <= 400),
  auftraggeber text not null default '' check (length(auftraggeber) <= 300),
  ort text not null default '' check (length(ort) <= 200),
  frist timestamptz,
  link text not null default '' check (length(link) <= 1000),
  gewerk text not null default '' check (length(gewerk) <= 60),
  markdown text not null check (length(markdown) between 200 and 60000),
  kosten numeric(8,4),
  erstellt timestamptz not null default now()
);
revoke all on jarvis_intern.demo_steckbriefe from public, anon, authenticated;

-- Search: at most 30 hits, only the public columns. Empty search shows the newest open notices.
create or replace function public.demo_suche(suche text default '', gebiet text default '', zustand text default 'offen')
returns table (id text, titel text, auftraggeber text, ort text, frist timestamptz, link text, quell_datum timestamptz, status text, quelle text, steckbrief boolean)
language plpgsql stable security definer set search_path = '' as $$
declare s text := left(btrim(coalesce(suche, '')), 120); g text := left(btrim(coalesce(gebiet, '')), 60); offen boolean := coalesce(zustand, 'offen') <> 'alle';
begin
  return query
    select k.id, left(k.titel, 300), left(k.auftraggeber, 200), left(k.ort, 120), k.frist, k.link, k.quell_datum, k.status, k.quelle,
           exists (select 1 from jarvis_intern.demo_steckbriefe d where d.katalog_id = k.id)
    from public.vergabekatalog k
    where (s = '' or to_tsvector('german', k.titel || ' ' || k.beschreibung) @@ websearch_to_tsquery('german', s))
      and (g = '' or k.ort ilike '%' || replace(replace(g, '%', ''), '_', '') || '%' or exists (select 1 from unnest(k.plz) p where p like left(regexp_replace(g, '[^0-9]', '', 'g'), 5) || '%' and g ~ '^[0-9]{2,5}$'))
      and (not offen or (k.status in ('offen', 'unbekannt') and (k.frist is null or k.frist > now())))
    order by k.quell_datum desc, k.id limit 30;
end $$;
revoke all on function public.demo_suche(text, text, text) from public;
grant execute on function public.demo_suche(text, text, text) to anon, authenticated;

-- One notice: public facts, lot titles and the neutral sample Steckbrief, if there is one.
create or replace function public.demo_eintrag(i text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', k.id, 'titel', left(k.titel, 300), 'auftraggeber', left(k.auftraggeber, 200), 'ort', left(k.ort, 120), 'frist', k.frist,
    'link', k.link, 'status', k.status, 'quelle', k.quelle, 'quell_datum', k.quell_datum, 'beschreibung', left(k.beschreibung, 2500),
    'cpv', to_jsonb(k.cpv[1:6]),
    'lose', coalesce((select jsonb_agg(left(l->>'titel', 200)) from (select x as l from jsonb_array_elements(case when jsonb_typeof(k.lose) = 'array' then k.lose else '[]'::jsonb end) x limit 20) y), '[]'::jsonb),
    'steckbrief', (select d.markdown from jarvis_intern.demo_steckbriefe d where d.katalog_id = k.id))
  from public.vergabekatalog k where k.id = left(i, 400)
$$;
revoke all on function public.demo_eintrag(text) from public;
grant execute on function public.demo_eintrag(text) to anon, authenticated;

-- The sample Steckbriefe for the demo start (also when the notice has already left the catalog).
create or replace function public.demo_steckbriefe() returns table (katalog_id text, titel text, auftraggeber text, ort text, frist timestamptz, gewerk text)
language sql stable security definer set search_path = '' as $$
  select d.katalog_id, d.titel, d.auftraggeber, d.ort, d.frist, d.gewerk from jarvis_intern.demo_steckbriefe d
  order by (d.frist is not null and d.frist > now()) desc, d.erstellt desc limit 30
$$;
revoke all on function public.demo_steckbriefe() from public;
grant execute on function public.demo_steckbriefe() to anon, authenticated;

-- A sample Steckbrief whose notice has left the catalog: read it directly.
create or replace function public.demo_steckbrief(i text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', d.katalog_id, 'titel', d.titel, 'auftraggeber', d.auftraggeber, 'ort', d.ort, 'frist', d.frist,
    'link', d.link, 'steckbrief', d.markdown)
  from jarvis_intern.demo_steckbriefe d where d.katalog_id = left(i, 400)
$$;
revoke all on function public.demo_steckbrief(text) from public;
grant execute on function public.demo_steckbrief(text) to anon, authenticated;
notify pgrst, 'reload schema';
