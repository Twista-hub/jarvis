-- Each firm maintains the applicable agreements and their exact group names.
-- The existing GVP/DGB table is the only built-in agreement; customer-specific agreements are configurable.
create table public.firmen_tarifvertraege (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  name text not null check (length(trim(name)) between 2 and 160),
  geltungsbereich text not null default '' check (length(geltungsbereich) <= 240),
  gruppen text[] not null check (cardinality(gruppen) between 1 and 30),
  quelle text not null default '' check (length(quelle) <= 500),
  gueltig_ab date,
  gueltig_bis date,
  vorgegeben boolean not null default false,
  erstellt timestamptz not null default now(),
  unique (firma_id,id)
);
create unique index firmen_tarifvertraege_name on public.firmen_tarifvertraege(firma_id,lower(name));
alter table public.firmen_tarifvertraege enable row level security;
create policy lesen on public.firmen_tarifvertraege for select to authenticated using
  (public.meine_rolle(firma_id) is not null and public.meine_rolle(firma_id)<>'mitarbeiter');
create policy verwalten on public.firmen_tarifvertraege for all to authenticated using (public.ist_admin(firma_id))
  with check (public.ist_admin(firma_id));
grant select,insert,update,delete on public.firmen_tarifvertraege to authenticated;

create function public.firmen_tarifvertraege_anlegen() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.firmen_tarifvertraege(firma_id,name,geltungsbereich,gruppen,quelle,gueltig_ab,vorgegeben)
  values(new.id,'Zeitarbeit GVP/DGB','Deutschland · Arbeitnehmerüberlassung',array['1','2a','2b','3','4','5','6','7','8','9'],
    'Entgelttarifvertrag DGB/GVP vom 12.09.2025; Entgeltrahmentarifvertrag DGB/GVP vom 20.05.2025','2026-01-01',true);
  return new;
end $$;
create trigger firmen_tarifvertraege_standard after insert on public.firmen
for each row execute function public.firmen_tarifvertraege_anlegen();

insert into public.firmen_tarifvertraege(firma_id,name,geltungsbereich,gruppen,quelle,gueltig_ab,vorgegeben)
select f.id,'Zeitarbeit GVP/DGB','Deutschland · Arbeitnehmerüberlassung',array['1','2a','2b','3','4','5','6','7','8','9'],
  'Entgelttarifvertrag DGB/GVP vom 12.09.2025; Entgeltrahmentarifvertrag DGB/GVP vom 20.05.2025','2026-01-01',true
from public.firmen f
where not exists(select 1 from public.firmen_tarifvertraege t where t.firma_id=f.id and lower(t.name)=lower('Zeitarbeit GVP/DGB'));

alter table public.personal add column tarifvertrag_id uuid;
alter table public.personal drop constraint personal_eg_check;
alter table public.personal add constraint personal_eg_check check (length(eg) <= 80);
alter table public.personal add constraint personal_tarifvertrag_fk
  foreign key (firma_id,tarifvertrag_id) references public.firmen_tarifvertraege(firma_id,id) on delete set null (tarifvertrag_id);
update public.personal p set tarifvertrag_id=t.id
from public.firmen_tarifvertraege t
where t.firma_id=p.firma_id and t.vorgegeben;

create function public.personal_tarifgruppe_pruefen() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.eg='' then return new; end if;
  if new.tarifvertrag_id is null or not exists (
    select 1 from public.firmen_tarifvertraege t
    where t.firma_id=new.firma_id and t.id=new.tarifvertrag_id and new.eg=any(t.gruppen)
  ) then raise exception 'Entgeltgruppe gehört nicht zum gewählten Tarifvertrag'; end if;
  return new;
end $$;
create trigger personal_tarifgruppe_check before insert or update of firma_id,tarifvertrag_id,eg on public.personal
for each row execute function public.personal_tarifgruppe_pruefen();
