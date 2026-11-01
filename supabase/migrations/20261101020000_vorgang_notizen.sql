-- Team notes per tender ("Kunde angerufen, Rückruf Freitag"). Readable by everyone who may see the tender itself
-- (the subquery runs under the tender's row-level security); written by members except personal-share-only staff;
-- deleted by the author or the firm's administration.
create table public.vorgang_notizen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  vorgang_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null check (length(trim(text)) between 1 and 2000),
  erstellt timestamptz not null default now(),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete cascade
);
create index on public.vorgang_notizen (vorgang_id, erstellt desc);
alter table public.vorgang_notizen enable row level security;
create policy lesen on public.vorgang_notizen for select to authenticated using
  (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = vorgang_notizen.firma_id));
create policy anlegen on public.vorgang_notizen for insert to authenticated with check
  (user_id = auth.uid() and coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter'
   and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = vorgang_notizen.firma_id));
create policy entfernen on public.vorgang_notizen for delete to authenticated using
  (user_id = auth.uid() or public.ist_admin(firma_id));
grant select, insert, delete on public.vorgang_notizen to authenticated;
