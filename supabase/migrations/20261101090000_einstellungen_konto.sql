-- Settings and account (I1–I4): finer phone notifications, quiet hours, changing one's own name and function,
-- deleting one's own account.

-- I1/I2: immediate phone message for very good hits (score from), deadline reminders on/off, quiet hours.
alter table public.benachrichtigungen
  add column if not exists sofort_ab integer check (sofort_ab is null or sofort_ab between 5 and 10),
  add column if not exists fristen boolean not null default true,
  add column if not exists ruhe_von integer check (ruhe_von is null or ruhe_von between 0 and 23),
  add column if not exists ruhe_bis integer check (ruhe_bis is null or ruhe_bis between 0 and 23);

-- I4: everyone may change their own display name and function (not their role or rights).
create or replace function public.mein_profil(f uuid, name text, funktion text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n text := left(regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g'), 80);
  fu text := left(regexp_replace(trim(coalesce(funktion, '')), '\s+', ' ', 'g'), 80);
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if length(n) < 2 then raise exception 'Bitte einen Namen mit mindestens 2 Zeichen'; end if;
  update public.mitglieder m set anzeigename = n, funktion = coalesce(nullif(fu, ''), m.funktion)
   where m.firma_id = f and m.user_id = auth.uid() and m.aktiv;
  if not found then raise exception 'Kein Zugang zu dieser Firma'; end if;
end $$;
revoke all on function public.mein_profil(uuid, text, text) from public, anon;
grant execute on function public.mein_profil(uuid, text, text) to authenticated;

-- I3: delete one's own login. Not possible while one is the last owner of a firm that still has other members
-- (the firm would have no owner left); firms where one is the only member are deleted with the login
-- (trigger jarvis_konto_geloescht). Returns the ids of those firms so the app can remove their stored files.
create or replace function public.konto_loeschen()
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  firmen uuid[];
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  if exists (
    select 1 from public.mitglieder m
     where m.user_id = uid and m.aktiv and m.rolle = 'inhaber'
       and not exists (select 1 from public.mitglieder o where o.firma_id = m.firma_id and o.user_id <> uid and o.aktiv and o.rolle = 'inhaber')
       and exists (select 1 from public.mitglieder o where o.firma_id = m.firma_id and o.user_id <> uid)
  ) then
    raise exception 'LETZTER_INHABER';
  end if;
  select coalesce(array_agg(m.firma_id), '{}') into firmen from public.mitglieder m
   where m.user_id = uid and not exists (select 1 from public.mitglieder o where o.firma_id = m.firma_id and o.user_id <> uid);
  delete from auth.users where id = uid;
  return firmen;
end $$;
revoke all on function public.konto_loeschen() from public, anon;
grant execute on function public.konto_loeschen() to authenticated;
