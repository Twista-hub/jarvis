-- Job titles describe a person's work; access is granted separately.
alter table public.mitglieder drop constraint mitglieder_rolle_check;
alter table public.mitglieder add constraint mitglieder_rolle_check check (rolle in ('inhaber','admin','bearbeiter','leser','mitarbeiter'));
alter table public.mitglieder add column anzeigename text not null default '' check (length(anzeigename) <= 200),
  add column funktion text not null default 'Mitarbeiter/in' check (length(funktion) between 1 and 100),
  add column finanzen boolean not null default false;
alter table public.einladungen drop constraint einladungen_rolle_check;
alter table public.einladungen add constraint einladungen_rolle_check check (rolle in ('admin','bearbeiter','leser','mitarbeiter'));
alter table public.einladungen add column anzeigename text not null default '' check (length(anzeigename) <= 200),
  add column funktion text not null default 'Mitarbeiter/in' check (length(funktion) between 1 and 100),
  add column finanzen boolean not null default false;

-- Restricted employees cannot read original briefs through the Data API either.
create or replace function public.darf_bereich(f uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with recursive kette as (
    select id, parent_id from public.bereiche where id = b and firma_id = f
    union all select p.id, p.parent_id from public.bereiche p join kette k on p.id = k.parent_id
  )
  select exists (select 1 from public.mitglieder m
    where m.firma_id = f and m.user_id = auth.uid() and m.aktiv and m.rolle <> 'mitarbeiter'
    and (b is null or m.alle_bereiche or m.rolle in ('inhaber','admin') or exists
      (select 1 from public.mitglied_bereiche mb where mb.firma_id=f and mb.user_id=m.user_id and mb.bereich_id in (select id from kette))))
$$;

create schema if not exists jarvis_intern;
revoke all on schema jarvis_intern from public;
grant usage on schema jarvis_intern to authenticated;
create function jarvis_intern.darf_finanzen(f uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and public.darf_bereich(f,b) and exists
    (select 1 from public.mitglieder m where m.firma_id=f and m.user_id=auth.uid() and m.aktiv
     and (m.rolle in ('inhaber','admin') or (m.rolle in ('bearbeiter','leser') and m.finanzen)))
$$;
revoke all on function jarvis_intern.darf_finanzen(uuid,uuid) from public,anon;
grant execute on function jarvis_intern.darf_finanzen(uuid,uuid) to authenticated;

drop policy lesen on public.kalkulationen;
create policy lesen on public.kalkulationen for select to authenticated using
  (exists (select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=kalkulationen.firma_id and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id)));
drop policy anlegen on public.kalkulationen;
create policy anlegen on public.kalkulationen for insert to authenticated with check
  (erstellt_von=auth.uid() and exists (select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=kalkulationen.firma_id and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id) and public.darf_bearbeiten(v.firma_id,v.bereich_id)));
drop policy lesen on public.kalkulationsvorlagen;
drop policy verwalten on public.kalkulationsvorlagen;
create policy lesen on public.kalkulationsvorlagen for select to authenticated using (jarvis_intern.darf_finanzen(firma_id,bereich_id));
create policy verwalten on public.kalkulationsvorlagen for all to authenticated using
  (jarvis_intern.darf_finanzen(firma_id,bereich_id) and public.darf_bearbeiten(firma_id,bereich_id)) with check
  (jarvis_intern.darf_finanzen(firma_id,bereich_id) and public.darf_bearbeiten(firma_id,bereich_id));

-- Role/area edits are atomic and run with the caller's row rights.
create function public.mitglied_aktualisieren(f uuid, u uuid, n text, funktion_neu text, rolle_neu text, finanzen_neu boolean, alle boolean, bereiche uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not public.ist_admin(f) then raise exception 'Nicht erlaubt'; end if;
  if exists (select 1 from unnest(bereiche) b where not exists (select 1 from public.bereiche x where x.id=b and x.firma_id=f)) then raise exception 'Fremder Bereich'; end if;
  perform 1 from public.mitglieder where firma_id=f and user_id=u for update;
  if not found then raise exception 'Mitglied nicht gefunden'; end if;
  update public.mitglieder set anzeigename=n, funktion=funktion_neu, rolle=rolle_neu,
    finanzen=finanzen_neu and rolle_neu in ('bearbeiter','leser'), alle_bereiche=alle where firma_id=f and user_id=u;
  delete from public.mitglied_bereiche where firma_id=f and user_id=u;
  insert into public.mitglied_bereiche (firma_id,user_id,bereich_id) select f,u,unnest(bereiche) on conflict do nothing;
end $$;
revoke all on function public.mitglied_aktualisieren(uuid,uuid,text,text,text,boolean,boolean,uuid[]) from public,anon;
grant execute on function public.mitglied_aktualisieren(uuid,uuid,text,text,text,boolean,boolean,uuid[]) to authenticated;

create or replace function public.einladung_annehmen(token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.einladungen;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  select * into e from public.einladungen where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and angenommen is null and gueltig_bis>now() for update;
  if not found then raise exception 'Einladung ungültig oder abgelaufen'; end if;
  if lower(e.email)<>lower(coalesce((select email from auth.users where id=auth.uid()),'')) then raise exception 'Einladung gilt für eine andere E-Mail-Adresse'; end if;
  insert into public.mitglieder (firma_id,user_id,rolle,anzeigename,funktion,finanzen,alle_bereiche)
    values (e.firma_id,auth.uid(),e.rolle,coalesce(nullif(e.anzeigename,''),e.email),e.funktion,e.finanzen and e.rolle in ('bearbeiter','leser'),cardinality(e.bereich_ids)=0)
    on conflict (firma_id,user_id) do update set rolle=excluded.rolle, aktiv=true, anzeigename=excluded.anzeigename,
      funktion=excluded.funktion, finanzen=excluded.finanzen, alle_bereiche=excluded.alle_bereiche;
  delete from public.mitglied_bereiche where firma_id=e.firma_id and user_id=auth.uid();
  insert into public.mitglied_bereiche (firma_id,user_id,bereich_id) select e.firma_id,auth.uid(),unnest(e.bereich_ids) on conflict do nothing;
  update public.einladungen set angenommen=now() where id=e.id;
  insert into public.protokoll (firma_id,user_id,aktion,details) values (e.firma_id,auth.uid(),'einladung_angenommen',jsonb_build_object('rolle',e.rolle));
  return e.firma_id;
end $$;

-- Only an explicitly selected snapshot is readable by a restricted recipient.
create table public.vorgang_freigaben (
  id uuid primary key default gen_random_uuid(), firma_id uuid not null references public.firmen on delete cascade,
  vorgang_id uuid not null, empfaenger_id uuid not null, erstellt_von uuid not null default auth.uid(),
  titel text not null check (length(titel) between 1 and 300),
  inhalte jsonb not null check (jsonb_typeof(inhalte)='object' and inhalte - array['auftrag','fristen','leistungen','nachweise','einsatz','angebot'] = '{}'::jsonb and octet_length(inhalte::text)<=60000),
  erstellt timestamptz not null default now(),
  unique (vorgang_id,empfaenger_id),
  foreign key (firma_id,vorgang_id) references public.vorgaenge(firma_id,id) on delete cascade,
  foreign key (firma_id,empfaenger_id) references public.mitglieder(firma_id,user_id) on delete cascade
);
create index on public.vorgang_freigaben(empfaenger_id,firma_id);
alter table public.vorgang_freigaben enable row level security;
create policy lesen on public.vorgang_freigaben for select to authenticated using
  (public.ist_admin(firma_id) or (empfaenger_id=auth.uid() and public.meine_rolle(firma_id) is not null));
create policy anlegen on public.vorgang_freigaben for insert to authenticated with check
  (public.ist_admin(firma_id) and erstellt_von=auth.uid() and exists(select 1 from public.mitglieder m where m.firma_id=vorgang_freigaben.firma_id and m.user_id=empfaenger_id and m.aktiv));
create policy aendern on public.vorgang_freigaben for update to authenticated using (public.ist_admin(firma_id)) with check
  (public.ist_admin(firma_id) and exists(select 1 from public.mitglieder m where m.firma_id=vorgang_freigaben.firma_id and m.user_id=empfaenger_id and m.aktiv));
create policy entfernen on public.vorgang_freigaben for delete to authenticated using (public.ist_admin(firma_id));

create table public.firmenunterlagen (
  id uuid primary key default gen_random_uuid(), firma_id uuid not null references public.firmen on delete cascade,
  name text not null check(length(name) between 1 and 200), art text not null check(art in ('nachweis','vorlage')),
  dateiname text not null, mime text not null, groesse bigint not null check(groesse between 1 and 20971520),
  gueltig_bis date, erstellt timestamptz not null default now(), unique(firma_id,id)
);
alter table public.firmenunterlagen enable row level security;
create policy lesen on public.firmenunterlagen for select to authenticated using(jarvis_intern.darf_finanzen(firma_id,null));
create policy verwalten on public.firmenunterlagen for all to authenticated using(public.ist_admin(firma_id)) with check(public.ist_admin(firma_id));
create function jarvis_intern.bibliothek_limit() returns trigger language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.firma_id::text,0));
  if (select count(*) from public.firmenunterlagen where firma_id=new.firma_id and id<>new.id)>=50
     or (select coalesce(sum(groesse),0) from public.firmenunterlagen where firma_id=new.firma_id and id<>new.id)+new.groesse>209715200 then
    raise exception 'Höchstens 50 Dateien und 200 MB je Firma';
  end if;
  return new;
end $$;
create trigger bibliothek_limit before insert or update on public.firmenunterlagen for each row execute function jarvis_intern.bibliothek_limit();

create table public.angebotsmappen (
  id uuid primary key default gen_random_uuid(), firma_id uuid not null references public.firmen on delete cascade,
  vorgang_id uuid not null, erstellt_von uuid not null default auth.uid(),
  text text not null check(length(text) between 1 and 50000),
  unterlagen_ids uuid[] not null default '{}', vorlage_id uuid,
  erstellt timestamptz not null default now(),
  foreign key(firma_id,vorgang_id) references public.vorgaenge(firma_id,id) on delete cascade,
  foreign key(firma_id,vorlage_id) references public.firmenunterlagen(firma_id,id) on delete set null (vorlage_id)
);
create index on public.angebotsmappen(firma_id,vorgang_id);
alter table public.angebotsmappen enable row level security;
create policy lesen on public.angebotsmappen for select to authenticated using
  (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=angebotsmappen.firma_id and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id)));
create policy verwalten on public.angebotsmappen for all to authenticated using
  (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=angebotsmappen.firma_id and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id) and public.darf_bearbeiten(v.firma_id,v.bereich_id))) with check
  (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=angebotsmappen.firma_id and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id) and public.darf_bearbeiten(v.firma_id,v.bereich_id)));
grant select,insert,update,delete on public.vorgang_freigaben,public.firmenunterlagen,public.angebotsmappen to authenticated;

create function jarvis_intern.angebotsunterlagen_pruefen() returns trigger language plpgsql set search_path='' as $$
begin
  if cardinality(new.unterlagen_ids)>15 or exists(select 1 from unnest(new.unterlagen_ids) u where not exists
     (select 1 from public.firmenunterlagen d where d.id=u and d.firma_id=new.firma_id and d.art='nachweis')) then
    raise exception 'Unzulässige Angebotsunterlagen';
  end if;
  if new.vorlage_id is not null and not exists(select 1 from public.firmenunterlagen d where d.id=new.vorlage_id and d.firma_id=new.firma_id and d.art='vorlage') then
    raise exception 'Unzulässige Angebotsvorlage';
  end if;
  return new;
end $$;
create trigger angebotsunterlagen_pruefen before insert or update on public.angebotsmappen for each row execute function jarvis_intern.angebotsunterlagen_pruefen();

revoke all on public.vorgang_freigaben,public.firmenunterlagen,public.angebotsmappen from anon;

create function jarvis_intern.freigabe_texte_pruefen() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from jsonb_each(new.inhalte) e where jsonb_typeof(e.value)<>'string') then raise exception 'Nur Textabschnitte sind freigebbar'; end if;
  return new;
end $$;
create trigger freigabe_texte_pruefen before insert or update on public.vorgang_freigaben for each row execute function jarvis_intern.freigabe_texte_pruefen();
