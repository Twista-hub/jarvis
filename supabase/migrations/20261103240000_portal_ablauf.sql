-- Rechtsprüfung D5: customer portal links get an expiry date (12 months, renewed with every new link). The nightly
-- job (jarvis_intern.loeschfristen, before the backup) switches expired links off.
alter table public.kunden_portale add column if not exists gueltig_bis date not null default (current_date + interval '12 months')::date;

create or replace function jarvis_intern.loeschfristen(stichtag date default current_date)
returns table (tabelle text, geloescht bigint)
language plpgsql security definer set search_path = '' as $$
declare
  jahr date := date_trunc('year', stichtag)::date;
  n bigint;
begin
  delete from public.stempel where zeit < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'stempel'; geloescht := n; return next;
  delete from public.rundgang_scans where zeit < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'rundgang_scans'; geloescht := n; return next;
  delete from public.einsatz_bewertungen where datum < jahr - interval '2 years';
  get diagnostics n = row_count; tabelle := 'einsatz_bewertungen'; geloescht := n; return next;
  delete from public.personal_abwesenheiten where bis < jahr - interval '3 years';
  get diagnostics n = row_count; tabelle := 'personal_abwesenheiten'; geloescht := n; return next;
  delete from public.wachbuch where zeit < jahr - interval '3 years';
  get diagnostics n = row_count; tabelle := 'wachbuch'; geloescht := n; return next;
  -- D5: customer portal links expire (default 12 months after creation or renewal).
  update public.kunden_portale set aktiv = false where aktiv and gueltig_bis < stichtag;
  get diagnostics n = row_count; tabelle := 'kunden_portale (abgelaufen)'; geloescht := n; return next;
end $$;
revoke all on function jarvis_intern.loeschfristen(date) from public, anon, authenticated;
