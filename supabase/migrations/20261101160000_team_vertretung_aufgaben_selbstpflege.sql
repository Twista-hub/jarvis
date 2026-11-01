-- T12 Vertretung, T13 Aufgaben, T14 Fahrzeuge & Geräte, T16 Mitarbeiter-Selbstpflege (T9–T11, T15 use existing data).

-- T12: who covers for whom in which period. Everyone may enter their own cover, admins anyone's.
create table if not exists public.vertretungen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null,
  user_id uuid not null,
  vertreter_id uuid not null,
  von date not null,
  bis date not null,
  notiz text not null default '' check (length(notiz) <= 300),
  erstellt timestamptz not null default now(),
  check (bis >= von and bis - von <= 366 and user_id <> vertreter_id),
  foreign key (firma_id, user_id) references public.mitglieder (firma_id, user_id) on delete cascade,
  foreign key (firma_id, vertreter_id) references public.mitglieder (firma_id, user_id) on delete cascade
);
create index if not exists vertretungen_zeit on public.vertretungen (firma_id, bis);
alter table public.vertretungen enable row level security;
create policy lesen on public.vertretungen for select to authenticated using (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.vertretungen for all to authenticated
  using ((user_id = auth.uid() and public.meine_rolle(firma_id) <> 'mitarbeiter') or public.ist_admin(firma_id))
  with check (((user_id = auth.uid() and public.meine_rolle(firma_id) <> 'mitarbeiter') or public.ist_admin(firma_id))
              and exists (select 1 from public.mitglieder m where m.firma_id = vertretungen.firma_id and m.user_id = vertreter_id and m.aktiv and m.rolle <> 'mitarbeiter'));
revoke all on public.vertretungen from anon;
grant select, insert, update, delete on public.vertretungen to authenticated;

-- T13: tasks in the team, optionally for a tender, with a responsible person and due date.
create table if not exists public.aufgaben (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  vorgang_id uuid,
  titel text not null check (length(trim(titel)) between 2 and 300),
  zustaendig_id uuid,
  faellig date,
  erledigt timestamptz,
  erstellt_von uuid default auth.uid() references auth.users on delete set null,
  erstellt timestamptz not null default now(),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete cascade,
  foreign key (firma_id, zustaendig_id) references public.mitglieder (firma_id, user_id) on delete set null (zustaendig_id)
);
create index if not exists aufgaben_offen on public.aufgaben (firma_id, zustaendig_id, faellig) where erledigt is null;
alter table public.aufgaben enable row level security;
create policy lesen on public.aufgaben for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter'
   and (vorgang_id is null or exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = aufgaben.firma_id and public.darf_bereich(v.firma_id, v.bereich_id))));
-- Creating and changing: everyone except readers and staff; readers may tick off their own tasks.
create policy verwalten on public.aufgaben for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung') or (zustaendig_id = auth.uid() and public.meine_rolle(firma_id) = 'leser'))
  with check ((public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung') or (zustaendig_id = auth.uid() and public.meine_rolle(firma_id) = 'leser'))
              and (vorgang_id is null or exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = aufgaben.firma_id and public.darf_bereich(v.firma_id, v.bereich_id))));
revoke all on public.aufgaben from anon;
grant select, insert, update, delete on public.aufgaben to authenticated;

-- T14: vehicles, machines and devices with the next inspection (TÜV, UVV, DGUV V3 …).
create table if not exists public.betriebsmittel (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid,
  art text not null default 'geraet' check (art in ('fahrzeug', 'maschine', 'geraet', 'werkzeug', 'sonstiges')),
  bezeichnung text not null check (length(trim(bezeichnung)) between 2 and 200),
  kennung text not null default '' check (length(kennung) <= 60),
  pruefart text not null default '' check (length(pruefart) <= 60),
  naechste_pruefung date,
  notiz text not null default '' check (length(notiz) <= 500),
  erstellt timestamptz not null default now(),
  foreign key (firma_id, bereich_id) references public.bereiche (firma_id, id) on delete set null (bereich_id)
);
create index if not exists betriebsmittel_pruefung on public.betriebsmittel (firma_id, naechste_pruefung);
alter table public.betriebsmittel enable row level security;
create policy lesen on public.betriebsmittel for select to authenticated using (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.betriebsmittel for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'));
revoke all on public.betriebsmittel from anon;
grant select, insert, update, delete on public.betriebsmittel to authenticated;

-- T16: a staff member's app login linked to their personnel record. They see their own record, assignments and
-- instructions, request leave (status "beantragt" until the office confirms) and upload their own proofs.
alter table public.personal add column if not exists user_id uuid;
do $$ begin
  alter table public.personal add constraint personal_user_fk foreign key (firma_id, user_id) references public.mitglieder (firma_id, user_id) on delete set null (user_id);
exception when duplicate_object then null; end $$;
create unique index if not exists personal_user_einmal on public.personal (firma_id, user_id) where user_id is not null;
create policy eigene on public.personal for select to authenticated using (user_id = auth.uid() and public.meine_rolle(firma_id) is not null);

alter table public.personal_abwesenheiten add column if not exists status text not null default 'bestaetigt' check (status in ('bestaetigt', 'beantragt'));
create policy eigene_lesen on public.personal_abwesenheiten for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_abwesenheiten.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_beantragen on public.personal_abwesenheiten for insert to authenticated with check
  (status = 'beantragt' and grund in ('urlaub', 'abwesend') and von >= current_date
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_abwesenheiten.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_zurueckziehen on public.personal_abwesenheiten for delete to authenticated using
  (status = 'beantragt' and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_abwesenheiten.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));

create policy eigene_lesen on public.personal_nachweise for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_nachweise.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));
create policy eigene_hochladen on public.personal_nachweise for insert to authenticated with check
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = personal_nachweise.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));

create policy eigene on public.ueberlassungen for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = ueberlassungen.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null));

-- Own confirmed assignments to won contracts and own instructions (the tender and instruction tables stay closed).
create or replace function public.meine_auftraege(f uuid)
returns table (titel text, beginn date, ende date)
language sql stable security definer set search_path = '' as $$
  select v.titel, vt.beginn, vt.ende
    from public.personal p
    join public.einsaetze e on e.personal_id = p.id and e.status = 'zugesagt'
    join public.vorgaenge v on v.id = e.vorgang_id and v.status = 'gewonnen'
    left join public.vertraege vt on vt.vorgang_id = v.id and vt.firma_id = v.firma_id
   where p.firma_id = meine_auftraege.f and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null
   order by vt.beginn nulls last
$$;
create or replace function public.meine_unterweisungen(f uuid)
returns table (titel text, intervall_monate integer, letzte date)
language sql stable security definer set search_path = '' as $$
  select u.titel, u.intervall_monate, (select max(t.datum) from public.unterweisung_teilnahmen t where t.unterweisung_id = u.id and t.personal_id = p.id)
    from public.personal p join public.unterweisungen u on u.firma_id = p.firma_id
   where p.firma_id = meine_unterweisungen.f and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null
   order by u.titel
$$;
revoke all on function public.meine_auftraege(uuid), public.meine_unterweisungen(uuid) from public, anon;
grant execute on function public.meine_auftraege(uuid), public.meine_unterweisungen(uuid) to authenticated;

notify pgrst, 'reload schema';
