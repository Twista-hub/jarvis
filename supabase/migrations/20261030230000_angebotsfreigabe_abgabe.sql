-- Chef-Freigabe und nachvollziehbarer Abgabenachweis für Angebotsmappen.
alter table public.angebotsmappen
  add column freigabe_status text not null default 'wartet' check (freigabe_status in ('wartet','genehmigt','abgelehnt')),
  add column freigabe_von uuid references auth.users(id) on delete set null,
  add column freigabe_am timestamptz,
  add column freigabe_notiz text not null default '' check (length(freigabe_notiz)<=2000);

create function jarvis_intern.angebotsfreigabe_schuetzen() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.freigabe_status<>'wartet' or new.freigabe_von is not null or new.freigabe_am is not null then
      raise exception 'Neue Angebotsmappen müssen erst freigegeben werden';
    end if;
    return new;
  end if;
  if (new.firma_id,new.vorgang_id,new.erstellt_von,new.text,new.unterlagen_ids,new.vorlage_id,new.erstellt)
     is distinct from (old.firma_id,old.vorgang_id,old.erstellt_von,old.text,old.unterlagen_ids,old.vorlage_id,old.erstellt) then
    raise exception 'Gespeicherte Angebotsversionen sind unveränderlich';
  end if;
  if old.freigabe_status<>'wartet' or new.freigabe_status not in ('genehmigt','abgelehnt')
     or new.freigabe_von is distinct from auth.uid() or new.freigabe_am is null
     or not public.ist_admin(old.firma_id) then
    raise exception 'Nur die Firmenleitung darf eine wartende Angebotsmappe freigeben';
  end if;
  return new;
end $$;
create trigger angebotsfreigabe_schuetzen before insert or update on public.angebotsmappen
for each row execute function jarvis_intern.angebotsfreigabe_schuetzen();

create table public.angebotsabgaben (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  mappe_id uuid not null unique references public.angebotsmappen on delete cascade,
  abgegeben_von uuid not null default auth.uid() references auth.users(id),
  abgegeben_am timestamptz not null default now(),
  portal text not null check(length(portal)<=200),
  dateiname text not null check(length(dateiname) between 1 and 160),
  mime text not null check(mime in ('application/pdf','image/png','image/jpeg')),
  groesse bigint not null check(groesse between 1 and 10485760),
  unique(firma_id,id)
);
alter table public.angebotsabgaben enable row level security;
create policy lesen on public.angebotsabgaben for select to authenticated using
  (firma_id=angebotsabgaben.firma_id and exists(select 1 from public.angebotsmappen a join public.vorgaenge v on v.id=a.vorgang_id and v.firma_id=a.firma_id where a.id=mappe_id and a.firma_id=angebotsabgaben.firma_id and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id)));
create policy anlegen on public.angebotsabgaben for insert to authenticated with check
  (abgegeben_von=auth.uid() and exists(select 1 from public.angebotsmappen a join public.vorgaenge v on v.id=a.vorgang_id and v.firma_id=a.firma_id where a.id=mappe_id and a.firma_id=angebotsabgaben.firma_id and a.freigabe_status='genehmigt' and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id) and public.darf_bearbeiten(v.firma_id,v.bereich_id)));
grant select,insert on public.angebotsabgaben to authenticated;
revoke all on public.angebotsabgaben from anon;

create function jarvis_intern.angebotsabgabe_pruefen() returns trigger language plpgsql set search_path='' as $$
begin
  if new.abgegeben_von is distinct from auth.uid() then raise exception 'Abgabenachweis muss von der angemeldeten Person angelegt werden'; end if;
  if not exists(select 1 from public.angebotsmappen a where a.id=new.mappe_id and a.firma_id=new.firma_id and a.freigabe_status='genehmigt') then
    raise exception 'Nur freigegebene Angebotsmappen können als abgegeben protokolliert werden';
  end if;
  new.abgegeben_am:=now();
  return new;
end $$;
create trigger angebotsabgabe_pruefen before insert on public.angebotsabgaben
for each row execute function jarvis_intern.angebotsabgabe_pruefen();

-- These global dedupe rows are written only by the scheduled mail job's database owner role.
create table public.nachweis_erinnerungen (
  firma_id uuid not null,
  dokument_id uuid not null references public.firmenunterlagen on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tage smallint not null check(tage in (30,14,7,2)),
  gesendet_am timestamptz not null default now(),
  primary key(dokument_id,user_id,tage)
);
alter table public.nachweis_erinnerungen enable row level security;
revoke all on public.nachweis_erinnerungen from anon,authenticated;
