-- Rechtsprüfung D9: open applications without a decision get a deletion date (12 months after the last status change);
-- the nightly job also deletes applicants of inactive firms 30 days after their deletion date.
create or replace function jarvis_intern.bewerber_frist() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.geaendert := now();
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.loeschen_ab := case new.status when 'absage' then (now() at time zone 'Europe/Berlin')::date + 183
                                       when 'eingestellt' then (now() at time zone 'Europe/Berlin')::date + 30
                                       else (now() at time zone 'Europe/Berlin')::date + 365 end;
  end if;
  return new;
end $$;
update public.bewerber set loeschen_ab = (geaendert at time zone 'Europe/Berlin')::date + 365 where loeschen_ab is null;

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
  -- D9: applicants past their deletion date whose firm has not opened Jarvis for 30 days (the app deletes files and rows
  -- itself when the office opens the page; this catches inactive firms). Files of the firm are removed with the account.
  delete from public.bewerber where loeschen_ab < stichtag - 30;
  get diagnostics n = row_count; tabelle := 'bewerber'; geloescht := n; return next;
  -- D5: customer portal links expire (default 12 months after creation or renewal).
  update public.kunden_portale set aktiv = false where aktiv and gueltig_bis < stichtag;
  get diagnostics n = row_count; tabelle := 'kunden_portale (abgelaufen)'; geloescht := n; return next;
end $$;
revoke all on function jarvis_intern.loeschfristen(date) from public, anon, authenticated;
