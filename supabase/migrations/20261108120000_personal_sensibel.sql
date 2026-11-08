-- Rechtsprüfung D1 (Art. 5 Abs. 1 c, Art. 32 DSGVO, § 26 BDSG): readers ("Leser", e.g. the tax adviser) see names, staff
-- numbers and hours, but not the internal note, birthday and residence permit of the staff file. Row-level security
-- cannot hide single columns, so the three columns lose the plain read right and come through public.personal_sicht,
-- which blanks them for readers. Office roles and the person themselves still see them.
-- New columns of public.personal must be granted for reading in their migration (grant select (spalte) …).
revoke select on public.personal from authenticated;
do $$
declare spalten text;
begin
  select string_agg(quote_ident(column_name), ', ') into spalten from information_schema.columns
   where table_schema = 'public' and table_name = 'personal' and column_name not in ('notiz', 'geburtstag', 'aufenthalt_bis');
  execute format('grant select (%s) on public.personal to authenticated', spalten);
end $$;

create or replace function public.personal_sicht(f uuid) returns setof public.personal
language plpgsql stable security definer set search_path = '' as $$
declare r public.personal; leser boolean := public.meine_rolle(f) = 'leser';
begin
  for r in select * from public.personal p where p.firma_id = f
      and (public.darf_bereich(p.firma_id, p.bereich_id) or (p.user_id = auth.uid() and public.meine_rolle(p.firma_id) is not null)) loop
    if leser and r.user_id is distinct from auth.uid() then
      r.notiz := ''; r.geburtstag := null; r.aufenthalt_bis := null;
    end if;
    return next r;
  end loop;
end $$;
revoke all on function public.personal_sicht(uuid) from public, anon;
grant execute on function public.personal_sicht(uuid) to authenticated;
notify pgrst, 'reload schema';
