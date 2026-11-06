-- Automatische Posts auf Bluesky und Mastodon (Benjamin 06.11.2026): Mo–Fr ein Post, reihum Ausschreibung, Zahl des
-- Tages, Funktions-Tipp. Die Tabelle verhindert doppelte Posts (je Tag und Kanal einer, jede Ausschreibung nur einmal).
-- Nur öffentliche Daten; geschrieben vom Ablauf "Social" (alarm/social.py) über die Datenbankverbindung.
create table if not exists jarvis_intern.social_posts (
  id bigint generated always as identity primary key,
  tag date not null,
  kanal text not null check (kanal in ('bluesky', 'mastodon')),
  art text not null check (art in ('ausschreibung', 'zahl', 'tipp')),
  katalog_id text check (length(katalog_id) <= 400),
  text text not null check (length(text) <= 600),
  adresse text check (length(adresse) <= 500),
  erstellt timestamptz not null default now(),
  unique (tag, kanal)
);
create unique index if not exists social_posts_katalog on jarvis_intern.social_posts (kanal, katalog_id) where katalog_id is not null;
revoke all on jarvis_intern.social_posts from public, anon, authenticated;
