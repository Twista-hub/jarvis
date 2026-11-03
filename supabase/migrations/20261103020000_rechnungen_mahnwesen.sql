-- Idea 18 (docs/ideen-arbeitsoberflaeche.md): payment status and dunning for the invoice drafts. Only these status columns
-- can be changed afterwards; number, amounts and positions stay as created (GoBD: no silent changes to issued invoices).
alter table public.rechnungen add column if not exists bezahlt_am date;
alter table public.rechnungen add column if not exists mahnstufe smallint not null default 0 check (mahnstufe between 0 and 3);
alter table public.rechnungen add column if not exists gemahnt_am date;
alter table public.rechnungen add column if not exists zahlungsziel_tage smallint not null default 14 check (zahlungsziel_tage between 0 and 120);
-- Supabase grants table-wide update by default: take it back, then allow only the status columns.
revoke update on public.rechnungen from authenticated;
grant update (bezahlt_am, mahnstufe, gemahnt_am) on public.rechnungen to authenticated;
-- Independent of grants: the content of an issued invoice cannot change, only its payment and dunning status.
create or replace function jarvis_intern.rechnung_unveraenderlich() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.firma_id, new.kunde_id, new.nummer, new.monat, new.datum, new.positionen, new.netto, new.ust_satz, new.zahlungsziel_tage)
     is distinct from (old.firma_id, old.kunde_id, old.nummer, old.monat, old.datum, old.positionen, old.netto, old.ust_satz, old.zahlungsziel_tage) then
    raise exception 'Rechnungsinhalt ist unveränderlich (nur Zahlungs- und Mahnstatus)' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rechnung_unveraenderlich on public.rechnungen;
create trigger rechnung_unveraenderlich before update on public.rechnungen for each row execute function jarvis_intern.rechnung_unveraenderlich();
