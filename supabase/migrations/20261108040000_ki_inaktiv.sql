-- Cost protection for free firms (docs/abos.md, Benjamin 08.11.2026 "mach 3"): when nobody of a free firm (no paid plan) has
-- been active for 30 days, its AI pauses ('inaktiv') until someone logs in again. Activity = last sign-in or last session
-- refresh of an active member. Paid plans and the full preview access are never paused.
create or replace function jarvis_intern.zuletzt_aktiv(f uuid) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare t timestamptz; s timestamptz;
begin
  select max(u.last_sign_in_at) into t from public.mitglieder m join auth.users u on u.id = m.user_id where m.firma_id = f and m.aktiv;
  if to_regclass('auth.sessions') is not null then
    execute 'select max(coalesce(s.refreshed_at, s.updated_at, s.created_at)) from auth.sessions s join public.mitglieder m on m.user_id = s.user_id where m.firma_id = $1 and m.aktiv'
      into s using f;
    t := greatest(t, s);
  end if;
  return t;
exception when undefined_column then
  return t;
end $$;
revoke all on function jarvis_intern.zuletzt_aktiv(uuid) from public, anon, authenticated;

create or replace function jarvis_katalog.ki_firmensperre(firma uuid, betrag numeric) returns text
language plpgsql stable set search_path = '' as $$
declare grenze numeric; p text; plan numeric; monat timestamptz := date_trunc('month', now());
begin
  if firma is null then return null; end if;
  select ki_budget_usd, paket into grenze, p from public.firmen where id = firma;
  if not found then return null; end if;
  plan := jarvis_katalog.ki_planbudget(p);
  if plan is not null then
    -- Paid plan: monthly allowance of this firm.
    if coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = firma and k.zeit >= monat), 0) + betrag > plan then
      return 'plan';
    end if;
  elsif grenze is not null then
    -- Free firm in demo or trial: its own one-off budget ...
    if grenze <= 0 then return 'demo'; end if;
    -- Nobody of the firm active for 30 days (and the firm older than that): pause until the next login.
    if (select x.erstellt from public.firmen x where x.id = firma) < now() - interval '30 days'
       and coalesce(jarvis_intern.zuletzt_aktiv(firma), '-infinity'::timestamptz) < now() - interval '30 days' then
      return 'inaktiv';
    end if;
    if coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = firma), 0) + betrag > grenze then
      return 'probe';
    end if;
    -- ... and the shared monthly pot of all free firms, so paying customers keep the rest of the monthly budget.
    if coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k join public.firmen f on f.id = k.firma_id
                 where k.zeit >= monat and jarvis_katalog.ki_planbudget(f.paket) is null and f.ki_budget_usd is not null), 0) + betrag > 5 then
      return 'topf';
    end if;
  end if;
  return null;
end $$;
revoke all on function jarvis_katalog.ki_firmensperre(uuid, numeric) from public, anon, authenticated;
