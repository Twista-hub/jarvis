-- Reminders before the end of the 30-day trial (Benjamin 07.11.2026; plan from 03.11.: day 23 and day 28). Sent by the hourly
-- mail run (alarm/mail.py probe_erinnerungen) to the firm's owners and admins; each stage once per firm.
create table if not exists jarvis_intern.probe_erinnerungen (
  firma_id uuid not null references public.firmen on delete cascade,
  stufe text not null check (stufe in ('tag23', 'tag28')),
  zeit timestamptz not null default now(),
  primary key (firma_id, stufe)
);
revoke all on jarvis_intern.probe_erinnerungen from public, anon, authenticated;
