-- Operator page, part 2 (Benjamin 03.11.2026): see all firms with plan, AI budget and AI usage, and set the AI limit
-- (no limit, trial 5.50 $, demo 0) and the plan without SQL. Users still cannot change either value themselves.

-- The two protection triggers now let the operator through (only via the security definer functions below, because
-- the operator is a member of his own firms only and row level security blocks direct updates of other firms).
create or replace function jarvis_intern.probe_ki() returns trigger
language plpgsql set search_path = '' as $$
declare d text;
begin
  if tg_op = 'UPDATE' and auth.uid() is not null and new.ki_budget_usd is distinct from old.ki_budget_usd
     and not public.ist_betreiber() then
    raise exception 'Das KI-Kontingent setzt nur der Betreiber' using errcode = '42501';
  end if;
  if new.ki_budget_usd = 0 and coalesce(new.website, '') <> '' and (tg_op = 'INSERT' or new.website is distinct from old.website) then
    d := jarvis_intern.web_domain(new.website);
    if d ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'
       and d not in ('gmail.com', 'googlemail.com', 'gmx.de', 'gmx.net', 'web.de', 't-online.de', 'outlook.com', 'hotmail.com', 'yahoo.com', 'yahoo.de', 'icloud.com', 'freenet.de', 'mail.de', 'posteo.de', 'facebook.com', 'instagram.com', 'linkedin.com', 'google.com', 'sites.google.com')
       and not exists (select 1 from public.firmen x where x.id <> new.id and jarvis_intern.web_domain(x.website) = d) then
      new.ki_budget_usd := 5.50;
    end if;
  end if;
  return new;
end $$;

create or replace function jarvis_intern.paket_schuetzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and new.paket is distinct from old.paket and not public.ist_betreiber() then
    raise exception 'Der Plan kann nur über die Abrechnung geändert werden';
  end if;
  return new;
end $$;

-- All firms, newest first: plan, AI limit and usage, members, owner login and last sign-in (operator only).
create or replace function public.betreiber_firmen()
returns table (id uuid, name text, erstellt timestamptz, website text, paket text, ki_budget_usd numeric, ki_verbraucht numeric,
               mitglieder integer, inhaber text, letzte_anmeldung timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  return query
    select f.id, f.name, f.erstellt, f.website, f.paket, f.ki_budget_usd,
           round(coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = f.id), 0), 2),
           (select count(*)::integer from public.mitglieder m where m.firma_id = f.id and m.aktiv),
           (select string_agg(u.email::text, ', ' order by m.erstellt) from public.mitglieder m join auth.users u on u.id = m.user_id
             where m.firma_id = f.id and m.rolle = 'inhaber' and m.aktiv),
           (select max(u.last_sign_in_at) from public.mitglieder m join auth.users u on u.id = m.user_id where m.firma_id = f.id and m.aktiv)
    from public.firmen f
    order by f.erstellt desc
    limit 500;
end $$;

-- Sets the AI limit of one firm: null = no limit, 0 = demo (no AI), otherwise the budget in USD.
create or replace function public.betreiber_ki_budget(f uuid, budget numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  if budget is not null and (budget < 0 or budget > 10000) then raise exception 'UNGUELTIG'; end if;
  update public.firmen set ki_budget_usd = budget where id = f;
  if not found then raise exception 'NICHT_GEFUNDEN'; end if;
end $$;

-- Sets the plan of one firm (until billing does it automatically).
create or replace function public.betreiber_paket(f uuid, neu text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  if neu not in ('kostenlos', 'test', 'basis', 'pro', 'erfolg') then raise exception 'UNGUELTIG'; end if;
  update public.firmen set paket = neu where id = f;
  if not found then raise exception 'NICHT_GEFUNDEN'; end if;
end $$;

revoke all on function public.betreiber_firmen(), public.betreiber_ki_budget(uuid, numeric), public.betreiber_paket(uuid, text) from public, anon;
grant execute on function public.betreiber_firmen(), public.betreiber_ki_budget(uuid, numeric), public.betreiber_paket(uuid, text) to authenticated;
notify pgrst, 'reload schema';
