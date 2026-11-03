-- Rechtsprüfung 03.11.2026, Steuern S5 (docs/recht/pruefung-2026-11.md): receipts are no longer deleted (§ 147 AO, GoBD:
-- changes must stay traceable). A wrong receipt is cancelled with a reason; it stays visible as cancelled, keeps its
-- file and no longer counts for input VAT and DATEV. Deleting the whole firm stays possible.
alter table public.belege add column if not exists storniert_am timestamptz;
alter table public.belege add column if not exists storno_grund text not null default '' check (length(storno_grund) <= 300);

create or replace function jarvis_intern.beleg_nicht_loeschen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() < 2 then
    raise exception 'Belege werden nicht gelöscht, sondern storniert' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists beleg_nicht_loeschen on public.belege;
create trigger beleg_nicht_loeschen before delete on public.belege for each row execute function jarvis_intern.beleg_nicht_loeschen();

create or replace function public.beleg_stornieren(b uuid, grund text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare x public.belege;
begin
  select * into x from public.belege where id = b for update;
  if x.id is null or not (jarvis_intern.darf_finanzen(x.firma_id, null) and public.meine_rolle(x.firma_id) in ('inhaber', 'admin', 'bearbeiter')) then
    raise exception 'Beleg nicht gefunden' using errcode = '42501';
  end if;
  if x.storniert_am is not null then return false; end if;
  if length(trim(coalesce(grund, ''))) < 3 then raise exception 'Bitte einen Grund für das Storno angeben.'; end if;
  update public.belege set storniert_am = now(), storno_grund = left(trim(grund), 300) where id = b;
  return true;
end $$;
revoke all on function public.beleg_stornieren(uuid, text) from public, anon;
grant execute on function public.beleg_stornieren(uuid, text) to authenticated;
notify pgrst, 'reload schema';
