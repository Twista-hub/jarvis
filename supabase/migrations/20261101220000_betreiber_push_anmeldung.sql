-- Phone notification to the operator for every new login (registration or accepted invitation) and every new firm.
-- Goes through the push queue (sent hourly 6–21 h, several messages combined).
create or replace function jarvis_intern.betreiber_melden(titel text, text text) returns void
language sql security definer set search_path = '' as $$
  insert into public.push_warteschlange (user_id, titel, text, url)
  select u.id, left(betreiber_melden.titel, 80), left(betreiber_melden.text, 160), '/konto/betreiber'
  from jarvis_intern.betreiber b join auth.users u on lower(u.email) = b.email
$$;

create or replace function jarvis_intern.anmeldung_gemeldet() returns trigger
language plpgsql security definer set search_path = '' as $$
declare firma text := trim(coalesce(new.raw_user_meta_data->>'firma', ''));
begin
  if exists (select 1 from jarvis_intern.betreiber where email = lower(coalesce(new.email, ''))) then return new; end if;
  perform jarvis_intern.betreiber_melden('🆕 Neue Anmeldung bei Jarvis',
    case when firma <> '' then firma || ' · ' else '' end || coalesce(new.email, '') || case when firma = '' then ' (eingeladen oder ohne Firma)' else '' end);
  return new;
end $$;
drop trigger if exists jarvis_anmeldung_gemeldet on auth.users;
create trigger jarvis_anmeldung_gemeldet after insert on auth.users for each row execute function jarvis_intern.anmeldung_gemeldet();

create or replace function jarvis_intern.firma_gemeldet() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform jarvis_intern.betreiber_melden('🏢 Neue Firma bei Jarvis', new.name || coalesce(' · ' || nullif(new.ort, ''), ''));
  return new;
end $$;
drop trigger if exists jarvis_firma_gemeldet on public.firmen;
create trigger jarvis_firma_gemeldet after insert on public.firmen for each row execute function jarvis_intern.firma_gemeldet();
