-- Origin of a firm's sign-up (08.11.2026): utm source/medium/campaign of the landing page or the referring domain,
-- carried by the registration form into the sign-up data (no cookie). Copied to the firm when it is created, for the
-- operator's evaluation (which channel brings customers and subscriptions).

alter table public.firmen add column if not exists herkunft jsonb
  check (herkunft is null or (jsonb_typeof(herkunft) = 'object' and octet_length(herkunft::text) <= 400));

create or replace function jarvis_intern.herkunft_uebernehmen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare h jsonb;
begin
  if new.herkunft is not null then return new; end if;
  select u.raw_user_meta_data->'herkunft' into h from auth.users u where u.id = auth.uid();
  if jsonb_typeof(h) = 'object' then
    new.herkunft := jsonb_strip_nulls(jsonb_build_object(
      'quelle', left(h->>'quelle', 40), 'medium', left(h->>'medium', 40), 'kampagne', left(h->>'kampagne', 60), 'verweis', left(h->>'verweis', 80)));
  end if;
  return new;
end $$;
drop trigger if exists jarvis_herkunft_uebernehmen on public.firmen;
create trigger jarvis_herkunft_uebernehmen before insert on public.firmen for each row execute function jarvis_intern.herkunft_uebernehmen();

-- Members cannot change it afterwards (only the database sets it).
create or replace function jarvis_intern.herkunft_behalten() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not public.ist_betreiber() then new.herkunft := old.herkunft; end if;
  return new;
end $$;
drop trigger if exists jarvis_herkunft_behalten on public.firmen;
create trigger jarvis_herkunft_behalten before update of herkunft on public.firmen for each row execute function jarvis_intern.herkunft_behalten();

notify pgrst, 'reload schema';
