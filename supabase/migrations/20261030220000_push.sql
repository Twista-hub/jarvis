-- Phone notifications (Web Push). The browser registers a subscription per device; alarm/mail.py sends an
-- empty push at the chosen hour and stores the text in push_nachrichten, which the phone then fetches.
alter table public.benachrichtigungen add column kanal text not null default 'mail' check (kanal in ('mail', 'push', 'beides'));

create table public.push_abos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  erstellt timestamptz not null default now()
);
alter table public.push_abos enable row level security;
create policy eigene on public.push_abos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.push_abos to authenticated;

create table public.push_nachrichten (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  titel text not null,
  text text not null default '',
  url text not null default '/konto',
  erstellt timestamptz not null default now()
);
create index on public.push_nachrichten (user_id, erstellt desc);
alter table public.push_nachrichten enable row level security;
create policy eigene on public.push_nachrichten for select to authenticated using (user_id = auth.uid());
grant select on public.push_nachrichten to authenticated;

-- Server keys (VAPID). No policies: only the database owner (alarm/mail.py) reads them.
create table public.app_schluessel (name text primary key, wert text not null);
alter table public.app_schluessel enable row level security;

-- The public VAPID key is public by design; the web page needs it to register a device.
create function public.push_schluessel() returns text
language sql stable security definer set search_path = '' as $$
  select wert from public.app_schluessel where name = 'vapid_public'
$$;
revoke all on function public.push_schluessel() from public;
grant execute on function public.push_schluessel() to anon, authenticated;
