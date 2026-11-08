-- Social posts (alarm/social.py): up to three posts per weekday and one at the weekend instead of one per weekday
-- (Browser-Chat 08.11.2026: only one post since 06.11.). One row per day, network and time slot.
alter table jarvis_intern.social_posts add column if not exists slot smallint not null default 1 check (slot between 1 and 3);
alter table jarvis_intern.social_posts drop constraint if exists social_posts_tag_kanal_key;
alter table jarvis_intern.social_posts drop constraint if exists social_posts_tag_kanal_slot_key;
alter table jarvis_intern.social_posts add constraint social_posts_tag_kanal_slot_key unique (tag, kanal, slot);
