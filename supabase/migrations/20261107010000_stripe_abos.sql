-- Automatische Abos über Stripe (Benjamin 07.11.2026: "es soll automatisch laufen alles"). Der Plan einer Firma
-- (firmen.paket) wird vom Stripe-Webhook des App-Workers gesetzt (Datenbankverbindung ohne Nutzersitzung) und fällt bei
-- Kündigung oder endgültig fehlgeschlagener Zahlung auf "kostenlos" zurück. Nutzer können die Abo-Felder nicht ändern.
alter table public.firmen
  add column if not exists stripe_kunde text check (stripe_kunde is null or stripe_kunde ~ '^cus_[A-Za-z0-9]{6,80}$'),
  add column if not exists stripe_abo text check (stripe_abo is null or stripe_abo ~ '^sub_[A-Za-z0-9]{6,80}$'),
  add column if not exists abo_status text check (abo_status is null or abo_status in ('active', 'trialing', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused')),
  add column if not exists abo_bis timestamptz,
  add column if not exists abo_zahlweise text check (abo_zahlweise is null or abo_zahlweise in ('monat', 'jahr')),
  add column if not exists abo_kuendigt boolean not null default false;

-- Plan and subscription fields only through billing (webhook without login) or the operator.
create or replace function jarvis_intern.paket_schuetzen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not public.ist_betreiber() and (
       new.paket is distinct from old.paket or new.stripe_kunde is distinct from old.stripe_kunde or new.stripe_abo is distinct from old.stripe_abo
    or new.abo_status is distinct from old.abo_status or new.abo_bis is distinct from old.abo_bis
    or new.abo_zahlweise is distinct from old.abo_zahlweise or new.abo_kuendigt is distinct from old.abo_kuendigt) then
    raise exception 'Der Plan kann nur über die Abrechnung geändert werden';
  end if;
  return new;
end $$;

-- Every Stripe event is applied once (Stripe retries deliveries).
create table if not exists jarvis_intern.stripe_ereignisse (
  id text primary key check (id ~ '^evt_[A-Za-z0-9]{6,80}$'),
  typ text not null check (length(typ) <= 80),
  firma_id uuid,
  zeit timestamptz not null default now()
);
revoke all on jarvis_intern.stripe_ereignisse from public, anon, authenticated;

-- Called by the webhook (worker database connection). Returns false if the event was already applied.
create or replace function jarvis_intern.stripe_ereignis(ereignis text, typ text, firma uuid, paket text, kunde text, abo text, status text,
  bis timestamptz, zahlweise text, kuendigt boolean) returns boolean
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
    abo_kuendigt = coalesce(kuendigt, firmen.abo_kuendigt)
  where id = firma;
  return true;
end $$;
revoke all on function jarvis_intern.stripe_ereignis(text, text, uuid, text, text, text, text, timestamptz, text, boolean) from public, anon, authenticated;
notify pgrst, 'reload schema';
