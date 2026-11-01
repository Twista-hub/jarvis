-- Own deadlines (site visit, internal hand-in) and a private calendar subscription link per person and firm.

create table public.eigene_termine (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  vorgang_id uuid,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  titel text not null check (length(trim(titel)) between 1 and 200),
  zeit timestamptz not null,
  erstellt timestamptz not null default now(),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete cascade
);
create index on public.eigene_termine (firma_id, zeit);
alter table public.eigene_termine enable row level security;
-- Visible to the firm's members (not personal-share-only staff); tied to a tender only if that tender is visible.
create policy lesen on public.eigene_termine for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter'
   and (vorgang_id is null or exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = eigene_termine.firma_id)));
create policy anlegen on public.eigene_termine for insert to authenticated with check
  (user_id = auth.uid() and coalesce(public.meine_rolle(firma_id), 'leser') not in ('mitarbeiter', 'leser')
   and (vorgang_id is null or exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = eigene_termine.firma_id)));
create policy entfernen on public.eigene_termine for delete to authenticated using (user_id = auth.uid() or public.ist_admin(firma_id));
grant select, insert, delete on public.eigene_termine to authenticated;

create table public.kalender_abos (
  token text primary key check (token ~ '^[A-Za-z0-9_-]{40,}$'),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  firma_id uuid not null references public.firmen on delete cascade,
  erstellt timestamptz not null default now(),
  unique (user_id, firma_id)
);
alter table public.kalender_abos enable row level security;
create policy eigene on public.kalender_abos for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.meine_rolle(firma_id) is not null);
grant select, insert, delete on public.kalender_abos to authenticated;

-- Calendar feed: the secret token stands for its owner. The owner's identity is set for this call only, so the same
-- area rights as in the app (darf_bereich) decide which deadlines appear. Inactive members get nothing.
create function public.kalender_fristen(t text)
returns table (id uuid, art text, titel text, zeit timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare a public.kalender_abos;
begin
  select * into a from public.kalender_abos k where k.token = t;
  if not found or not exists (select 1 from public.mitglieder m where m.firma_id = a.firma_id and m.user_id = a.user_id and m.aktiv and m.rolle <> 'mitarbeiter') then
    return;
  end if;
  perform set_config('request.jwt.claim.sub', a.user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', a.user_id, 'role', 'authenticated')::text, true);
  return query
    select v.id, 'abgabe'::text, v.titel, v.frist from public.vorgaenge v
     where v.firma_id = a.firma_id and v.status in ('neu','pruefen','angebot') and v.frist > now() - interval '30 days' and public.darf_bereich(v.firma_id, v.bereich_id)
    union all
    select v.id, 'fragen'::text, v.titel, v.fragefrist from public.vorgaenge v
     where v.firma_id = a.firma_id and v.status in ('neu','pruefen','angebot') and v.fragefrist > now() - interval '30 days' and public.darf_bereich(v.firma_id, v.bereich_id)
    union all
    select e.id, 'eigen'::text, e.titel, e.zeit from public.eigene_termine e
     where e.firma_id = a.firma_id and e.zeit > now() - interval '30 days'
       and (e.vorgang_id is null or exists (select 1 from public.vorgaenge v where v.id = e.vorgang_id and public.darf_bereich(v.firma_id, v.bereich_id)))
    order by 4 limit 500;
end $$;
revoke all on function public.kalender_fristen(text) from public;
grant execute on function public.kalender_fristen(text) to anon, authenticated;
