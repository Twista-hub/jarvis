-- Planned assignments: which person of the personnel pool is planned for which tender, with a status.
-- Visible when the member may see both the tender and the person (their own row rules apply in the checks).
create table public.einsaetze (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  vorgang_id uuid not null references public.vorgaenge on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  status text not null default 'angefragt' check (status in ('geplant', 'angefragt', 'zugesagt', 'abgesagt')),
  erstellt timestamptz not null default now(),
  unique (vorgang_id, personal_id)
);
create index on public.einsaetze (personal_id);
alter table public.einsaetze enable row level security;
create policy lesen on public.einsaetze for select to authenticated using (
  exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = einsaetze.firma_id)
  and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = einsaetze.firma_id));
create policy verwalten on public.einsaetze for all to authenticated
  using (coalesce(public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'), false)
    and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = einsaetze.firma_id)
    and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = einsaetze.firma_id))
  with check (coalesce(public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'), false)
    and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = einsaetze.firma_id)
    and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = einsaetze.firma_id));
grant select, insert, update, delete on public.einsaetze to authenticated;
