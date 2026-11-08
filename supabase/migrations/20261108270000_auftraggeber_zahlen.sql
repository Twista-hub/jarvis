-- Authority pages (08.11.2026): counts and open list without the 400-row cap of the history list
-- (large authorities showed "400 in the last 12 months").

create or replace function public.auftraggeber_oeffentlich(a text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with alle as (
    select v.id, v.titel, v.auftraggeber, v.ort, v.frist, v.status, v.quell_datum, v.cpv, v.laufzeit_ende, v.zuschlaege
    from public.vergabekatalog v
    where v.quelle = 'bks' and jarvis_intern.ag_slug(v.auftraggeber) = left(auftraggeber_oeffentlich.a, 150)
      and auftraggeber_oeffentlich.a <> 'auftraggeber-nicht-angegeben' and v.quell_datum > now() - interval '3 years'
    order by v.quell_datum desc limit 400
  ), zahl as (
    -- Counts without the 400-row cap of the lists.
    select v.frist, v.status, v.quell_datum from public.vergabekatalog v
    where v.quelle = 'bks' and jarvis_intern.ag_slug(v.auftraggeber) = left(auftraggeber_oeffentlich.a, 150)
      and auftraggeber_oeffentlich.a <> 'auftraggeber-nicht-angegeben' and v.quell_datum > now() - interval '3 years'
  ), offen_alle as (
    select v.id, v.titel, v.frist from public.vergabekatalog v
    where v.quelle = 'bks' and jarvis_intern.ag_slug(v.auftraggeber) = left(auftraggeber_oeffentlich.a, 150)
      and auftraggeber_oeffentlich.a <> 'auftraggeber-nicht-angegeben' and v.frist > now() and v.status in ('offen', 'unbekannt')
  ), neu as (select * from alle order by quell_datum desc limit 1)
  select case when not exists (select 1 from alle) then null else jsonb_build_object(
    'id', left(auftraggeber_oeffentlich.a, 150),
    'name', (select left(auftraggeber, 200) from neu),
    'ort', (select left(ort, 160) from neu),
    'offen_anzahl', (select count(*) from zahl where frist > now() and status in ('offen', 'unbekannt')),
    'jahr', (select count(*) from zahl where quell_datum > now() - interval '1 year'),
    'gesamt', (select count(*) from zahl),
    'offen', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titel', left(x.titel, 200), 'frist', x.frist) order by x.frist)
                       from (select * from offen_alle order by frist limit 30) x), '[]'::jsonb),
    'frueher', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'titel', left(x.titel, 200), 'datum', x.quell_datum::date, 'status', x.status,
                           'laufzeit_ende', x.laufzeit_ende,
                           'zuschlag_wert', (select sum((z->>'wert')::numeric) from jsonb_array_elements(case when jsonb_typeof(x.zuschlaege) = 'array' then x.zuschlaege else '[]'::jsonb end) z
                                             where coalesce(z->>'waehrung', 'EUR') = 'EUR' and (z->>'wert') ~ '^[0-9]+(\.[0-9]+)?$'))
                         order by x.quell_datum desc)
                       from (select * from alle where not (frist > now() and status in ('offen', 'unbekannt')) order by quell_datum desc limit 25) x), '[]'::jsonb),
    'cpv', coalesce((select jsonb_agg(c) from (select c from alle, unnest(alle.cpv[1:2]) c group by c order by count(*) desc limit 12) y), '[]'::jsonb)
  ) end
$$;
revoke all on function public.auftraggeber_oeffentlich(text) from public;
grant execute on function public.auftraggeber_oeffentlich(text) to anon, authenticated;

notify pgrst, 'reload schema';
