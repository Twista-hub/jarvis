-- Assignment plan per tender: place, start/end, meeting point, clothing, contact, notes. Sent from the phone
-- (WhatsApp/SMS/mail) to the planned people; Jarvis stores only the plan itself.
create table public.einsatzplaene (
  vorgang_id uuid primary key references public.vorgaenge on delete cascade,
  firma_id uuid not null references public.firmen on delete cascade,
  ort text not null default '' check (length(ort) <= 300),
  beginn timestamptz,
  ende timestamptz,
  treffpunkt text not null default '' check (length(treffpunkt) <= 300),
  kleidung text not null default '' check (length(kleidung) <= 300),
  ansprechpartner text not null default '' check (length(ansprechpartner) <= 300),
  hinweise text not null default '' check (length(hinweise) <= 2000),
  geaendert timestamptz not null default now()
);
alter table public.einsatzplaene enable row level security;
create policy lesen on public.einsatzplaene for select to authenticated using (
  exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = einsatzplaene.firma_id));
create policy verwalten on public.einsatzplaene for all to authenticated
  using (coalesce(public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'), false)
    and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = einsatzplaene.firma_id))
  with check (coalesce(public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'), false)
    and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = einsatzplaene.firma_id));
grant select, insert, update, delete on public.einsatzplaene to authenticated;

-- Location managers plan people for tenders too (their own location's people and tenders, checked via row rules).
drop policy verwalten on public.einsaetze;
create policy verwalten on public.einsaetze for all to authenticated
  using (coalesce(public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'), false)
    and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = einsaetze.firma_id)
    and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = einsaetze.firma_id))
  with check (coalesce(public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'), false)
    and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = einsaetze.firma_id)
    and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = einsaetze.firma_id));
