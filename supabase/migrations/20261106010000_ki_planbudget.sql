-- KI-Kostenbremse nach Plan (Benjamin 06.11.2026: "sonst verbrauchen Gratis-Firmen das Budget und zahlende Kunden bekommen
-- nichts mehr"). Gilt ab sofort, auch bevor die übrigen Plangrenzen (Nutzer, Suchprofile) durchgesetzt werden.
-- * Bezahlte Pläne: KI-Kontingent pro Firma und Kalendermonat: Basis 10 $, Pro 25 $, Business 60 $ (deckt laut
--   docs/ki-kosten-plaene.md die Volllast der passenden Firmengröße). Darüber: keine KI-Anfragen bis zum Monatswechsel
--   (Suche mit Wort-/Leistungstreffern läuft weiter).
-- * Gratis-Firmen in Demo (0 $) oder Probezeit (5,50 $ einmalig) teilen sich zusätzlich einen gemeinsamen Topf von 5 $ im
--   Monat. Ist er leer, bekommen sie bis zum Monatswechsel keine KI mehr, die zahlenden Kunden aber weiter.
-- * Firmen ohne Grenze (ki_budget_usd null, vom Betreiber gesetzt: eigene Firmen, Tester) bleiben ohne Grenze.
-- * Plan "business" als eigener Wert (vorher nur "erfolg", das als Business zählt).
alter table public.firmen drop constraint if exists firmen_paket_check;
alter table public.firmen add constraint firmen_paket_check check (paket in ('kostenlos', 'test', 'basis', 'pro', 'business', 'erfolg'));

create or replace function jarvis_katalog.ki_planbudget(paket text) returns numeric
language sql immutable set search_path = '' as $$
  select case paket when 'basis' then 10 when 'pro' then 25 when 'business' then 60 when 'erfolg' then 60 else null end::numeric
$$;
revoke all on function jarvis_katalog.ki_planbudget(text) from public, anon, authenticated;

create or replace function jarvis_katalog.ki_reservieren_fuer(betrag numeric, zweck text, firma uuid) returns uuid
language plpgsql set search_path = '' as $$
declare i uuid; grenze numeric; p text; plan numeric; monat timestamptz := date_trunc('month', now());
begin
  select ki_budget_usd, paket into grenze, p from public.firmen where id = firma;
  plan := jarvis_katalog.ki_planbudget(p);
  if plan is not null then
    -- Paid plan: monthly allowance of this firm.
    if coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = firma and k.zeit >= monat), 0) + betrag > plan then
      return null;
    end if;
  elsif grenze is not null then
    -- Free firm in demo or trial: its own one-off budget ...
    if coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = firma), 0) + betrag > grenze then
      return null;
    end if;
    -- ... and the shared monthly pot of all free firms, so paying customers keep the rest of the monthly budget.
    if coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k join public.firmen f on f.id = k.firma_id
                 where k.zeit >= monat and jarvis_katalog.ki_planbudget(f.paket) is null and f.ki_budget_usd is not null), 0) + betrag > 5 then
      return null;
    end if;
  end if;
  i := jarvis_katalog.ki_reservieren(betrag, zweck);
  if i is not null and firma is not null and exists (select 1 from public.firmen where id = firma) then
    update jarvis_katalog.ki_kosten set firma_id = firma where id = i;
  end if;
  return i;
end $$;
revoke all on function jarvis_katalog.ki_reservieren_fuer(numeric, text, uuid) from public, anon, authenticated;

-- What the firm sees: plan allowance this month, or the trial/demo budget, or no limit.
create or replace function public.ki_kontingent(f uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.meine_rolle(f) is null then null
    when jarvis_katalog.ki_planbudget(x.paket) is not null then jsonb_build_object(
      'budget', jarvis_katalog.ki_planbudget(x.paket), 'monatlich', true,
      'verbraucht', round(coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = f and k.zeit >= date_trunc('month', now())), 0), 2))
    else jsonb_build_object(
      'budget', x.ki_budget_usd, 'monatlich', false,
      'verbraucht', round(coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = f), 0), 2)) end
    from public.firmen x where x.id = f
$$;
revoke all on function public.ki_kontingent(uuid) from public, anon;
grant execute on function public.ki_kontingent(uuid) to authenticated;

create or replace function public.betreiber_paket(f uuid, neu text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt' using errcode = '42501'; end if;
  if neu not in ('kostenlos', 'test', 'basis', 'pro', 'business', 'erfolg') then raise exception 'UNGUELTIG'; end if;
  update public.firmen set paket = neu where id = f;
  if not found then raise exception 'NICHT_GEFUNDEN'; end if;
end $$;
notify pgrst, 'reload schema';
