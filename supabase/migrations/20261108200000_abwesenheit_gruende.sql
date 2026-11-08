-- Rechtsprüfung A-M5: the office can record sick leave (without diagnosis), child sick days (§ 45 SGB V) and unpaid leave
-- separately for the payroll office. Staff still report an absence without a reason (Art. 9 DSGVO).
alter table public.personal_abwesenheiten drop constraint if exists personal_abwesenheiten_grund_check;
alter table public.personal_abwesenheiten add constraint personal_abwesenheiten_grund_check
  check (grund in ('urlaub', 'schulung', 'abwesend', 'krank', 'kinderkrank', 'unbezahlt'));
