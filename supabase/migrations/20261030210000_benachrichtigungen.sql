-- Daily mail per person and firm: the hour (Berlin time) chosen by the person; no row or null = no mail.
-- alarm/mail.py sends new hits and deadline reminders and notes when it last sent.
create table public.benachrichtigungen (
  firma_id uuid not null,
  user_id uuid not null,
  stunde int check (stunde between 0 and 23),
  letzte_mail timestamptz,
  primary key (firma_id, user_id),
  foreign key (firma_id, user_id) references public.mitglieder on delete cascade
);
alter table public.benachrichtigungen enable row level security;
-- Everyone manages only their own setting, and only for firms they belong to.
create policy eigene on public.benachrichtigungen for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.meine_rolle(firma_id) is not null);
grant select, insert, update, delete on public.benachrichtigungen to authenticated;
