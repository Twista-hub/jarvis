-- Add-ons (Benjamin 07.11.2026 "bau die Zusatzkäufe ein"; prices from 03.11.2026, web/src/plaene.ts ZUSATZ):
-- further field workers with their own login (Pro 3.50 €, Business 3 €, from the 501st 2.50 € a month) as a quantity on
-- the Stripe subscription, and Steckbrief packs (10 for 15 €, one-off, do not expire) used after the monthly allowance.
-- Set by the Stripe webhook or by the operator (invoice customers); customers cannot change them directly.
alter table public.firmen
  add column if not exists zusatz_einsatzkraefte integer not null default 0 check (zusatz_einsatzkraefte between 0 and 5000),
  add column if not exists steckbrief_guthaben integer not null default 0 check (steckbrief_guthaben between 0 and 100000);
alter table public.steckbrief_nutzung add column if not exists aus_paket boolean not null default false;

create or replace function jarvis_intern.paket_schuetzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not public.ist_betreiber() and (
       new.paket is distinct from old.paket or new.stripe_kunde is distinct from old.stripe_kunde or new.stripe_abo is distinct from old.stripe_abo
    or new.abo_status is distinct from old.abo_status or new.abo_bis is distinct from old.abo_bis
    or new.abo_zahlweise is distinct from old.abo_zahlweise or new.abo_kuendigt is distinct from old.abo_kuendigt
    or new.probe_bis is distinct from old.probe_bis or new.zusatz_einsatzkraefte is distinct from old.zusatz_einsatzkraefte
    or new.steckbrief_guthaben > old.steckbrief_guthaben) then  -- using up a pack (steckbrief_buchen) only lowers it
    raise exception 'Der Plan kann nur über die Abrechnung geändert werden';
  end if;
  return new;
end $$;

-- Limit of one firm: the plan's limit plus booked add-ons (field workers only in Pro and Business).
create or replace function jarvis_intern.grenze_firma(f uuid, art text) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare plan text := jarvis_intern.plan_von(f); g integer := jarvis_intern.plan_grenze(plan, art);
begin
  if g is not null and art = 'einsatzkraefte' and plan in ('pro', 'business') then
    g := g + coalesce((select x.zusatz_einsatzkraefte from public.firmen x where x.id = f), 0);
  end if;
  return g;
end $$;
revoke all on function jarvis_intern.grenze_firma(uuid, text) from public, anon, authenticated;

-- The monthly allowance counts only Steckbriefe that did not come from a pack.
create or replace function jarvis_intern.steckbriefe_genutzt(f uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.steckbrief_nutzung n
   where n.firma_id = f and not n.aus_paket
     and n.zeit >= case when jarvis_intern.plan_von(f) = 'probe' then (select x.erstellt from public.firmen x where x.id = f)
                        else date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' end
$$;

create or replace function public.steckbrief_buchen(f uuid, vorgang uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare plan text; grenze integer; aus_paket boolean := false;
begin
  if coalesce(public.meine_rolle(f), '') not in ('inhaber', 'admin', 'bearbeiter', 'standortleitung') then raise exception 'keine Berechtigung'; end if;
  perform 1 from public.firmen where id = f for update;  -- one booking at a time per firm
  plan := jarvis_intern.plan_von(f);
  grenze := jarvis_intern.plan_grenze(plan, 'steckbriefe');
  if vorgang is not null and exists (select 1 from public.steckbrief_nutzung n where n.firma_id = f and n.vorgang_id = vorgang and n.zeit > now() - interval '1 hour') then
    return null;
  end if;
  if grenze = 0 then return 'plan'; end if;
  if grenze is not null and jarvis_intern.steckbriefe_genutzt(f) >= grenze then
    -- Monthly allowance used: take one from a bought pack, if there is one.
    update public.firmen set steckbrief_guthaben = steckbrief_guthaben - 1 where id = f and steckbrief_guthaben > 0;
    if not found then return 'grenze'; end if;
    aus_paket := true;
  end if;
  insert into public.steckbrief_nutzung (firma_id, vorgang_id, user_id, aus_paket) values (f, vorgang, auth.uid(), aus_paket);
  return null;
end $$;
revoke all on function public.steckbrief_buchen(uuid, uuid) from public, anon;
grant execute on function public.steckbrief_buchen(uuid, uuid) to authenticated;

create or replace function public.plan_stand(f uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare plan text; arten text[] := array['suchprofile','laender','buero','einsatzkraefte','standorte','steckbriefe','arbeitsoberflaeche','unterlagen','taeglich'];
begin
  if public.meine_rolle(f) is null then raise exception 'keine Berechtigung'; end if;
  plan := jarvis_intern.plan_von(f);
  return jsonb_build_object(
    'plan', plan,
    'paket', (select x.paket from public.firmen x where x.id = f),
    'probe_bis', (select x.probe_bis from public.firmen x where x.id = f),
    'grenzen', (select jsonb_object_agg(a, jarvis_intern.grenze_firma(f, a)) from unnest(arten) a),
    'zusatz', jsonb_build_object(
      'einsatzkraefte', (select x.zusatz_einsatzkraefte from public.firmen x where x.id = f),
      'steckbrief_guthaben', (select x.steckbrief_guthaben from public.firmen x where x.id = f)),
    'genutzt', jsonb_build_object(
      'buero', (select count(*) from public.mitglieder m where m.firma_id = f and m.aktiv and m.rolle in ('inhaber', 'admin', 'bearbeiter', 'standortleitung')),
      'buero_offen', (select count(*) from public.einladungen e where e.firma_id = f and e.angenommen is null and e.gueltig_bis > now() and e.rolle in ('admin', 'bearbeiter', 'standortleitung')),
      'einsatzkraefte', (select count(*) from public.mitglieder m where m.firma_id = f and m.aktiv and m.rolle = 'mitarbeiter'),
      'einsatzkraefte_offen', (select count(*) from public.einladungen e where e.firma_id = f and e.angenommen is null and e.gueltig_bis > now() and e.rolle = 'mitarbeiter'),
      'standorte', (select count(*) from public.bereiche b where b.firma_id = f and b.art = 'standort'),
      'steckbriefe', jarvis_intern.steckbriefe_genutzt(f)));
end $$;

create or replace function jarvis_intern.mitglieder_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare art text; grenze integer; anzahl integer;
begin
  if not new.aktiv then return new; end if;
  art := case when new.rolle in ('inhaber', 'admin', 'bearbeiter', 'standortleitung') then 'buero' when new.rolle = 'mitarbeiter' then 'einsatzkraefte' end;
  if art is null then return new; end if;  -- readers are free
  if tg_op = 'UPDATE' and old.aktiv and (case when old.rolle in ('inhaber', 'admin', 'bearbeiter', 'standortleitung') then 'buero' when old.rolle = 'mitarbeiter' then 'einsatzkraefte' end) = art then
    return new;
  end if;
  grenze := jarvis_intern.grenze_firma(new.firma_id, art);
  if grenze is null then return new; end if;
  select count(*) into anzahl from public.mitglieder m
   where m.firma_id = new.firma_id and m.user_id <> new.user_id and m.aktiv
     and (case when m.rolle in ('inhaber', 'admin', 'bearbeiter', 'standortleitung') then 'buero' when m.rolle = 'mitarbeiter' then 'einsatzkraefte' end) = art;
  if anzahl >= grenze then
    raise exception 'Plan-Grenze: %', case art when 'buero' then 'Büro-Nutzer' else 'Einsatzkräfte' end using errcode = 'P0001', hint = 'plan_grenze_' || art;
  end if;
  return new;
end $$;

-- Webhook: also the number of booked field workers (null = unchanged) and bought Steckbriefe (added to the credit).
drop function if exists jarvis_intern.stripe_ereignis(text, text, uuid, text, text, text, text, timestamptz, text, boolean);
create or replace function jarvis_intern.stripe_ereignis(ereignis text, typ text, firma uuid, paket text, kunde text, abo text, status text,
  bis timestamptz, zahlweise text, kuendigt boolean, kraefte integer default null, steckbriefe_plus integer default null) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into jarvis_intern.stripe_ereignisse (id, typ, firma_id) values (ereignis, typ, firma) on conflict do nothing;
  if not found then return false; end if;
  if firma is null or not exists (select 1 from public.firmen where id = firma) then return true; end if;
  update public.firmen set
    paket = coalesce(stripe_ereignis.paket, firmen.paket),
    stripe_kunde = coalesce(kunde, firmen.stripe_kunde),
    stripe_abo = case when stripe_ereignis.status = 'canceled' then null else coalesce(abo, firmen.stripe_abo) end,
    abo_status = coalesce(stripe_ereignis.status, firmen.abo_status),
    abo_bis = coalesce(bis, firmen.abo_bis),
    abo_zahlweise = coalesce(zahlweise, firmen.abo_zahlweise),
    abo_kuendigt = coalesce(kuendigt, firmen.abo_kuendigt),
    zusatz_einsatzkraefte = least(5000, greatest(0, coalesce(kraefte, firmen.zusatz_einsatzkraefte))),
    steckbrief_guthaben = least(100000, firmen.steckbrief_guthaben + greatest(0, coalesce(steckbriefe_plus, 0)))
  where id = firma;
  return true;
end $$;
revoke all on function jarvis_intern.stripe_ereignis(text, text, uuid, text, text, text, text, timestamptz, text, boolean, integer, integer) from public, anon, authenticated;

-- Operator (invoice customers): booked field workers and Steckbrief credit added or taken away.
create or replace function public.betreiber_zusatz(f uuid, kraefte integer, guthaben_plus integer default 0)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  if kraefte not between 0 and 5000 then raise exception 'UNGUELTIG'; end if;
  update public.firmen set zusatz_einsatzkraefte = kraefte, steckbrief_guthaben = greatest(0, steckbrief_guthaben + coalesce(guthaben_plus, 0)) where id = f;
  if not found then raise exception 'NICHT_GEFUNDEN'; end if;
end $$;
revoke all on function public.betreiber_zusatz(uuid, integer, integer) from public, anon;
grant execute on function public.betreiber_zusatz(uuid, integer, integer) to authenticated;
notify pgrst, 'reload schema';

-- Operator list of firms: also trial end and add-ons.
drop function if exists public.betreiber_firmen();
create function public.betreiber_firmen()
returns table (id uuid, name text, erstellt timestamptz, website text, paket text, ki_budget_usd numeric, ki_verbraucht numeric,
               mitglieder integer, inhaber text, letzte_anmeldung timestamptz, probe_bis timestamptz, zusatz_einsatzkraefte integer, steckbrief_guthaben integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  return query
    select f.id, f.name, f.erstellt, f.website, f.paket, f.ki_budget_usd,
           round(coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = f.id), 0), 2),
           (select count(*)::integer from public.mitglieder m where m.firma_id = f.id and m.aktiv),
           (select string_agg(u.email::text, ', ' order by m.erstellt) from public.mitglieder m join auth.users u on u.id = m.user_id
             where m.firma_id = f.id and m.rolle = 'inhaber' and m.aktiv),
           (select max(u.last_sign_in_at) from public.mitglieder m join auth.users u on u.id = m.user_id where m.firma_id = f.id and m.aktiv),
           f.probe_bis, f.zusatz_einsatzkraefte, f.steckbrief_guthaben
    from public.firmen f
    order by f.erstellt desc
    limit 500;
end $$;
revoke all on function public.betreiber_firmen() from public, anon;
grant execute on function public.betreiber_firmen() to authenticated;
notify pgrst, 'reload schema';
