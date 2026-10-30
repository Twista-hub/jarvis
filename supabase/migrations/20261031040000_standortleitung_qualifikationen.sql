-- A site lead can manage operational staff and assignments in exactly one assigned area.
-- They do not receive financial access or company-wide member/area administration.
alter table public.mitglieder drop constraint mitglieder_rolle_check;
alter table public.mitglieder add constraint mitglieder_rolle_check
  check (rolle in ('inhaber','admin','bearbeiter','standortleitung','leser','mitarbeiter'));
alter table public.einladungen drop constraint einladungen_rolle_check;
alter table public.einladungen add constraint einladungen_rolle_check
  check (rolle in ('admin','bearbeiter','standortleitung','leser','mitarbeiter'));

create or replace function public.mitglied_aktualisieren(f uuid, u uuid, n text, funktion_neu text, rolle_neu text, finanzen_neu boolean, alle boolean, bereiche uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not public.ist_admin(f) then raise exception 'Nicht erlaubt'; end if;
  if rolle_neu not in ('inhaber','admin','bearbeiter','standortleitung','leser','mitarbeiter') then raise exception 'Ungültige Rolle'; end if;
  if exists (select 1 from unnest(bereiche) b where not exists (select 1 from public.bereiche x where x.id=b and x.firma_id=f)) then raise exception 'Fremder Bereich'; end if;
  if rolle_neu = 'standortleitung' and (alle or cardinality(bereiche) <> 1) then raise exception 'Standortleitung braucht genau einen Bereich'; end if;
  if rolle_neu = 'standortleitung' and exists (select 1 from public.bereiche x join public.bereiche kind on kind.parent_id=x.id and kind.art='standort' where x.firma_id=f and x.id=bereiche[1]) then raise exception 'Bitte einen einzelnen Standort statt einer Region wählen'; end if;
  perform 1 from public.mitglieder where firma_id=f and user_id=u for update;
  if not found then raise exception 'Mitglied nicht gefunden'; end if;
  update public.mitglieder set anzeigename=n, funktion=funktion_neu, rolle=rolle_neu,
    finanzen=finanzen_neu and rolle_neu in ('bearbeiter','leser'), alle_bereiche=alle and rolle_neu <> 'standortleitung'
    where firma_id=f and user_id=u;
  delete from public.mitglied_bereiche where firma_id=f and user_id=u;
  insert into public.mitglied_bereiche (firma_id,user_id,bereich_id) select f,u,unnest(bereiche) on conflict do nothing;
end $$;

create or replace function public.einladung_annehmen(token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare e public.einladungen;
begin
  if auth.uid() is null then raise exception 'nicht angemeldet'; end if;
  select * into e from public.einladungen where token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') and angenommen is null and gueltig_bis>now() for update;
  if not found then raise exception 'Einladung ungültig oder abgelaufen'; end if;
  if lower(e.email)<>lower(coalesce((select email from auth.users where id=auth.uid()),'')) then raise exception 'Einladung gilt für eine andere E-Mail-Adresse'; end if;
  if e.rolle='standortleitung' and cardinality(e.bereich_ids)<>1 then raise exception 'Standortleitung braucht genau einen Bereich'; end if;
  if e.rolle='standortleitung' and exists (select 1 from public.bereiche x join public.bereiche kind on kind.parent_id=x.id and kind.art='standort' where x.firma_id=e.firma_id and x.id=e.bereich_ids[1]) then raise exception 'Bitte einen einzelnen Standort statt einer Region wählen'; end if;
  insert into public.mitglieder (firma_id,user_id,rolle,anzeigename,funktion,finanzen,alle_bereiche)
    values (e.firma_id,auth.uid(),e.rolle,coalesce(nullif(e.anzeigename,''),e.email),e.funktion,e.finanzen and e.rolle in ('bearbeiter','leser'),cardinality(e.bereich_ids)=0 and e.rolle <> 'standortleitung')
    on conflict (firma_id,user_id) do update set rolle=excluded.rolle, aktiv=true, anzeigename=excluded.anzeigename,
      funktion=excluded.funktion, finanzen=excluded.finanzen, alle_bereiche=excluded.alle_bereiche;
  delete from public.mitglied_bereiche where firma_id=e.firma_id and user_id=auth.uid();
  insert into public.mitglied_bereiche (firma_id,user_id,bereich_id) select e.firma_id,auth.uid(),unnest(e.bereich_ids) on conflict do nothing;
  update public.einladungen set angenommen=now() where id=e.id;
  insert into public.protokoll(firma_id,user_id,aktion,details) values(e.firma_id,auth.uid(),'einladung_angenommen',jsonb_build_object('rolle',e.rolle));
  return e.firma_id;
end $$;

create table public.firmen_qualifikationen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  bereich_id uuid,
  name text not null check (length(trim(name)) between 2 and 80),
  erstellt_von uuid references auth.users on delete set null,
  erstellt timestamptz not null default now(),
  foreign key (firma_id,bereich_id) references public.bereiche(firma_id,id) on delete cascade
);
create unique index firmen_qualifikationen_global_name on public.firmen_qualifikationen(firma_id,lower(name)) where bereich_id is null;
create unique index firmen_qualifikationen_bereich_name on public.firmen_qualifikationen(firma_id,bereich_id,lower(name)) where bereich_id is not null;
alter table public.firmen_qualifikationen enable row level security;
create policy lesen on public.firmen_qualifikationen for select to authenticated using
  (public.meine_rolle(firma_id) is not null and public.meine_rolle(firma_id)<>'mitarbeiter' and (bereich_id is null or public.darf_bereich(firma_id,bereich_id)));
create policy anlegen on public.firmen_qualifikationen for insert to authenticated with check
  (erstellt_von=auth.uid() and public.darf_bearbeiten(firma_id,bereich_id) and (bereich_id is not null or public.ist_admin(firma_id)));
create policy aendern on public.firmen_qualifikationen for update to authenticated using
  (public.darf_bearbeiten(firma_id,bereich_id) and (bereich_id is not null or public.ist_admin(firma_id))) with check
  (public.darf_bearbeiten(firma_id,bereich_id) and (bereich_id is not null or public.ist_admin(firma_id)));
create policy loeschen on public.firmen_qualifikationen for delete to authenticated using
  (public.darf_bearbeiten(firma_id,bereich_id) and (bereich_id is not null or public.ist_admin(firma_id)));
grant select,insert,update,delete on public.firmen_qualifikationen to authenticated;

-- Site leads have scoped editor rights for operational records. Finance remains separately gated.
create or replace function public.darf_bearbeiten(f uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.meine_rolle(f) in ('inhaber','admin','bearbeiter','standortleitung'), false)
    and public.darf_bereich(f,b)
    and (public.meine_rolle(f)<>'standortleitung' or b is not null)
$$;

-- Unlike company-wide editors, site leads must never see or change records without a location.
create or replace function public.darf_bereich(f uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with recursive kette as (
    select id,parent_id from public.bereiche where id=b and firma_id=f
    union all select p.id,p.parent_id from public.bereiche p join kette k on p.id=k.parent_id
  )
  select exists (select 1 from public.mitglieder m
    where m.firma_id=f and m.user_id=auth.uid() and m.aktiv and m.rolle<>'mitarbeiter'
      and (
        (m.rolle='standortleitung' and b is not null and exists (
          select 1 from public.mitglied_bereiche mb where mb.firma_id=f and mb.user_id=m.user_id and mb.bereich_id in (select id from kette)))
        or (m.rolle<>'standortleitung' and (b is null or m.alle_bereiche or m.rolle in ('inhaber','admin') or exists (
          select 1 from public.mitglied_bereiche mb where mb.firma_id=f and mb.user_id=m.user_id and mb.bereich_id in (select id from kette))))
      ))
$$;
