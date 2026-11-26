-- Automatic posts on Facebook and Instagram (Benjamin 26.11.2026): they go through one Make.com scenario, so both
-- networks share one row per day with kanal 'meta' (alarm/social_meta.py). The table still prevents double posts.
alter table jarvis_intern.social_posts drop constraint if exists social_posts_kanal_check;
alter table jarvis_intern.social_posts add constraint social_posts_kanal_check check (kanal in ('bluesky', 'mastodon', 'meta'));
