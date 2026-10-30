-- Preview account "PerLease (Vorschau)" for Benjamin: the daily report fills it with PerLease hits
-- (alarm/profile.json perlease.firma_id), sorted into regions with PerLease's 16 locations (perlease.de, 30.10.2026).
-- Fixed ids so the report and this file stay in sync.
insert into public.firmen (id, name, paket)
values ('7e4a6c1e-5c2b-4f0a-9d3e-000000000001', 'PerLease (Vorschau)', 'test')
on conflict (id) do nothing;

insert into public.mitglieder (firma_id, user_id, rolle, alle_bereiche)
select '7e4a6c1e-5c2b-4f0a-9d3e-000000000001', u.id, 'inhaber', true
from auth.users u where lower(u.email) = 'benschiffer79@gmail.com'
on conflict (firma_id, user_id) do nothing;

insert into public.bereiche (id, firma_id, parent_id, name, art) values
  ('7e4a6c1e-5c2b-4f0a-9d3e-000000000101', '7e4a6c1e-5c2b-4f0a-9d3e-000000000001', null, 'Berlin/Brandenburg', 'standort'),
  ('7e4a6c1e-5c2b-4f0a-9d3e-000000000102', '7e4a6c1e-5c2b-4f0a-9d3e-000000000001', null, 'Nord', 'standort'),
  ('7e4a6c1e-5c2b-4f0a-9d3e-000000000103', '7e4a6c1e-5c2b-4f0a-9d3e-000000000001', null, 'NRW', 'standort'),
  ('7e4a6c1e-5c2b-4f0a-9d3e-000000000104', '7e4a6c1e-5c2b-4f0a-9d3e-000000000001', null, 'Rhein-Main', 'standort')
on conflict (id) do nothing;

insert into public.bereiche (firma_id, parent_id, name, art)
select '7e4a6c1e-5c2b-4f0a-9d3e-000000000001', ('7e4a6c1e-5c2b-4f0a-9d3e-00000000010' || r)::uuid, s, 'standort'
from (values ('1', 'Berlin'),
             ('2', 'Hamburg'), ('2', 'Bremen'), ('2', 'Lübeck'), ('2', 'Hannover'),
             ('3', 'Aachen'), ('3', 'Bochum'), ('3', 'Bonn'), ('3', 'Dortmund'), ('3', 'Düsseldorf'),
             ('3', 'Gelsenkirchen'), ('3', 'Köln'), ('3', 'Leverkusen'), ('3', 'Neuss'),
             ('4', 'Frankfurt am Main'), ('4', 'Mainz')) as v(r, s)
where not exists (select 1 from public.bereiche b where b.firma_id = '7e4a6c1e-5c2b-4f0a-9d3e-000000000001' and b.name = v.s);
