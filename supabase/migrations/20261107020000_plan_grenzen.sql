-- Plan limits (Benjamin 07.11.2026: "fang mit den Plan-Grenzen an"; limits from docs/abos.md and web/src/plaene.ts).
-- Nothing is ever deleted: limits only stop NEW users, field workers, locations and Steckbriefe. "test" (full preview
-- access) stays unlimited. New firms get the trial agreed on 03.11.2026: 30 days of Pro, at most 10 Steckbriefe from
-- documents, then Free.

alter table public.firmen add column if not exists probe_bis timestamptz;

-- Trial for every new free firm; existing free firms get the rest of their 30 days.
create or replace function jarvis_intern.probe_setzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.paket = 'kostenlos' and new.probe_bis is null then new.probe_bis := now() + interval '30 days'; end if;
  return new;
end $$;
drop trigger if exists firmen_probe on public.firmen;
create trigger firmen_probe before insert on public.firmen for each row execute function jarvis_intern.probe_setzen();
update public.firmen set probe_bis = erstellt + interval '30 days' where paket = 'kostenlos' and probe_bis is null and erstellt > now() - interval '30 days';

-- The trial end belongs to billing like the plan itself.
create or replace function jarvis_intern.paket_schuetzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not public.ist_betreiber() and (
       new.paket is distinct from old.paket or new.stripe_kunde is distinct from old.stripe_kunde or new.stripe_abo is distinct from old.stripe_abo
    or new.abo_status is distinct from old.abo_status or new.abo_bis is distinct from old.abo_bis
    or new.abo_zahlweise is distinct from old.abo_zahlweise or new.abo_kuendigt is distinct from old.abo_kuendigt
    or new.probe_bis is distinct from old.probe_bis) then
    raise exception 'Der Plan kann nur über die Abrechnung geändert werden';
  end if;
  return new;
end $$;

-- Effective plan: the stored one, "probe" during the trial of a free firm, old "erfolg" counts as business.
create or replace function jarvis_intern.plan_von(f uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case when x.paket = 'kostenlos' and x.probe_bis > now() then 'probe'
              when x.paket = 'erfolg' then 'business'
              when x.paket in ('kostenlos', 'basis', 'pro', 'business', 'test') then x.paket
              else 'test' end
  from public.firmen x where x.id = f
$$;
revoke all on function jarvis_intern.plan_von(uuid) from public, anon, authenticated;

-- One limit of a plan; null = unlimited. Switches are 1 (yes) or 0 (no). Keep in step with GRENZEN in web/src/plaene.ts.
create or replace function jarvis_intern.plan_grenze(plan text, art text) returns integer
language sql immutable set search_path = '' as $$
  select case art
    when 'suchprofile'       then case plan when 'kostenlos' then 1 when 'basis' then 3 when 'pro' then 10 when 'probe' then 10 else null end
    when 'laender'           then case plan when 'kostenlos' then 1 when 'basis' then 2 else null end
    when 'buero'             then case plan when 'kostenlos' then 1 when 'basis' then 3 when 'pro' then 5 when 'probe' then 5 when 'business' then 15 else null end
    when 'einsatzkraefte'    then case plan when 'kostenlos' then 0 when 'basis' then 0 when 'pro' then 25 when 'probe' then 25 when 'business' then 100 else null end
    when 'standorte'         then case plan when 'kostenlos' then 1 when 'basis' then 1 when 'pro' then 5 when 'probe' then 5 else null end
    when 'steckbriefe'       then case plan when 'kostenlos' then 0 when 'basis' then 5 when 'pro' then 30 when 'probe' then 10 when 'business' then 100 else null end
    when 'arbeitsoberflaeche' then case when plan in ('kostenlos', 'basis') then 0 else 1 end
    when 'unterlagen'        then case when plan = 'kostenlos' then 0 else 1 end
    when 'taeglich'          then case when plan = 'kostenlos' then 0 else 1 end
  end
$$;
revoke all on function jarvis_intern.plan_grenze(text, text) from public, anon, authenticated;

-- Steckbriefe from uploaded documents: one row per started evaluation (counted per calendar month, in the trial in total).
create table if not exists public.steckbrief_nutzung (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  vorgang_id uuid references public.vorgaenge on delete set null,
  user_id uuid references auth.users on delete set null,
  zeit timestamptz not null default now()
);
create index if not exists steckbrief_nutzung_firma on public.steckbrief_nutzung (firma_id, zeit);
alter table public.steckbrief_nutzung enable row level security;
create policy steckbrief_nutzung_lesen on public.steckbrief_nutzung for select to authenticated using (public.meine_rolle(firma_id) is not null);
revoke all on public.steckbrief_nutzung from anon;
grant select on public.steckbrief_nutzung to authenticated;

create or replace function jarvis_intern.steckbriefe_genutzt(f uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.steckbrief_nutzung n
   where n.firma_id = f
     and n.zeit >= case when jarvis_intern.plan_von(f) = 'probe' then (select x.erstellt from public.firmen x where x.id = f)
                        else date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' end
$$;
revoke all on function jarvis_intern.steckbriefe_genutzt(uuid) from public, anon, authenticated;

-- Books one Steckbrief before the upload starts. Returns null when it may start, otherwise the reason ('grenze', 'plan').
-- A second upload for the same tender within an hour (files sent later) is not counted again.
create or replace function public.steckbrief_buchen(f uuid, vorgang uuid default null) returns text
language plpgsql security definer set search_path = '' as $$
declare plan text; grenze integer;
begin
  if coalesce(public.meine_rolle(f), '') not in ('inhaber', 'admin', 'bearbeiter', 'standortleitung') then raise exception 'keine Berechtigung'; end if;
  perform 1 from public.firmen where id = f for update;  -- one booking at a time per firm
  plan := jarvis_intern.plan_von(f);
  grenze := jarvis_intern.plan_grenze(plan, 'steckbriefe');
  if vorgang is not null and exists (select 1 from public.steckbrief_nutzung n where n.firma_id = f and n.vorgang_id = vorgang and n.zeit > now() - interval '1 hour') then
    return null;
  end if;
  if grenze = 0 then return 'plan'; end if;
  if grenze is not null and jarvis_intern.steckbriefe_genutzt(f) >= grenze then return 'grenze'; end if;
  insert into public.steckbrief_nutzung (firma_id, vorgang_id, user_id) values (f, vorgang, auth.uid());
  return null;
end $$;
revoke all on function public.steckbrief_buchen(uuid, uuid) from public, anon;
grant execute on function public.steckbrief_buchen(uuid, uuid) to authenticated;

-- Plan, trial and usage for the app (members of the firm only).
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
    'grenzen', (select jsonb_object_agg(a, jarvis_intern.plan_grenze(plan, a)) from unnest(arten) a),
    'genutzt', jsonb_build_object(
      'buero', (select count(*) from public.mitglieder m where m.firma_id = f and m.aktiv and m.rolle in ('inhaber', 'admin', 'bearbeiter', 'standortleitung')),
      'buero_offen', (select count(*) from public.einladungen e where e.firma_id = f and e.angenommen is null and e.gueltig_bis > now() and e.rolle in ('admin', 'bearbeiter', 'standortleitung')),
      'einsatzkraefte', (select count(*) from public.mitglieder m where m.firma_id = f and m.aktiv and m.rolle = 'mitarbeiter'),
      'einsatzkraefte_offen', (select count(*) from public.einladungen e where e.firma_id = f and e.angenommen is null and e.gueltig_bis > now() and e.rolle = 'mitarbeiter'),
      'standorte', (select count(*) from public.bereiche b where b.firma_id = f and b.art = 'standort'),
      'steckbriefe', jarvis_intern.steckbriefe_genutzt(f)));
end $$;
revoke all on function public.plan_stand(uuid) from public, anon;
grant execute on function public.plan_stand(uuid) to authenticated;

-- Office users and field workers with their own login: no new ones above the plan (existing ones stay).
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
  grenze := jarvis_intern.plan_grenze(jarvis_intern.plan_von(new.firma_id), art);
  if grenze is null then return new; end if;
  select count(*) into anzahl from public.mitglieder m
   where m.firma_id = new.firma_id and m.user_id <> new.user_id and m.aktiv
     and (case when m.rolle in ('inhaber', 'admin', 'bearbeiter', 'standortleitung') then 'buero' when m.rolle = 'mitarbeiter' then 'einsatzkraefte' end) = art;
  if anzahl >= grenze then
    raise exception 'Plan-Grenze: %', case art when 'buero' then 'Büro-Nutzer' else 'Einsatzkräfte' end using errcode = 'P0001', hint = 'plan_grenze_' || art;
  end if;
  return new;
end $$;
drop trigger if exists mitglieder_plan on public.mitglieder;
create trigger mitglieder_plan before insert or update of rolle, aktiv on public.mitglieder for each row execute function jarvis_intern.mitglieder_plan();

-- Locations (art standort): no new ones above the plan.
create or replace function jarvis_intern.bereiche_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
declare grenze integer;
begin
  if new.art <> 'standort' or (tg_op = 'UPDATE' and old.art = 'standort') then return new; end if;
  grenze := jarvis_intern.plan_grenze(jarvis_intern.plan_von(new.firma_id), 'standorte');
  if grenze is not null and (select count(*) from public.bereiche b where b.firma_id = new.firma_id and b.art = 'standort' and b.id <> new.id) >= grenze then
    raise exception 'Plan-Grenze: Standorte' using errcode = 'P0001', hint = 'plan_grenze_standorte';
  end if;
  return new;
end $$;
drop trigger if exists bereiche_plan on public.bereiche;
create trigger bereiche_plan before insert or update of art on public.bereiche for each row execute function jarvis_intern.bereiche_plan();

-- Further search profiles: as many as the plan allows (main profile + extras), technically at most 3 extras.
create or replace function public.suchprofil_zusatz(f uuid, profile jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  erlaubt integer := least(3, greatest(0, coalesce((public.plan_stand(f)->'grenzen'->>'suchprofile')::int, 4) - 1));
  bisher integer := coalesce((select jsonb_array_length(s.einstellungen->'zusatzprofile') from public.suchprofile s
                               where s.firma_id = f and s.bereich_id is null and jsonb_typeof(s.einstellungen->'zusatzprofile') = 'array'), 0);
begin
  if jsonb_typeof(profile) <> 'array' or jsonb_array_length(profile) > 3 or length(profile::text) > 20000 then raise exception 'Höchstens 3 weitere Suchprofile'; end if;
  -- Above the plan only fewer, never more (after a downgrade the extra profiles can still be edited or removed;
  -- the daily search uses only as many as the plan allows).
  if jsonb_array_length(profile) > greatest(erlaubt, bisher) then
    raise exception 'Plan-Grenze: Suchprofile' using errcode = 'P0001', hint = 'plan_grenze_suchprofile';
  end if;
  update public.suchprofile s set einstellungen = jsonb_set(s.einstellungen, '{zusatzprofile}', profile, true)
   where s.firma_id = f and s.bereich_id is null;
  if not found then raise exception 'Suchprofil nicht gefunden oder keine Berechtigung'; end if;
end $$;
revoke all on function public.suchprofil_zusatz(uuid, jsonb) from public, anon;
grant execute on function public.suchprofil_zusatz(uuid, jsonb) to authenticated;

-- Benjamin's example firm "Rheinland Facility Service GmbH (Beispiel)" went to Basis only through the Stripe test purchase
-- on 07.11.2026 (cancelled, runs out on 07.12.); it is a demo firm and keeps the full preview access. No-op elsewhere.
update public.firmen set paket = 'test' where id = 'c3401eb9-aa97-47a9-887d-2287c07363ff' and paket = 'basis';
