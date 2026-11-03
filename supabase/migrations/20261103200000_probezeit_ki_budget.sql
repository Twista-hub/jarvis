-- Probezeit-Schutz (Benjamin 03.11.2026): KI costs only for real firms, at most about 5 € per trial firm.
-- * New firms start in demo mode (ki_budget_usd = 0): search and keyword hits work, but no AI requests.
-- * As soon as the firm enters a website whose domain no other firm uses yet, it gets a trial budget of 5.50 $
--   (≈ 5 €). One trial per website domain; free-mail domains do not count.
-- * Existing firms (before this migration), the operator's firms and paying customers: null = no per-firm limit (the
--   operator sets it with SQL). Only the operator can change the value.
-- * jarvis_katalog.ki_reservieren_fuer refuses a reservation that would exceed the firm's budget; callers then fall back
--   to keyword hits (alarm) or show a hint (app).
alter table public.firmen add column if not exists ki_budget_usd numeric(8, 2);
alter table public.firmen alter column ki_budget_usd set default 0;

create or replace function jarvis_intern.web_domain(w text) returns text
language sql immutable set search_path = '' as $$
  select lower(regexp_replace(regexp_replace(trim(coalesce(w, '')), '^[a-z]+://', '', 'i'), '^(www\.)?([^/:?#]+).*$', '\2', 'i'))
$$;

create or replace function jarvis_intern.probe_ki() returns trigger
language plpgsql set search_path = '' as $$
declare d text;
begin
  if tg_op = 'UPDATE' and auth.uid() is not null and new.ki_budget_usd is distinct from old.ki_budget_usd then
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
drop trigger if exists probe_ki on public.firmen;
create trigger probe_ki before insert or update on public.firmen for each row execute function jarvis_intern.probe_ki();

create or replace function jarvis_katalog.ki_reservieren_fuer(betrag numeric, zweck text, firma uuid) returns uuid
language plpgsql set search_path = '' as $$
declare i uuid; grenze numeric;
begin
  select ki_budget_usd into grenze from public.firmen where id = firma;
  if grenze is not null and coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = firma), 0) + betrag > grenze then
    return null;  -- trial budget used up (or demo mode): no AI request for this firm
  end if;
  i := jarvis_katalog.ki_reservieren(betrag, zweck);
  if i is not null and firma is not null and exists (select 1 from public.firmen where id = firma) then
    update jarvis_katalog.ki_kosten set firma_id = firma where id = i;
  end if;
  return i;
end $$;
revoke all on function jarvis_katalog.ki_reservieren_fuer(numeric, text, uuid) from public, anon, authenticated;

-- What the firm sees: demo mode, trial budget left, or no limit.
create or replace function public.ki_kontingent(f uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.meine_rolle(f) is null then null else jsonb_build_object(
    'budget', x.ki_budget_usd,
    'verbraucht', round(coalesce((select sum(coalesce(k.verbraucht, k.reserviert)) from jarvis_katalog.ki_kosten k where k.firma_id = f), 0), 2)) end
    from public.firmen x where x.id = f
$$;
revoke all on function public.ki_kontingent(uuid) from public, anon;
grant execute on function public.ki_kontingent(uuid) to authenticated;
notify pgrst, 'reload schema';
