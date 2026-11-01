-- Firm documents: a folder per file (empty = Jarvis sorts by type) and a flag when Jarvis read the expiry date
-- from the document. References as a form: Jarvis builds the reference list for offers from these rows.

alter table public.firmenunterlagen
  add column if not exists ordner text check (ordner is null or length(ordner) between 1 and 60),
  add column if not exists gueltig_erkannt boolean not null default false;

create table if not exists public.referenzen (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references public.firmen on delete cascade,
  auftraggeber text not null check (length(auftraggeber) between 1 and 200),
  leistung text not null check (length(leistung) between 1 and 500),
  ort text check (ort is null or length(ort) <= 100),
  von date,
  bis date,
  laufend boolean not null default false,
  auftragswert numeric(14,2) check (auftragswert is null or auftragswert >= 0),
  personal integer check (personal is null or personal between 0 and 100000),
  ansprechpartner text check (ansprechpartner is null or length(ansprechpartner) <= 200),
  kontakt text check (kontakt is null or length(kontakt) <= 200),
  erstellt timestamptz not null default now(),
  check (bis is null or von is null or bis >= von)
);
create index if not exists referenzen_firma on public.referenzen (firma_id, von desc);
alter table public.referenzen enable row level security;
create policy lesen on public.referenzen for select to authenticated using (jarvis_intern.darf_finanzen(firma_id, null));
create policy verwalten on public.referenzen for all to authenticated using (public.ist_admin(firma_id)) with check (public.ist_admin(firma_id));
grant select, insert, update, delete on public.referenzen to authenticated;
revoke all on public.referenzen from anon;

create or replace function jarvis_intern.referenzen_limit() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.referenzen where firma_id = new.firma_id) >= 100 then
    raise exception 'Höchstens 100 Referenzen je Firma';
  end if;
  return new;
end $$;
drop trigger if exists referenzen_limit on public.referenzen;
create trigger referenzen_limit before insert on public.referenzen for each row execute function jarvis_intern.referenzen_limit();
