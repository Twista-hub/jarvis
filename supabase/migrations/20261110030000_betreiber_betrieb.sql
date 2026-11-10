-- Operator page: state of operations at a glance (10.11.2026). The catalogue stood still from 06. to 09.11. because the
-- source delivered empty daily exports, and nobody noticed for four days. One read-only call for the operator; every
-- part is a small indexed query (vergabekatalog_quell_datum), no table scan.
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
    'firmen', (select count(*) from public.firmen));
end $$;
revoke all on function public.betreiber_betrieb() from public, anon;
grant execute on function public.betreiber_betrieb() to authenticated;

notify pgrst, 'reload schema';
