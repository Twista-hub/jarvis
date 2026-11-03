-- Rechtsprüfung A-M9: deleting a safety briefing used to delete (cascade) its attendance records, which are the proof
-- that the employer instructed its staff (§ 12 ArbSchG, DGUV Vorschrift 1 § 4). A briefing with attendance in the last
-- two years can no longer be deleted; it is archived instead (no longer due, records stay). Deleting the firm stays possible.
alter table public.unterweisungen add column if not exists archiviert boolean not null default false;

create or replace function jarvis_intern.unterweisung_aufbewahrung() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() >= 2 then return old; end if;  -- cascade from public.firmen
  if exists (select 1 from public.unterweisung_teilnahmen t where t.unterweisung_id = old.id and t.datum > current_date - interval '2 years') then
    raise exception 'Aufbewahrung: Zu dieser Unterweisung gibt es Teilnahmenachweise der letzten 2 Jahre. Sie wird archiviert statt gelöscht.' using errcode = '42501';
  end if;
  return old;
end $$;
drop trigger if exists unterweisung_aufbewahrung on public.unterweisungen;
create trigger unterweisung_aufbewahrung before delete on public.unterweisungen for each row execute function jarvis_intern.unterweisung_aufbewahrung();
notify pgrst, 'reload schema';

-- Archived briefings are no longer shown to staff as due.
create or replace function public.meine_unterweisungen(f uuid)
returns table (id uuid, titel text, intervall_monate integer, beschreibung text, letzte date, digital boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.titel, u.intervall_monate, u.beschreibung, t.datum, coalesce(t.digital, false)
    from public.personal p
    join public.unterweisungen u on u.firma_id = p.firma_id and not u.archiviert
    left join lateral (select x.datum, x.digital from public.unterweisung_teilnahmen x
                        where x.unterweisung_id = u.id and x.personal_id = p.id order by x.datum desc limit 1) t on true
   where p.firma_id = meine_unterweisungen.f and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null
   order by u.titel
$$;
