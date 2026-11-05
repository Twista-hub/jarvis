-- Katalogsuche unter "Markt & Chancen" (Klickprüfung 05.11.2026: einmal 8,5 s und Abbruch durch die Zeitgrenze).
-- Ursachen: Die Rollenprüfung lief als Funktionsaufruf je Zeile, und ohne Suchbegriff sortierte die Datenbank alle offenen
-- Bekanntmachungen samt Rohdaten nach Datum. Jetzt: Rolle einmal prüfen, für die häufigen Ansichten ohne Suchbegriff
-- (offene Aufträge, Zuschläge) eigene Teilindizes in Sortierreihenfolge, die nach 60 Treffern aufhören zu lesen.
create index if not exists vergabekatalog_offen_neueste on public.vergabekatalog (quell_datum desc, id) where status in ('offen', 'unbekannt');
create index if not exists vergabekatalog_zuschlaege_neueste on public.vergabekatalog (quell_datum desc, id) where jsonb_array_length(zuschlaege) > 0;

create or replace function public.katalog_suche(f uuid, suche text default '', gebiet text default '', kaeufer text default '', zustand text default 'offen')
returns setof public.vergabekatalog
language plpgsql stable security invoker set search_path = '' as $$
begin
  if coalesce(public.meine_rolle(f), '') not in ('inhaber', 'admin', 'bearbeiter', 'leser', 'standortleitung') then return; end if;
  suche := coalesce(suche, ''); gebiet := coalesce(gebiet, ''); kaeufer := coalesce(kaeufer, '');
  if suche = '' and gebiet = '' and kaeufer = '' and zustand = 'offen' then
    return query select k.* from public.vergabekatalog k
      where k.status in ('offen', 'unbekannt') and (k.frist is null or k.frist > now())
      order by k.quell_datum desc, k.id limit 60;
  elsif suche = '' and gebiet = '' and kaeufer = '' and zustand = 'zuschlaege' then
    return query select k.* from public.vergabekatalog k
      where jsonb_array_length(k.zuschlaege) > 0
      order by k.quell_datum desc, k.id limit 60;
  else
    return query select k.* from public.vergabekatalog k
      where (suche = '' or to_tsvector('german', k.titel || ' ' || k.beschreibung) @@ websearch_to_tsquery('german', left(suche, 300)))
        and (gebiet = '' or k.ort ilike '%' || left(gebiet, 100) || '%' or exists (select 1 from unnest(k.plz) p where p like left(gebiet, 5) || '%'))
        and (kaeufer = '' or k.auftraggeber_id = kaeufer)
        and ((zustand = 'alle') or (zustand = 'offen' and k.status in ('offen', 'unbekannt') and (k.frist is null or k.frist > now()))
             or (zustand = 'zuschlaege' and jsonb_array_length(k.zuschlaege) > 0))
      order by k.quell_datum desc, k.id limit 60;
  end if;
end $$;
revoke all on function public.katalog_suche(uuid, text, text, text, text) from public, anon;
grant execute on function public.katalog_suche(uuid, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
