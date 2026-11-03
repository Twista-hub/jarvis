-- Rechtsprüfung K7 (AI Act Art. 12/19 traceability, own records): every AI request of the web app also records the model
-- and Anthropic's request id next to its cost. No prompt or answer content is stored.
alter table jarvis_katalog.ki_kosten add column if not exists modell text check (modell is null or length(modell) <= 80);
alter table jarvis_katalog.ki_kosten add column if not exists anfrage_id text check (anfrage_id is null or length(anfrage_id) <= 120);

create or replace function jarvis_katalog.ki_protokoll(i uuid, m text, a text) returns void
language sql set search_path = '' as $$
  update jarvis_katalog.ki_kosten set modell = left(m, 80), anfrage_id = left(a, 120) where id = i;
$$;
revoke all on function jarvis_katalog.ki_protokoll(uuid, text, text) from public, anon, authenticated;
