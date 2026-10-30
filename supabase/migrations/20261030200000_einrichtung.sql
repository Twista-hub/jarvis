-- Setup assistant: the full search profile (services with CPV codes and words, exclusions, locations with
-- postal code prefixes) as written by the web app; the daily alarm (alarm/profile_db.py) reads it.
alter table public.suchprofile add column einstellungen jsonb not null default '{}';
alter table public.suchprofile add column geaendert timestamptz not null default now();
-- One firm-wide profile per firm (profiles per area may follow later).
create unique index suchprofile_firma on public.suchprofile (firma_id) where bereich_id is null;
