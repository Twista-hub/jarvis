-- Rechtsprüfung A4 (rest): public holidays for leave and the time account follow the federal state of the person's
-- location (Standort), not only the firm's seat. Empty = as the firm (firm profile / postcode).
alter table public.bereiche add column if not exists bundesland text not null default '' check (bundesland = '' or bundesland ~ '^[A-Z]{2}$');
