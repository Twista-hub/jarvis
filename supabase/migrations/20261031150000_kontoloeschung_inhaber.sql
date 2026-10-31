-- Deleting a login (Supabase dashboard or Auth API) failed with "Database error deleting user" whenever the person
-- was the last owner of a firm (the cascade on public.mitglieder hit the "at least one owner" rule) or had approved
-- an offer (setting angebotsmappen.freigabe_von to null hit the approval guard).
-- Now the rule only guards changes made inside the app. When the login or the whole firm is being deleted, the
-- membership goes with it. Firms in which the deleted person was the only member are removed as well, so no
-- orphaned firm keeps running the daily search.

create or replace function public.mitglieder_regeln() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Cascade from deleting the login or the firm: the parent row is already gone.
  if tg_op = 'DELETE' and (not exists (select 1 from auth.users where id = old.user_id)
                           or not exists (select 1 from public.firmen where id = old.firma_id)) then
    return old;
  end if;
  if auth.uid() is not null and public.meine_rolle(coalesce(new.firma_id, old.firma_id)) <> 'inhaber'
     and ((tg_op <> 'INSERT' and old.rolle = 'inhaber') or (tg_op <> 'DELETE' and new.rolle = 'inhaber')) then
    raise exception 'Nur Inhaber dürfen Inhaber ändern';
  end if;
  if tg_op <> 'INSERT' and old.rolle = 'inhaber' and old.aktiv
     and (tg_op = 'DELETE' or new.rolle <> 'inhaber' or not new.aktiv)
     and not exists (select 1 from public.mitglieder where firma_id = old.firma_id and rolle = 'inhaber' and aktiv
                     and user_id <> old.user_id) then
    raise exception 'Eine Firma braucht mindestens einen Inhaber';
  end if;
  return coalesce(new, old);
end $$;

create or replace function jarvis_intern.konto_geloescht() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.firmen f
  where exists (select 1 from public.mitglieder m where m.firma_id = f.id and m.user_id = old.id)
    and not exists (select 1 from public.mitglieder m where m.firma_id = f.id and m.user_id <> old.id);
  return old;
end $$;

drop trigger if exists jarvis_konto_geloescht on auth.users;
create trigger jarvis_konto_geloescht before delete on auth.users
for each row execute function jarvis_intern.konto_geloescht();

-- The approval stays recorded (status and date); only the reference to the deleted login is cleared.
create or replace function jarvis_intern.angebotsfreigabe_schuetzen() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.freigabe_status<>'wartet' or new.freigabe_von is not null or new.freigabe_am is not null then
      raise exception 'Neue Angebotsmappen müssen erst freigegeben werden';
    end if;
    return new;
  end if;
  if (new.firma_id,new.vorgang_id,new.erstellt_von,new.text,new.unterlagen_ids,new.vorlage_id,new.erstellt)
     is distinct from (old.firma_id,old.vorgang_id,old.erstellt_von,old.text,old.unterlagen_ids,old.vorlage_id,old.erstellt) then
    raise exception 'Gespeicherte Angebotsversionen sind unveränderlich';
  end if;
  if old.freigabe_von is not null and new.freigabe_von is null
     and (new.freigabe_status,new.freigabe_am,new.freigabe_notiz) is not distinct from (old.freigabe_status,old.freigabe_am,old.freigabe_notiz)
     and not exists (select 1 from auth.users where id=old.freigabe_von) then
    return new;
  end if;
  if old.freigabe_status<>'wartet' or new.freigabe_status not in ('genehmigt','abgelehnt')
     or new.freigabe_von is distinct from auth.uid() or new.freigabe_am is null
     or not public.ist_admin(old.firma_id) then
    raise exception 'Nur die Firmenleitung darf eine wartende Angebotsmappe freigeben';
  end if;
  return new;
end $$;
