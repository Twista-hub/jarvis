-- Firms (tenants), areas (locations/departments as a tree), members with roles, and the work on tenders.
-- Access is enforced with row level security: a member sees only their firm, and below admin level only
-- the areas they are assigned to (including all sub-areas).

create table public.firmen (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 200),
  ust_id text,
  paket text not null default 'test' check (paket in ('test', 'basis', 'pro', 'erfolg')),
  erstellt timestamptz not null default now()
);

create table public.bereiche (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  parent_id uuid references public.bereiche on delete cascade,
  name text not null check (length(name) between 1 and 200),
  art text not null default 'standort' check (art in ('standort', 'abteilung', 'team')),
  erstellt timestamptz not null default now(),
  unique (firma_id, id)
);

-- inhaber: everything incl. billing; admin: users and areas; bearbeiter: work on tenders; leser: read only (free).
create table public.mitglieder (
  firma_id uuid not null references public.firmen on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  rolle text not null check (rolle in ('inhaber', 'admin', 'bearbeiter', 'leser')),
  alle_bereiche boolean not null default false,
  aktiv boolean not null default true,
  erstellt timestamptz not null default now(),
  primary key (firma_id, user_id)
);

create table public.mitglied_bereiche (
  firma_id uuid not null,
  user_id uuid not null,
  bereich_id uuid not null,
  primary key (firma_id, user_id, bereich_id),
  foreign key (firma_id, user_id) references public.mitglieder on delete cascade,
  foreign key (firma_id, bereich_id) references public.bereiche (firma_id, id) on delete cascade
);

create table public.einladungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  email text not null,
  rolle text not null check (rolle in ('admin', 'bearbeiter', 'leser')),
  bereich_ids uuid[] not null default '{}',
  token_hash text not null unique,
  gueltig_bis timestamptz not null default now() + interval '14 days',
  angenommen timestamptz,
  erstellt_von uuid references auth.users on delete set null,
  erstellt timestamptz not null default now()
);

-- What a firm (or one area, e.g. a location) wants to be alerted about.
create table public.suchprofile (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid,
  name text not null,
  beschreibung text not null default '',
  cpv text[] not null default '{}',
  woerter text not null default '',
  ausschluss text not null default '',
  plz_praefixe text[] not null default '{}',
  aktiv boolean not null default true,
  foreign key (firma_id, bereich_id) references public.bereiche (firma_id, id) on delete cascade
);

-- One tender as worked on by one firm: pipeline from "neu" to "gewonnen".
create table public.vorgaenge (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid,
  quelle_id text,
  titel text not null,
  link text,
  frist timestamptz,
  status text not null default 'neu'
    check (status in ('neu', 'pruefen', 'angebot', 'abgegeben', 'gewonnen', 'verloren', 'verworfen')),
  zustaendig uuid references auth.users on delete set null,
  punkte int check (punkte between 1 and 10),
  steckbrief text,
  erstellt timestamptz not null default now(),
  geaendert timestamptz not null default now(),
  unique (firma_id, quelle_id),
  unique (firma_id, id),
  foreign key (firma_id, bereich_id) references public.bereiche (firma_id, id) on delete set null (bereich_id)
);

create table public.kalkulationen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null,
  vorgang_id uuid not null,
  eingaben jsonb not null,
  mengen jsonb not null default '{}',
  erstellt_von uuid references auth.users on delete set null,
  erstellt timestamptz not null default now(),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete cascade
);

-- Default wages etc. per firm or per area (wages differ between cities).
create table public.kalkulationsvorlagen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid,
  eingaben jsonb not null,
  unique nulls not distinct (firma_id, bereich_id),
  foreign key (firma_id, bereich_id) references public.bereiche (firma_id, id) on delete cascade
);

create table public.protokoll (
  id bigint generated always as identity primary key,
  firma_id uuid not null references public.firmen on delete cascade,
  user_id uuid,
  aktion text not null,
  details jsonb not null default '{}',
  zeit timestamptz not null default now()
);

create index on public.bereiche (firma_id, parent_id);
create index on public.mitglieder (user_id);
create index on public.vorgaenge (firma_id, status, frist);
create index on public.protokoll (firma_id, zeit desc);

-- ---------------------------------------------------------------------------------------------
-- Helpers (security definer, so policies can read memberships without recursion).

create function public.meine_rolle(f uuid) returns text
language sql stable security definer set search_path = '' as $$
  select rolle from public.mitglieder where firma_id = f and user_id = auth.uid() and aktiv
$$;

create function public.ist_admin(f uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meine_rolle(f) in ('inhaber', 'admin'), false)
$$;

-- An area is visible if the member sees all areas, or is assigned to it or to one of its parents.
-- Rows without an area (b is null) belong to the whole firm and are visible to every member.
create function public.darf_bereich(f uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with recursive kette as (
    select id, parent_id from public.bereiche where id = b and firma_id = f
    union all
    select p.id, p.parent_id from public.bereiche p join kette k on p.id = k.parent_id
  )
  select exists (
    select 1 from public.mitglieder m
    where m.firma_id = f and m.user_id = auth.uid() and m.aktiv
      and (b is null or m.alle_bereiche or m.rolle in ('inhaber', 'admin')
           or (b is not null and exists (
                 select 1 from public.mitglied_bereiche mb
                 where mb.firma_id = f and mb.user_id = m.user_id and mb.bereich_id in (select id from kette))))
  )
$$;

create function public.darf_bearbeiten(f uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meine_rolle(f) in ('inhaber', 'admin', 'bearbeiter'), false) and public.darf_bereich(f, b)
$$;

-- Billable seats: active members except free readers.
create function public.nutzer_zaehlen(f uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.mitglieder where firma_id = f and aktiv and rolle <> 'leser'
$$;

-- Create a firm; the caller becomes its owner.
create function public.firma_anlegen(name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare f uuid;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  insert into public.firmen (name) values (firma_anlegen.name) returning id into f;
  insert into public.mitglieder (firma_id, user_id, rolle, alle_bereiche) values (f, auth.uid(), 'inhaber', true);
  insert into public.protokoll (firma_id, user_id, aktion) values (f, auth.uid(), 'firma_angelegt');
  return f;
end $$;

-- Accept an invitation with the token from the e-mail link.
create function public.einladung_annehmen(token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.einladungen;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  select * into e from public.einladungen
  where token_hash = encode(sha256(convert_to(token, 'UTF8')), 'hex') and angenommen is null and gueltig_bis > now()
  for update;
  if not found then raise exception 'Einladung ungültig oder abgelaufen'; end if;
  if lower(e.email) <> lower(coalesce((select email from auth.users where id = auth.uid()), '')) then
    raise exception 'Einladung gilt für eine andere E-Mail-Adresse';
  end if;
  insert into public.mitglieder (firma_id, user_id, rolle) values (e.firma_id, auth.uid(), e.rolle)
  on conflict (firma_id, user_id) do update set rolle = excluded.rolle, aktiv = true;
  insert into public.mitglied_bereiche (firma_id, user_id, bereich_id)
  select e.firma_id, auth.uid(), unnest(e.bereich_ids) on conflict do nothing;
  update public.einladungen set angenommen = now() where id = e.id;
  insert into public.protokoll (firma_id, user_id, aktion, details) values (e.firma_id, auth.uid(), 'einladung_angenommen', jsonb_build_object('rolle', e.rolle));
  return e.firma_id;
end $$;

-- Only owners may create, change or remove owners; a firm always keeps at least one active owner.
create function public.mitglieder_regeln() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
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

create trigger mitglieder_regeln before insert or update or delete on public.mitglieder
for each row execute function public.mitglieder_regeln();

create function public.vorgang_geaendert() returns trigger language plpgsql as $$
begin new.geaendert := now(); return new; end $$;

create trigger vorgang_geaendert before update on public.vorgaenge
for each row execute function public.vorgang_geaendert();

-- ---------------------------------------------------------------------------------------------
-- Row level security.

alter table public.firmen enable row level security;
alter table public.bereiche enable row level security;
alter table public.mitglieder enable row level security;
alter table public.mitglied_bereiche enable row level security;
alter table public.einladungen enable row level security;
alter table public.suchprofile enable row level security;
alter table public.vorgaenge enable row level security;
alter table public.kalkulationen enable row level security;
alter table public.kalkulationsvorlagen enable row level security;
alter table public.protokoll enable row level security;

create policy lesen on public.firmen for select to authenticated using (public.meine_rolle(id) is not null);
create policy aendern on public.firmen for update to authenticated
  using (public.meine_rolle(id) = 'inhaber') with check (public.meine_rolle(id) = 'inhaber');

create policy lesen on public.bereiche for select to authenticated using (public.meine_rolle(firma_id) is not null);
create policy verwalten on public.bereiche for all to authenticated
  using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));

create policy lesen on public.mitglieder for select to authenticated using (public.meine_rolle(firma_id) is not null);
create policy verwalten on public.mitglieder for all to authenticated
  using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));

create policy lesen on public.mitglied_bereiche for select to authenticated using (public.meine_rolle(firma_id) is not null);
create policy verwalten on public.mitglied_bereiche for all to authenticated
  using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));

create policy verwalten on public.einladungen for all to authenticated
  using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));

create policy lesen on public.suchprofile for select to authenticated using (public.darf_bereich(firma_id, bereich_id));
create policy verwalten on public.suchprofile for all to authenticated
  using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));

create policy lesen on public.vorgaenge for select to authenticated using (public.darf_bereich(firma_id, bereich_id));
create policy anlegen on public.vorgaenge for insert to authenticated with check (public.darf_bearbeiten(firma_id, bereich_id));
create policy aendern on public.vorgaenge for update to authenticated
  using (public.darf_bearbeiten(firma_id, bereich_id)) with check (public.darf_bearbeiten(firma_id, bereich_id));
create policy loeschen on public.vorgaenge for delete to authenticated using (public.ist_admin(firma_id));

create policy lesen on public.kalkulationen for select to authenticated using (
  exists (select 1 from public.vorgaenge v where v.id = vorgang_id and public.darf_bereich(v.firma_id, v.bereich_id)));
create policy anlegen on public.kalkulationen for insert to authenticated with check (
  erstellt_von = auth.uid()
  and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = kalkulationen.firma_id
              and public.darf_bearbeiten(v.firma_id, v.bereich_id)));

create policy lesen on public.kalkulationsvorlagen for select to authenticated using (public.darf_bereich(firma_id, bereich_id));
create policy verwalten on public.kalkulationsvorlagen for all to authenticated
  using (public.darf_bearbeiten(firma_id, bereich_id)) with check (public.darf_bearbeiten(firma_id, bereich_id));

create policy lesen on public.protokoll for select to authenticated using (public.ist_admin(firma_id));

revoke all on function public.firma_anlegen(text), public.einladung_annehmen(text) from public, anon;
grant execute on function public.firma_anlegen(text), public.einladung_annehmen(text) to authenticated;
