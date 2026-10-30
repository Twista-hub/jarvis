-- One commercial contact per tender. Assignment labels responsibility; it grants no tender or finance rights.
alter table public.vorgaenge
  add column kaufverantwortlich_id uuid;

alter table public.vorgaenge
  add constraint vorgaenge_kaufverantwortlich_mitglied_fk
  foreign key (firma_id, kaufverantwortlich_id)
  references public.mitglieder (firma_id, user_id)
  on delete set null (kaufverantwortlich_id);

create index vorgaenge_kaufverantwortlich_idx
  on public.vorgaenge (firma_id, kaufverantwortlich_id)
  where kaufverantwortlich_id is not null;

create function public.pruefe_kaufverantwortlich() returns trigger
language plpgsql set search_path = '' as $$
declare zielrolle text; zielaktiv boolean; zielalle boolean;
begin
  if tg_op = 'UPDATE'
     and new.kaufverantwortlich_id is not distinct from old.kaufverantwortlich_id
     and new.bereich_id is not distinct from old.bereich_id then
    return new;
  end if;
  if new.kaufverantwortlich_id is null then return new; end if;

  select rolle, aktiv, alle_bereiche into zielrolle, zielaktiv, zielalle
    from public.mitglieder
   where firma_id = new.firma_id and user_id = new.kaufverantwortlich_id;
  if not found or not zielaktiv or zielrolle not in ('inhaber', 'admin', 'bearbeiter') then
    raise exception 'Kaufmännisch Verantwortliche Person muss ein aktives berechtigtes Firmenmitglied sein';
  end if;

  if zielrolle = 'bearbeiter' and new.bereich_id is not null and not zielalle then
    if not exists (
      with recursive eltern(id, parent_id) as (
        select b.id, b.parent_id from public.bereiche b
         where b.id = new.bereich_id and b.firma_id = new.firma_id
        union all
        select b.id, b.parent_id from public.bereiche b join eltern e on b.id = e.parent_id
      )
      select 1 from public.mitglied_bereiche mb join eltern e on e.id = mb.bereich_id
       where mb.firma_id = new.firma_id and mb.user_id = new.kaufverantwortlich_id
    ) then
      raise exception 'Kaufmännisch Verantwortliche Person hat keinen Zugriff auf diesen Bereich';
    end if;
  end if;
  return new;
end $$;

create trigger pruefe_kaufverantwortlich_vorgang
before insert or update on public.vorgaenge
for each row execute function public.pruefe_kaufverantwortlich();
