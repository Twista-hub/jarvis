-- Only e-mail addresses unlocked by WP Digital Ranger may create a firm (paid product, open sign-up).
-- Employees join through invitations as before. Unlock: insert into public.freigaben (email) values ('…');
create table public.freigaben (
  email text primary key check (email = lower(email)),
  notiz text not null default '',
  erstellt timestamptz not null default now()
);
alter table public.freigaben enable row level security; -- no policies: only the database owner reads it

insert into public.freigaben (email, notiz) values ('benschiffer79@gmail.com', 'Benjamin Schiffer, WP Digital Ranger');

create or replace function public.firma_anlegen(name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare f uuid;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  if not exists (select 1 from public.freigaben
                 where email = lower(coalesce((select u.email from auth.users u where u.id = auth.uid()), ''))) then
    raise exception 'nicht freigeschaltet';
  end if;
  insert into public.firmen (name) values (firma_anlegen.name) returning id into f;
  insert into public.mitglieder (firma_id, user_id, rolle, alle_bereiche) values (f, auth.uid(), 'inhaber', true);
  insert into public.protokoll (firma_id, user_id, aktion) values (f, auth.uid(), 'firma_angelegt');
  return f;
end $$;

revoke all on function public.firma_anlegen(text) from public, anon;
grant execute on function public.firma_anlegen(text) to authenticated;
