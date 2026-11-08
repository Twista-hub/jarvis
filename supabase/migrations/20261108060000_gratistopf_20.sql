-- Benjamin 08.11.2026: shared monthly AI pot of all free firms (incl. the 30-day trial) from 5 to 20 USD, so new trial
-- customers keep AI ratings (about 20 sign-ups with a website a month). Paid plans and the 90 USD monthly cap are unchanged.
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
                 where k.zeit >= monat and jarvis_katalog.ki_planbudget(f.paket) is null and f.ki_budget_usd is not null), 0) + betrag > 20 then
      return 'topf';
    end if;
  end if;
  return null;
end $$;
revoke all on function jarvis_katalog.ki_firmensperre(uuid, numeric) from public, anon, authenticated;

create or replace function jarvis_intern.topf_melden() returns void
language plpgsql security definer set search_path = '' as $$
declare t text := format('Gratis-KI-Topf (20 USD) für %s aufgebraucht. Gratis-Firmen bekommen bis zum Monatswechsel nur Stichwort-Treffer; zahlende Kunden sind nicht betroffen.', to_char(now(), 'MM/YYYY'));
begin
  if not exists (select 1 from jarvis_intern.fehler_meldungen m where m.art = 'budget' and m.text = t) then
    perform public.fehler_melden('budget', t);
  end if;
end $$;
revoke all on function jarvis_intern.topf_melden() from public, anon, authenticated;
