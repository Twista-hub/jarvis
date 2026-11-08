-- Welcome mails after sign-up (Benjamin 08.11.2026 "mach 4"): day 1, 3 and 10 after a firm was created, to its owners and
-- admins (alarm/mail.py willkommen). Each stage once per firm.
create table if not exists jarvis_intern.willkommen_mails (
  firma_id uuid not null references public.firmen on delete cascade,
  stufe text not null check (stufe in ('tag1', 'tag3', 'tag10')),
  zeit timestamptz not null default now(),
  primary key (firma_id, stufe)
);
revoke all on jarvis_intern.willkommen_mails from public, anon, authenticated;
