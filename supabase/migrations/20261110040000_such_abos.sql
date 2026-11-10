-- "Suche abonnieren" (Benjamin 10.11.2026): a visitor of the public search (/demo/suche) leaves only an e-mail address
-- and gets the new public notices for that search once a week, without an account. Double opt-in: the address counts only
-- after the link in the confirmation mail was opened. Every mail carries an unsubscribe link; unsubscribing deletes the
-- row. No AI (keyword match like public.demo_suche). Unconfirmed rows are deleted after 7 days.
create table if not exists jarvis_intern.such_abos (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) <= 200 and email ~ '^[^@[:space:]<>,;"]+@[^@[:space:]<>,;"]+\.[a-z]{2,}$'),
  suche text not null default '' check (length(suche) <= 120),
  gebiet text not null default '' check (length(gebiet) <= 60),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  erstellt timestamptz not null default now(),
  angefragt timestamptz not null default now(),   -- last confirmation mail
  bestaetigt timestamptz,                         -- double opt-in: link in the mail opened
  einwilligung text not null check (length(einwilligung) <= 600),  -- wording the visitor agreed to
  geprueft timestamptz,                           -- last weekly check (with or without hits)
  letzte_mail timestamptz,
  mails integer not null default 0,
  check (suche <> '' or gebiet <> ''),
  unique (email, suche, gebiet)
);
revoke all on jarvis_intern.such_abos from public, anon, authenticated;

-- New subscription from the web worker (database role of the worker, never anon: the token must only travel by mail).
-- Returns {status, token}: 'neu' (send the confirmation mail), 'warten' (a mail went out less than 10 minutes ago),
-- 'schon' (already confirmed), 'zu_viele' (limit reached). Limits against abuse of our mailbox: 60 new subscriptions a
-- day in total, 5 open confirmations per address.
create or replace function jarvis_intern.such_abo_anlegen(email text, suche text, gebiet text, einwilligung text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e text := lower(btrim(coalesce(email, ''))); s text := left(btrim(coalesce(suche, '')), 120); g text := left(btrim(coalesce(gebiet, '')), 60);
  a jarvis_intern.such_abos;
begin
  if (s = '' and g = '') or e !~ '^[^@[:space:]<>,;"]+@[^@[:space:]<>,;"]+\.[a-z]{2,}$' or length(e) > 200 then raise exception 'EINGABE'; end if;
  delete from jarvis_intern.such_abos x where x.bestaetigt is null and x.erstellt < now() - interval '7 days';
  select * into a from jarvis_intern.such_abos x where x.email = e and x.suche = s and x.gebiet = g;
  if a.id is not null then
    if a.bestaetigt is not null then return jsonb_build_object('status', 'schon'); end if;
    if a.angefragt > now() - interval '10 minutes' then return jsonb_build_object('status', 'warten'); end if;
    update jarvis_intern.such_abos x set angefragt = now() where x.id = a.id;
    return jsonb_build_object('status', 'neu', 'token', a.token);
  end if;
  if (select count(*) from jarvis_intern.such_abos x where x.erstellt > now() - interval '1 day') >= 60
     or (select count(*) from jarvis_intern.such_abos x where x.email = e and x.bestaetigt is null) >= 5 then
    return jsonb_build_object('status', 'zu_viele');
  end if;
  insert into jarvis_intern.such_abos (email, suche, gebiet, einwilligung) values (e, s, g, left(coalesce(einwilligung, ''), 600)) returning * into a;
  return jsonb_build_object('status', 'neu', 'token', a.token);
end $$;
revoke all on function jarvis_intern.such_abo_anlegen(text, text, text, text) from public, anon, authenticated;

-- Link in the confirmation mail. The token is the secret, so this may be called without login.
create or replace function public.such_abo_bestaetigen(token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a jarvis_intern.such_abos;
begin
  if coalesce(token, '') !~ '^[0-9a-f]{64}$' then return null; end if;
  update jarvis_intern.such_abos x set bestaetigt = coalesce(x.bestaetigt, now()) where x.token = such_abo_bestaetigen.token returning * into a;
  if a.id is null then return null; end if;
  return jsonb_build_object('suche', a.suche, 'gebiet', a.gebiet);
end $$;

-- Unsubscribe link in every mail: deletes the subscription (and with it the address).
create or replace function public.such_abo_abmelden(token text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(token, '') !~ '^[0-9a-f]{64}$' then return false; end if;
  delete from jarvis_intern.such_abos x where x.token = such_abo_abmelden.token;
  return found;
end $$;

-- What a subscription is about (for the unsubscribe page), by token.
create or replace function public.such_abo_zeigen(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('suche', a.suche, 'gebiet', a.gebiet) from jarvis_intern.such_abos a
  where a.token = such_abo_zeigen.token and such_abo_zeigen.token ~ '^[0-9a-f]{64}$'
$$;
revoke all on function public.such_abo_bestaetigen(text), public.such_abo_abmelden(text), public.such_abo_zeigen(text) from public;
grant execute on function public.such_abo_bestaetigen(text), public.such_abo_abmelden(text), public.such_abo_zeigen(text) to anon, authenticated;

-- New open notices for one subscription since a point in time: same matching as public.demo_suche, at most 15.
create or replace function jarvis_intern.such_abo_treffer(suche text, gebiet text, seit timestamptz)
returns table (id text, titel text, auftraggeber text, ort text, frist timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare s text := left(btrim(coalesce(suche, '')), 120); g text := left(btrim(coalesce(gebiet, '')), 60);
begin
  return query
    select k.id, left(k.titel, 300), left(k.auftraggeber, 200), left(k.ort, 120), k.frist
    from public.vergabekatalog k
    where k.quell_datum > seit
      and (s = '' or to_tsvector('german', k.titel || ' ' || k.beschreibung) @@ websearch_to_tsquery('german', s))
      and (g = '' or k.ort ilike '%' || replace(replace(g, '%', ''), '_', '') || '%' or exists (select 1 from unnest(k.plz) p where p like left(regexp_replace(g, '[^0-9]', '', 'g'), 5) || '%' and g ~ '^[0-9]{2,5}$'))
      and k.status in ('offen', 'unbekannt') and (k.frist is null or k.frist > now())
    order by k.quell_datum desc, k.id limit 15;
end $$;
revoke all on function jarvis_intern.such_abo_treffer(text, text, timestamptz) from public, anon, authenticated;

-- Operator overview: how many subscriptions there are.
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
                  from jarvis_intern.such_abos));
end $$;

notify pgrst, 'reload schema';
