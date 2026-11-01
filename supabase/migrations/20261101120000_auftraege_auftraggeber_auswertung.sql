-- N4 Laufende Aufträge, N5 Auftraggeber-Seiten, N6 Auswertung.

-- N4: contract data of a won tender: term, extension, the date by which the extension option is decided, staff
-- needed, contact at the buyer. Money stays in angebotsergebnisse (finance rights).
create table if not exists public.vertraege (
  firma_id uuid not null references public.firmen on delete cascade,
  vorgang_id uuid not null,
  beginn date,
  ende date,
  verlaengerung_bis date,
  option_frist date,
  personen_soll integer check (personen_soll is null or personen_soll between 0 and 10000),
  ansprechpartner text not null default '' check (length(ansprechpartner) <= 300),
  notiz text not null default '' check (length(notiz) <= 1000),
  geaendert timestamptz not null default now(),
  primary key (firma_id, vorgang_id),
  foreign key (firma_id, vorgang_id) references public.vorgaenge (firma_id, id) on delete cascade,
  check (ende is null or beginn is null or ende >= beginn),
  check (verlaengerung_bis is null or ende is null or verlaengerung_bis >= ende)
);
alter table public.vertraege enable row level security;
create policy lesen on public.vertraege for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter'
   and exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = vertraege.firma_id and public.darf_bereich(v.firma_id, v.bereich_id)));
create policy verwalten on public.vertraege for all to authenticated
  using (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = vertraege.firma_id and public.darf_bearbeiten(v.firma_id, v.bereich_id)))
  with check (exists (select 1 from public.vorgaenge v where v.id = vorgang_id and v.firma_id = vertraege.firma_id and public.darf_bearbeiten(v.firma_id, v.bereich_id)));
revoke all on public.vertraege from anon;
grant select, insert, update, delete on public.vertraege to authenticated;

-- N5: the firm's own contacts and notes per contracting authority (buyer key from the catalog or the name).
create table if not exists public.auftraggeber_kontakte (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  auftraggeber_schluessel text not null check (length(auftraggeber_schluessel) between 3 and 400),
  name text not null check (length(trim(name)) between 2 and 200),
  funktion text not null default '' check (length(funktion) <= 200),
  telefon text not null default '' check (length(telefon) <= 60),
  email text not null default '' check (length(email) <= 200),
  notiz text not null default '' check (length(notiz) <= 1000),
  erstellt timestamptz not null default now()
);
create index if not exists auftraggeber_kontakte_schluessel on public.auftraggeber_kontakte (firma_id, auftraggeber_schluessel);
alter table public.auftraggeber_kontakte enable row level security;
create policy lesen on public.auftraggeber_kontakte for select to authenticated using
  (coalesce(public.meine_rolle(firma_id), 'mitarbeiter') <> 'mitarbeiter');
create policy verwalten on public.auftraggeber_kontakte for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter', 'standortleitung'));
revoke all on public.auftraggeber_kontakte from anon;
grant select, insert, update, delete on public.auftraggeber_kontakte to authenticated;

-- N6: AI costs per firm. The budget check (ki_reservieren) stays as it is; this wrapper books the firm onto the
-- reservation so the app can show what Jarvis spent for a firm. Older bookings have no firm.
alter table jarvis_katalog.ki_kosten add column if not exists firma_id uuid references public.firmen on delete set null;
create index if not exists ki_kosten_firma on jarvis_katalog.ki_kosten (firma_id, zeit) where firma_id is not null;

create or replace function jarvis_katalog.ki_reservieren_fuer(betrag numeric, zweck text, firma uuid) returns uuid
language plpgsql set search_path = '' as $$
declare i uuid;
begin
  i := jarvis_katalog.ki_reservieren(betrag, zweck);
  if i is not null and firma is not null and exists (select 1 from public.firmen where id = firma) then
    update jarvis_katalog.ki_kosten set firma_id = firma where id = i;
  end if;
  return i;
end $$;
revoke all on function jarvis_katalog.ki_reservieren_fuer(numeric, text, uuid) from public, anon, authenticated;

-- Owners and admins see the costs of their own firm per month and purpose (last 12 months).
create or replace function public.ki_kosten_firma(f uuid)
returns table (monat date, zweck text, kosten numeric, anfragen bigint)
language sql stable security definer set search_path = '' as $$
  select date_trunc('month', k.zeit)::date, k.zweck, round(sum(coalesce(k.verbraucht, k.reserviert)), 4), count(*)
    from jarvis_katalog.ki_kosten k
   where public.ist_admin(ki_kosten_firma.f) and k.firma_id = ki_kosten_firma.f and k.zeit >= date_trunc('month', now()) - interval '11 months'
   group by 1, 2
   order by 1 desc, 2
$$;
revoke all on function public.ki_kosten_firma(uuid) from public, anon;
grant execute on function public.ki_kosten_firma(uuid) to authenticated;

notify pgrst, 'reload schema';
