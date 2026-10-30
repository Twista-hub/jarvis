-- Public procurement facts are shared. Operational and AI data remain private.
create schema if not exists jarvis_katalog;
revoke all on schema jarvis_katalog from public, anon, authenticated;

create table public.vergabekatalog (
  id text primary key check(length(id)<=400), quelle text not null,
  quelle_id text not null, version text not null, quell_datum timestamptz not null,
  titel text not null, beschreibung text not null default '', link text not null,
  auftraggeber text not null, auftraggeber_id text not null, ort text not null default '',
  plz text[] not null default '{}', cpv text[] not null default '{}',
  frist timestamptz, status text not null check(status in ('offen','unbekannt','aufgehoben','vergeben','abgeschlossen')),
  lose jsonb not null default '[]', bedarf jsonb not null default '[]', zuschlaege jsonb not null default '[]',
  vertragsende date, roh jsonb not null default '{}',
  abgerufen timestamptz not null default now(), geaendert timestamptz not null default now(),
  unique(quelle,quelle_id), check(octet_length(roh::text)<180000)
);
create index vergabekatalog_frist on public.vergabekatalog(status,frist);
create index vergabekatalog_auftraggeber on public.vergabekatalog(auftraggeber_id,quell_datum desc);
create index vergabekatalog_cpv on public.vergabekatalog using gin(cpv);
create index vergabekatalog_suche on public.vergabekatalog using gin(to_tsvector('german',titel||' '||beschreibung));
alter table public.vergabekatalog enable row level security;
create policy lesen on public.vergabekatalog for select to authenticated using
 (exists(select 1 from public.mitglieder where user_id=(select auth.uid()) and aktiv and rolle<>'mitarbeiter'));
grant select on public.vergabekatalog to authenticated;
revoke all on public.vergabekatalog from anon;

create table public.katalog_aenderungen (
 id bigint generated always as identity primary key,
 katalog_id text not null references public.vergabekatalog on delete cascade,
 version text not null, zeit timestamptz not null default now(), details jsonb not null,
 unique(katalog_id,version)
);
alter table public.katalog_aenderungen enable row level security;
create policy lesen on public.katalog_aenderungen for select to authenticated using
 (exists(select 1 from public.vergabekatalog k where k.id=katalog_id));
grant select on public.katalog_aenderungen to authenticated;

create table public.katalog_quellen (
 id text primary key, name text not null, url text not null, lizenz text not null,
 erlaubt boolean not null default false, geprueft date not null,
 letzter_versuch timestamptz, letzter_erfolg timestamptz, fehler text,
 bestand_ab date, bestand_bis date, rueckstand_tage integer not null default 60
);
insert into public.katalog_quellen(id,name,url,lizenz,erlaubt,geprueft) values
 ('bks','Bekanntmachungsservice','https://oeffentlichevergabe.de/api/notice-exports','CC0',true,'2026-10-30');
alter table public.katalog_quellen enable row level security;
create policy lesen on public.katalog_quellen for select to authenticated using
 (exists(select 1 from public.mitglieder where user_id=(select auth.uid()) and aktiv and rolle<>'mitarbeiter'));
grant select on public.katalog_quellen to authenticated;

create table jarvis_katalog.exporte (
 quelle text not null, tag date not null, etag text, checksum text, zuletzt timestamptz,
 versuche integer not null default 0, naechster_versuch timestamptz, fertig boolean not null default false,
 primary key(quelle,tag)
);
create table jarvis_katalog.bewertungen (
 firma_id uuid not null references public.firmen on delete cascade,
 katalog_id text not null references public.vergabekatalog on delete cascade,
 version text not null, profil_version text not null, methode text not null,
 ergebnis jsonb not null, erstellt timestamptz not null default now(),
 primary key(firma_id,katalog_id,version,profil_version,methode)
);
create table jarvis_katalog.ki_budget (
 monat date primary key, reserviert numeric(12,4) not null default 0 check(reserviert>=0),
 limit_usd numeric(12,4) not null default 20 check(limit_usd between 0 and 20)
);
create table jarvis_katalog.ki_kosten (
 id uuid primary key default gen_random_uuid(), zeit timestamptz not null default now(),
 zweck text not null, reserviert numeric(12,4) not null check(reserviert>=0),
 verbraucht numeric(12,4), check(verbraucht is null or verbraucht>=0)
);
-- One transaction reserves the worst-case request price before any API call.
create function jarvis_katalog.ki_reservieren(betrag numeric,zweck text) returns uuid
language plpgsql set search_path='' as $$
declare m date:=date_trunc('month',now())::date; i uuid;
begin
 if betrag<=0 or betrag>3 then return null; end if;
 insert into jarvis_katalog.ki_budget(monat) values(m) on conflict do nothing;
 perform 1 from jarvis_katalog.ki_budget where monat=m for update;
 if (select reserviert+betrag>limit_usd from jarvis_katalog.ki_budget where monat=m)
 or (select coalesce(sum(reserviert),0)+betrag>3 from jarvis_katalog.ki_kosten where zeit>=date_trunc('day',now())) then return null; end if;
 update jarvis_katalog.ki_budget set reserviert=reserviert+betrag where monat=m;
 insert into jarvis_katalog.ki_kosten(zweck,reserviert) values(zweck,betrag) returning id into i;
 return i;
end $$;
create function jarvis_katalog.ki_abschliessen(i uuid,betrag numeric) returns void
language plpgsql set search_path='' as $$
declare r jarvis_katalog.ki_kosten;
begin
 select * into r from jarvis_katalog.ki_kosten where id=i for update;
 if not found or r.verbraucht is not null then return; end if;
 update jarvis_katalog.ki_kosten set verbraucht=greatest(0,betrag) where id=i;
 update jarvis_katalog.ki_budget set reserviert=greatest(0,reserviert+r.reserviert*-1+greatest(0,betrag))
 where monat=date_trunc('month',r.zeit)::date;
 -- The daily ledger also uses settled costs, not the old reservation.
 update jarvis_katalog.ki_kosten set reserviert=greatest(0,betrag) where id=i;
end $$;
revoke all on all functions in schema jarvis_katalog from public,anon,authenticated;
alter table jarvis_katalog.exporte enable row level security;
alter table jarvis_katalog.bewertungen enable row level security;
alter table jarvis_katalog.ki_budget enable row level security;
alter table jarvis_katalog.ki_kosten enable row level security;

alter table public.vorgaenge add column katalog_id text references public.vergabekatalog on delete set null;
alter table public.vorgaenge add column katalog_version text;
create index vorgaenge_katalog on public.vorgaenge(katalog_id);

create table public.auftraggeber_abos (
 firma_id uuid not null references public.firmen on delete cascade,
 auftraggeber_id text not null, name text not null check(length(name)<=500),
 erstellt timestamptz not null default now(), primary key(firma_id,auftraggeber_id)
);
create table public.treffer_feedback (
 firma_id uuid not null references public.firmen on delete cascade,
 vorgang_id uuid not null references public.vorgaenge on delete cascade,
 grund text not null check(grund in ('region','taetigkeit','groesse','frist','passt')),
 notiz text not null default '' check(length(notiz)<=500),
 erstellt timestamptz not null default now(), primary key(firma_id,vorgang_id)
);
create table public.bedarf_bestaetigungen (
 firma_id uuid not null references public.firmen on delete cascade,
 vorgang_id uuid not null references public.vorgaenge on delete cascade,
 schluessel text not null check(length(schluessel)<=200),
 bestaetigt boolean not null, quelle_version text not null default '', primary key(firma_id,vorgang_id,schluessel)
);
alter table public.auftraggeber_abos enable row level security;
create policy lesen on public.auftraggeber_abos for select to authenticated using(public.meine_rolle(firma_id) in ('inhaber','admin','bearbeiter','leser','standortleitung'));
create policy verwalten on public.auftraggeber_abos for all to authenticated using(public.ist_admin(firma_id)) with check(public.ist_admin(firma_id));
alter table public.treffer_feedback enable row level security;
create policy lesen on public.treffer_feedback for select to authenticated using
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=treffer_feedback.firma_id));
create policy verwalten on public.treffer_feedback for all to authenticated using
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=treffer_feedback.firma_id and public.darf_bearbeiten(v.firma_id,v.bereich_id))) with check
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=treffer_feedback.firma_id and public.darf_bearbeiten(v.firma_id,v.bereich_id)));
alter table public.bedarf_bestaetigungen enable row level security;
create policy lesen on public.bedarf_bestaetigungen for select to authenticated using
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=bedarf_bestaetigungen.firma_id));
create policy verwalten on public.bedarf_bestaetigungen for all to authenticated using
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=bedarf_bestaetigungen.firma_id and public.darf_bearbeiten(v.firma_id,v.bereich_id))) with check
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=bedarf_bestaetigungen.firma_id and public.darf_bearbeiten(v.firma_id,v.bereich_id)));
grant select,insert,update,delete on public.auftraggeber_abos,public.treffer_feedback,public.bedarf_bestaetigungen to authenticated;

create table public.partnerprofile (
 firma_id uuid primary key references public.firmen on delete cascade,
 name text not null check(length(name) between 2 and 200),
 leistungen text not null check(length(leistungen) between 2 and 2000),
 region text not null default '' check(length(region)<=500),
 kontakt text not null default '' check(length(kontakt)<=300),
 sichtbar boolean not null default false, geaendert timestamptz not null default now()
);
alter table public.partnerprofile enable row level security;
create policy lesen on public.partnerprofile for select to authenticated using
 (public.ist_admin(firma_id) or (sichtbar and exists(select 1 from public.mitglieder where user_id=(select auth.uid()) and aktiv and rolle in ('inhaber','admin','bearbeiter','leser'))));
create policy verwalten on public.partnerprofile for all to authenticated using(public.ist_admin(firma_id)) with check(public.ist_admin(firma_id));
grant select,insert,update,delete on public.partnerprofile to authenticated;

create table public.angebotsergebnisse (
 firma_id uuid not null references public.firmen on delete cascade,
 vorgang_id uuid not null,
 umsatz numeric(14,2) check(umsatz>=0), kosten numeric(14,2) check(kosten>=0),
 notiz text not null default '' check(length(notiz)<=500), aktualisiert timestamptz not null default now(),
 primary key(firma_id,vorgang_id), foreign key(firma_id,vorgang_id) references public.vorgaenge(firma_id,id) on delete cascade
);
alter table public.angebotsergebnisse enable row level security;
create policy lesen on public.angebotsergebnisse for select to authenticated using
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=angebotsergebnisse.firma_id and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id)));
create policy verwalten on public.angebotsergebnisse for all to authenticated using
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=angebotsergebnisse.firma_id and public.darf_bearbeiten(v.firma_id,v.bereich_id) and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id))) with check
 (exists(select 1 from public.vorgaenge v where v.id=vorgang_id and v.firma_id=angebotsergebnisse.firma_id and public.darf_bearbeiten(v.firma_id,v.bereich_id) and jarvis_intern.darf_finanzen(v.firma_id,v.bereich_id)));
grant select,insert,update,delete on public.angebotsergebnisse to authenticated;

-- User-scoped search: caller must belong to the supplied firm; no privileged public view.
create function public.katalog_suche(f uuid,suche text default '',gebiet text default '',kaeufer text default '',zustand text default 'offen') returns setof public.vergabekatalog
language sql stable security invoker set search_path='' as $$
 select k.* from public.vergabekatalog k
 where public.meine_rolle(f) in ('inhaber','admin','bearbeiter','leser','standortleitung')
 and (suche='' or to_tsvector('german',k.titel||' '||k.beschreibung) @@ websearch_to_tsquery('german',left(suche,300)))
 and (gebiet='' or k.ort ilike '%'||left(gebiet,100)||'%' or exists(select 1 from unnest(k.plz) p where p like left(gebiet,5)||'%'))
 and (kaeufer='' or k.auftraggeber_id=kaeufer)
 and ((zustand='alle') or (zustand='offen' and k.status in ('offen','unbekannt') and (k.frist is null or k.frist>now())) or (zustand='zuschlaege' and jsonb_array_length(k.zuschlaege)>0))
 order by k.quell_datum desc,k.id limit 60
$$;
revoke all on function public.katalog_suche(uuid,text,text,text,text) from public,anon;
grant execute on function public.katalog_suche(uuid,text,text,text,text) to authenticated;

create function public.katalog_uebernehmen(f uuid,k text,b uuid default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v uuid; n public.vergabekatalog;
begin
 if not public.darf_bearbeiten(f,b) then raise exception 'Nicht erlaubt'; end if;
 select * into n from public.vergabekatalog where id=k;
 if not found then raise exception 'Bekanntmachung fehlt'; end if;
 if n.status not in ('offen','unbekannt') or n.frist<=now() then raise exception 'Nicht mehr offen'; end if;
 insert into public.vorgaenge(firma_id,quelle_id,titel,link,frist,steckbrief,bereich_id,katalog_id,katalog_version)
 values(f,n.quelle_id,n.titel,n.link,n.frist,'## Bekanntmachung'||chr(10)||chr(10)||n.beschreibung,b,n.id,n.version)
 on conflict(firma_id,quelle_id) do update set katalog_id=excluded.katalog_id,katalog_version=coalesce(public.vorgaenge.katalog_version,excluded.katalog_version)
 returning id into v;
 return v;
end $$;
revoke all on function public.katalog_uebernehmen(uuid,text,uuid) from public,anon;
grant execute on function public.katalog_uebernehmen(uuid,text,uuid) to authenticated;

create function jarvis_katalog.aufnehmen(daten jsonb) returns integer
language plpgsql set search_path='' as $$
declare d jsonb; alt public.vergabekatalog; n public.vergabekatalog; anzahl integer:=0;
begin
 if jsonb_array_length(daten)>100 then raise exception 'Batch zu groß'; end if;
 for d in select value from jsonb_array_elements(daten) loop
  select * into n from jsonb_populate_record(null::public.vergabekatalog,d);
  if n.quelle<>'bks' or n.id<>'bks:'||n.quelle_id then raise exception 'Quelle nicht freigegeben'; end if;
  perform pg_advisory_xact_lock(hashtextextended(n.id,0));
  select * into alt from public.vergabekatalog where id=n.id for update;
  if found and alt.quell_datum>n.quell_datum then continue; end if;
  if found and alt.version=n.version then
   update public.vergabekatalog set quell_datum=n.quell_datum,roh=n.roh,abgerufen=now() where id=n.id;
   continue;
  end if;
  if found then
   insert into public.katalog_aenderungen(katalog_id,version,details)
   values(n.id,n.version,jsonb_build_object('frist_vorher',alt.frist,'frist_neu',n.frist,'status_vorher',alt.status,'status_neu',n.status,'leistungen_geaendert',alt.beschreibung<>n.beschreibung,'lose_geaendert',alt.lose<>n.lose)) on conflict do nothing;
  end if;
  insert into public.vergabekatalog(id,quelle,quelle_id,version,quell_datum,titel,beschreibung,link,auftraggeber,auftraggeber_id,ort,plz,cpv,frist,status,lose,bedarf,zuschlaege,vertragsende,roh)
  values(n.id,n.quelle,n.quelle_id,n.version,n.quell_datum,n.titel,n.beschreibung,n.link,n.auftraggeber,n.auftraggeber_id,n.ort,n.plz,n.cpv,n.frist,n.status,n.lose,n.bedarf,n.zuschlaege,n.vertragsende,n.roh)
  on conflict(id) do update set version=excluded.version,quell_datum=excluded.quell_datum,titel=excluded.titel,beschreibung=excluded.beschreibung,link=excluded.link,auftraggeber=excluded.auftraggeber,auftraggeber_id=excluded.auftraggeber_id,ort=excluded.ort,plz=excluded.plz,cpv=excluded.cpv,frist=excluded.frist,status=excluded.status,lose=excluded.lose,bedarf=excluded.bedarf,zuschlaege=excluded.zuschlaege,vertragsende=excluded.vertragsende,roh=excluded.roh,abgerufen=now(),geaendert=now();
  -- Keep customer workflow status intact; source status is displayed separately.
  update public.vorgaenge set frist=n.frist,link=n.link,katalog_id=n.id where katalog_id=n.id or (quelle_id=n.quelle_id and katalog_id is null);
  anzahl:=anzahl+1;
 end loop;
 return anzahl;
end $$;
revoke all on function jarvis_katalog.aufnehmen(jsonb) from public,anon,authenticated;

create function public.katalog_statistik(f uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if public.meine_rolle(f) is null or public.meine_rolle(f)='mitarbeiter' then raise exception 'Nicht erlaubt'; end if;
 return jsonb_build_object(
 'gesamt',(select count(*) from public.vergabekatalog),
 'offen',(select count(*) from public.vergabekatalog where status in ('offen','unbekannt') and (frist is null or frist>now())),
 'unbekannte_frist',(select count(*) from public.vergabekatalog where status in ('offen','unbekannt') and frist is null),
 'berufe',(select coalesce(jsonb_agg(x),'[]') from (select b->>'name' as name,count(distinct k.id) as anzahl from public.vergabekatalog k cross join lateral jsonb_array_elements(k.bedarf) b where b->>'art'='beruf' and k.status in ('offen','unbekannt') and (k.frist is null or k.frist>now()) group by 1 order by 2 desc limit 20) x),
 'regionen',(select coalesce(jsonb_agg(x),'[]') from (select left(p,2) as plz_praefix,count(distinct k.id) as anzahl from public.vergabekatalog k cross join lateral unnest(k.plz) p where p ~ '^[0-9]{5}$' and k.ort not like '%Auftraggeberadresse%' and k.status in ('offen','unbekannt') and (k.frist is null or k.frist>now()) group by 1 order by 2 desc limit 20) x),
 'prognosen',(select coalesce(jsonb_agg(x),'[]') from (select id,titel,auftraggeber,vertragsende,greatest(current_date,vertragsende-90) as vorbereitung_ab from public.vergabekatalog where vertragsende>current_date and vertragsende<current_date+interval '18 months' order by vertragsende limit 20) x),
 'wiederkehrend',(select coalesce(jsonb_agg(x),'[]') from (select auftraggeber,regexp_replace(lower(titel),'[0-9]+','','g') as titel,count(*) as anzahl,min(quell_datum) as zuerst,max(quell_datum) as zuletzt from public.vergabekatalog group by auftraggeber,regexp_replace(lower(titel),'[0-9]+','','g') having count(*)>=2 and max(quell_datum)-min(quell_datum)>interval '180 days' order by max(quell_datum) desc limit 15) x)
 );
end $$;
revoke all on function public.katalog_statistik(uuid) from public,anon;
grant execute on function public.katalog_statistik(uuid) to authenticated;

create function jarvis_intern.katalog_budgetstatus(f uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.ist_admin(f) then raise exception 'Nicht erlaubt'; end if;
 return jsonb_build_object('monat',(select coalesce(sum(reserviert),0) from jarvis_katalog.ki_kosten where zeit>=date_trunc('month',now())),
 'tag',(select coalesce(sum(reserviert),0) from jarvis_katalog.ki_kosten where zeit>=date_trunc('day',now())),
 'cache',(select count(*) from jarvis_katalog.bewertungen where firma_id=f));
end $$;
revoke all on function jarvis_intern.katalog_budgetstatus(uuid) from public,anon;
grant execute on function jarvis_intern.katalog_budgetstatus(uuid) to authenticated;
create function public.katalog_budgetstatus(f uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select jarvis_intern.katalog_budgetstatus(f) $$;
revoke all on function public.katalog_budgetstatus(uuid) from public,anon;
grant execute on function public.katalog_budgetstatus(uuid) to authenticated;

notify pgrst, 'reload schema';
