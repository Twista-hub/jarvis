-- Operator tools: the operator (Benjamin) can look up a customer login by e-mail and delete it, optionally with the
-- firms it owns alone. Works like the customer's own account deletion; the worker then removes the stored files.
create table if not exists jarvis_intern.betreiber (email text primary key check (email = lower(email)));
revoke all on jarvis_intern.betreiber from public, authenticated, anon;
insert into jarvis_intern.betreiber (email) values ('benschiffer79@gmail.com') on conflict do nothing;

create or replace function public.ist_betreiber() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jarvis_intern.betreiber b join auth.users u on lower(u.email) = b.email where u.id = auth.uid())
$$;

-- Firms of one login: name, role, number of members (read only, operator only).
create or replace function public.betreiber_konto_suchen(mail text)
returns table (user_id uuid, email text, firma_id uuid, firma text, rolle text, mitglieder integer, allein_inhaber boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt'; end if;
  return query
    select u.id, u.email::text, f.id, f.name, m.rolle,
           (select count(*)::integer from public.mitglieder o where o.firma_id = f.id),
           m.rolle = 'inhaber' and not exists (select 1 from public.mitglieder o where o.firma_id = f.id and o.user_id <> u.id and o.rolle = 'inhaber' and o.aktiv)
    from auth.users u left join public.mitglieder m on m.user_id = u.id left join public.firmen f on f.id = m.firma_id
    where lower(u.email) = lower(trim(betreiber_konto_suchen.mail));
end $$;

-- Deletes the login. Firms where it is the only member go with it (trigger). With firmen_mit, also firms where it is
-- the only owner, together with all their data (other members lose access to that firm). Returns the deleted firms
-- and their tenders so the worker can remove files.
create or replace function public.betreiber_konto_loeschen(mail text, firmen_mit boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid; weg uuid[]; ergebnis jsonb;
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt'; end if;
  select id into u from auth.users where lower(email) = lower(trim(betreiber_konto_loeschen.mail));
  if u is null then raise exception 'NICHT_GEFUNDEN'; end if;
  if u = auth.uid() then raise exception 'EIGENES_KONTO'; end if;
  select coalesce(array_agg(m.firma_id), '{}') into weg from public.mitglieder m
   where m.user_id = u and (
     not exists (select 1 from public.mitglieder o where o.firma_id = m.firma_id and o.user_id <> u)
     or (betreiber_konto_loeschen.firmen_mit and m.rolle = 'inhaber'
         and not exists (select 1 from public.mitglieder o where o.firma_id = m.firma_id and o.user_id <> u and o.rolle = 'inhaber' and o.aktiv)));
  if not betreiber_konto_loeschen.firmen_mit and exists (
    select 1 from public.mitglieder m where m.user_id = u and m.rolle = 'inhaber' and m.aktiv
       and not exists (select 1 from public.mitglieder o where o.firma_id = m.firma_id and o.user_id <> u and o.rolle = 'inhaber' and o.aktiv)
       and exists (select 1 from public.mitglieder o where o.firma_id = m.firma_id and o.user_id <> u)) then
    raise exception 'LETZTER_INHABER';
  end if;
  ergebnis := jsonb_build_object('firmen', to_jsonb(weg), 'vorgaenge', coalesce((select jsonb_agg(v.id) from public.vorgaenge v where v.firma_id = any(weg)), '[]'::jsonb));
  delete from public.firmen where id = any(weg);
  delete from auth.users where id = u;
  return ergebnis;
end $$;

revoke all on function public.ist_betreiber(), public.betreiber_konto_suchen(text), public.betreiber_konto_loeschen(text, boolean) from public, anon;
grant execute on function public.ist_betreiber(), public.betreiber_konto_suchen(text), public.betreiber_konto_loeschen(text, boolean) to authenticated;
