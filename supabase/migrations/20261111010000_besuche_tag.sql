-- Visits from outside per day, channel and source (Benjamin 11.11.2026: can AI assistants bring customers?). The web
-- worker (web/src/zaehler.ts) adds one when a public page is delivered to an arrival from an AI assistant, a search
-- engine, a social network, a directory or another site, or when an assistant fetches a page for one of its users.
-- Only numbers: no visitor, no IP address, no address of the page. Cloudflare's free plan does not show referring sites.
create table if not exists jarvis_intern.besuche_tag (
  tag date not null,
  kanal text not null check (kanal in ('ki', 'ki-abruf', 'suche', 'social', 'verzeichnis', 'sonstige')),
  quelle text not null check (quelle ~ '^[a-z0-9._-]{1,60}$'),
  n integer not null default 0 check (n >= 0),
  primary key (tag, kanal, quelle)
);
revoke all on jarvis_intern.besuche_tag from public, anon, authenticated;

-- One more visit today. Called only with the database role of the web worker. Limits against invented referrers: at most
-- 200 different sources a day (further ones count as "andere") and 20,000 counted visits a day. Rows older than 400 days
-- are removed when a new day starts.
create or replace function jarvis_intern.besuch_zaehlen(kanal text, quelle text) returns void
language plpgsql security definer set search_path = '' as $$
declare k text := lower(coalesce(kanal, '')); q text := left(regexp_replace(lower(coalesce(quelle, '')), '[^a-z0-9._-]', '', 'g'), 60);
  heute date := (now() at time zone 'Europe/Berlin')::date; zeilen integer; summe bigint;
begin
  if k not in ('ki', 'ki-abruf', 'suche', 'social', 'verzeichnis', 'sonstige') or q = '' then return; end if;
  select count(*), coalesce(sum(b.n), 0) into zeilen, summe from jarvis_intern.besuche_tag b where b.tag = heute;
  if summe >= 20000 then return; end if;
  if zeilen = 0 then delete from jarvis_intern.besuche_tag b where b.tag < heute - 400; end if;
  if zeilen >= 200 and not exists (select 1 from jarvis_intern.besuche_tag b where b.tag = heute and b.kanal = k and b.quelle = q) then q := 'andere'; end if;
  insert into jarvis_intern.besuche_tag as b (tag, kanal, quelle, n) values (heute, k, q, 1)
  on conflict on constraint besuche_tag_pkey do update set n = b.n + 1;
end $$;
revoke all on function jarvis_intern.besuch_zaehlen(text, text) from public, anon, authenticated;

-- Operator overview: the visits from outside of the last 30 days, by channel and source.
create or replace function public.betreiber_betrieb() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  return jsonb_build_object(
    'jetzt', now(),
    'katalog_neueste', (select max(quell_datum) from public.vergabekatalog),
    'katalog_24h', (select count(*) from public.vergabekatalog where quell_datum > now() - interval '24 hours'),
    'katalog_7t', (select count(*) from public.vergabekatalog where quell_datum > now() - interval '7 days'),
    'quelle', (select jsonb_build_object('letzter_erfolg', q.letzter_erfolg, 'fehler', q.fehler, 'rueckstand_tage', q.rueckstand_tage)
               from public.katalog_quellen q where q.id = 'bks'),
    'zahlen_stand', (select max(stand) from jarvis_intern.sitemap_cache),
    'letzte_mail', (select max(letzte_mail) from public.benachrichtigungen),
    'push_haengt', (select count(*) from public.push_warteschlange where gesendet is null and erstellt < now() - interval '1 hour'),
    'social_zuletzt', (select max(erstellt) from jarvis_intern.social_posts),
    'fehler_48h', (select count(*) from jarvis_intern.fehler_meldungen where zeit > now() - interval '48 hours'),
    'fehler_letzter', (select jsonb_build_object('zeit', f.zeit, 'text', f.text) from jarvis_intern.fehler_meldungen f
                       where f.zeit > now() - interval '48 hours' order by f.zeit desc limit 1),
    'ki', (select jsonb_build_object('limit_usd', b.limit_usd, 'reserviert', b.reserviert)
           from jarvis_katalog.ki_budget b where b.monat = date_trunc('month', now())::date),
    'ki_firmen_aktiv', (select count(*) from public.suchprofile s where s.aktiv and s.bereich_id is null
                        and s.einstellungen ? 'leistungen' and coalesce(s.einstellungen->>'demo', '') <> 'true'),
    'datenbank_bytes', pg_database_size(current_database()),
    'firmen', (select count(*) from public.firmen),
    'such_abos', (select jsonb_build_object('bestaetigt', count(*) filter (where bestaetigt is not null), 'offen', count(*) filter (where bestaetigt is null),
                                             'neu_7t', count(*) filter (where bestaetigt > now() - interval '7 days'), 'letzte_mail', max(letzte_mail))
                  from jarvis_intern.such_abos),
    'besuche', (select coalesce(jsonb_agg(jsonb_build_object('kanal', x.kanal, 'quelle', x.quelle, 't7', x.t7, 't30', x.t30) order by x.t30 desc, x.kanal, x.quelle), '[]'::jsonb)
                from (select b.kanal, b.quelle, sum(b.n) filter (where b.tag > (now() at time zone 'Europe/Berlin')::date - 7) as t7, sum(b.n) as t30
                      from jarvis_intern.besuche_tag b where b.tag > (now() at time zone 'Europe/Berlin')::date - 30
                      group by b.kanal, b.quelle order by sum(b.n) desc limit 40) x));
end $$;

notify pgrst, 'reload schema';
