-- Idea 11 (docs/ideen-arbeitsoberflaeche.md): patrol rounds and guard log for security firms. The office places QR
-- checkpoints at a place of work; staff scan them with the phone camera (link /k/<token>), each scan is stored with the
-- server time. Staff write guard log entries (report, incident, handover). The office sees everything of its firm, staff
-- only their own entries. Checkpoint tokens are never shown to staff; scanning goes through rundgang_scannen().
create table if not exists public.kontrollpunkte (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  einsatzort_id uuid not null references public.einsatzorte on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  erstellt timestamptz not null default now()
);
create table if not exists public.rundgang_scans (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  kontrollpunkt_id uuid not null references public.kontrollpunkte on delete cascade,
  personal_id uuid not null references public.personal on delete cascade,
  zeit timestamptz not null default now()
);
create index if not exists rundgang_scans_zeit on public.rundgang_scans (firma_id, zeit desc);
create table if not exists public.wachbuch (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  einsatzort_id uuid references public.einsatzorte on delete set null,
  personal_id uuid not null references public.personal on delete cascade,
  zeit timestamptz not null default now(),
  art text not null default 'meldung' check (art in ('meldung', 'vorfall', 'uebergabe')),
  text text not null check (length(trim(text)) between 2 and 2000)
);
create index if not exists wachbuch_zeit on public.wachbuch (firma_id, zeit desc);

alter table public.kontrollpunkte enable row level security;
alter table public.rundgang_scans enable row level security;
alter table public.wachbuch enable row level security;
create policy buero on public.kontrollpunkte for all to authenticated
  using (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'))
  with check (public.meine_rolle(firma_id) in ('inhaber', 'admin', 'bearbeiter'));
create policy buero_lesen on public.rundgang_scans for select to authenticated using (public.meine_rolle(firma_id) not in ('mitarbeiter'));
create policy eigene_lesen on public.rundgang_scans for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = rundgang_scans.firma_id and p.user_id = auth.uid()));
create policy buero_lesen on public.wachbuch for select to authenticated using (public.meine_rolle(firma_id) not in ('mitarbeiter'));
create policy eigene_lesen on public.wachbuch for select to authenticated using
  (exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = wachbuch.firma_id and p.user_id = auth.uid()));
create policy eigene_schreiben on public.wachbuch for insert to authenticated with check
  (zeit between now() - interval '2 minutes' and now() + interval '1 minute'
   and exists (select 1 from public.personal p where p.id = personal_id and p.firma_id = wachbuch.firma_id and p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null)
   and (einsatzort_id is null or exists (select 1 from public.einsatzorte o where o.id = einsatzort_id and o.firma_id = wachbuch.firma_id)));
revoke all on public.kontrollpunkte, public.rundgang_scans, public.wachbuch from anon;
grant select, insert, update, delete on public.kontrollpunkte to authenticated;
grant select on public.rundgang_scans to authenticated;
grant select, insert on public.wachbuch to authenticated;
revoke update, delete on public.rundgang_scans, public.wachbuch from authenticated;

-- Scan a checkpoint: only staff with a personnel record in the checkpoint's firm; the same checkpoint at most once a minute.
create or replace function public.rundgang_scannen(token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k record; p uuid;
begin
  select kp.id, kp.firma_id, kp.einsatzort_id, kp.name, o.name as ort into k
    from public.kontrollpunkte kp join public.einsatzorte o on o.id = kp.einsatzort_id where kp.token = rundgang_scannen.token;
  if k.id is null then return null; end if;
  select pe.id into p from public.personal pe where pe.firma_id = k.firma_id and pe.user_id = auth.uid() limit 1;
  if p is null or public.meine_rolle(k.firma_id) is null then return null; end if;
  if not exists (select 1 from public.rundgang_scans s where s.kontrollpunkt_id = k.id and s.personal_id = p and s.zeit > now() - interval '1 minute') then
    insert into public.rundgang_scans (firma_id, kontrollpunkt_id, personal_id) values (k.firma_id, k.id, p);
  end if;
  return jsonb_build_object('punkt', k.name, 'ort', k.ort, 'einsatzort_id', k.einsatzort_id, 'firma_id', k.firma_id, 'zeit', now());
end $$;
revoke all on function public.rundgang_scannen(text) from public, anon;
grant execute on function public.rundgang_scannen(text) to authenticated;
