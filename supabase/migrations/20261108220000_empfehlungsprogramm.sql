-- Empfehlungsprogramm (Benjamin 08.11.2026): Partner (Berater, Vergabeberater, Coaches) melden sich auf /partner an,
-- der Betreiber schaltet sie frei. Ein Partner-Link /registrieren?p=<code> legt den Code in den Daten des neuen Kontos ab
-- (kein Cookie); legt dieses Konto eine Firma an, gehört die Firma zum Partner. Jede bezahlte Stripe-Rechnung der Firma
-- ergibt in den ersten <monate> Monaten nach der ersten Zahlung eine Provision von <satz> Prozent. Ausgezahlt wird von Hand;
-- der Betreiber hakt die Provision dann als bezahlt ab. Keine Gratismonate.

create table if not exists jarvis_intern.empfehlung_einstellungen (
  id boolean primary key default true check (id),
  satz numeric(5,2) not null default 20 check (satz >= 0 and satz <= 50),
  monate integer not null default 12 check (monate between 1 and 60)
);
insert into jarvis_intern.empfehlung_einstellungen (id) values (true) on conflict do nothing;

create table if not exists jarvis_intern.empfehlungspartner (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 100),
  firma text check (firma is null or length(firma) <= 200),
  email text not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' and length(email) <= 200),
  website text check (website is null or length(website) <= 300),
  zielgruppe text check (zielgruppe is null or length(zielgruppe) <= 1000),
  code text unique check (code is null or code ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status text not null default 'neu' check (status in ('neu', 'aktiv', 'gesperrt')),
  satz numeric(5,2) check (satz is null or (satz >= 0 and satz <= 50)),
  zustimmung timestamptz not null,
  erstellt timestamptz not null default now(),
  freigeschaltet timestamptz
);

create table if not exists jarvis_intern.empfehlungen (
  firma_id uuid primary key references public.firmen(id) on delete cascade,
  partner_id uuid not null references jarvis_intern.empfehlungspartner(id) on delete cascade,
  erstellt timestamptz not null default now()
);

create table if not exists jarvis_intern.provisionen (
  rechnung text primary key check (rechnung ~ '^in_[A-Za-z0-9]{6,80}$'),
  partner_id uuid not null references jarvis_intern.empfehlungspartner(id) on delete cascade,
  firma_id uuid references public.firmen(id) on delete set null,
  firma_name text not null,
  betrag_cent integer not null check (betrag_cent >= 0),
  satz numeric(5,2) not null,
  provision_cent integer not null check (provision_cent >= 0),
  gezahlt timestamptz not null,
  ausgezahlt date
);
create index if not exists provisionen_partner on jarvis_intern.provisionen (partner_id, ausgezahlt);
revoke all on jarvis_intern.empfehlung_einstellungen, jarvis_intern.empfehlungspartner, jarvis_intern.empfehlungen, jarvis_intern.provisionen from public, anon, authenticated;

-- Code for a partner from his name: lower case, umlauts spelled out, other characters to "-".
create or replace function jarvis_intern.partner_code(name text) returns text
language sql immutable set search_path = '' as $$
  select left(trim(both '-' from regexp_replace(translate(lower(name), 'äöüß', 'aous'), '[^a-z0-9]+', '-', 'g')), 30)
$$;

-- Sign-up on /partner (no login). At most 20 new applications a day; the same address only once.
create or replace function public.partner_bewerben(name text, firma text, email text, website text, zielgruppe text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from jarvis_intern.empfehlungspartner p where p.erstellt > now() - interval '1 day') >= 20 then raise exception 'ZU_VIELE'; end if;
  insert into jarvis_intern.empfehlungspartner (name, firma, email, website, zielgruppe, zustimmung)
  values (trim(partner_bewerben.name), nullif(trim(partner_bewerben.firma), ''), lower(trim(partner_bewerben.email)),
          nullif(trim(partner_bewerben.website), ''), nullif(trim(partner_bewerben.zielgruppe), ''), now())
  on conflict on constraint empfehlungspartner_email_key do nothing;
  if found then
    perform jarvis_intern.betreiber_melden('🤝 Neuer Partner-Antrag', trim(partner_bewerben.name) || coalesce(' · ' || nullif(trim(partner_bewerben.firma), ''), ''));
  end if;
  return true;
end $$;
revoke all on function public.partner_bewerben(text, text, text, text, text) from public;
grant execute on function public.partner_bewerben(text, text, text, text, text) to anon, authenticated;

-- Name shown on the sign-up form for a valid partner link ("Empfohlen von …"); null for unknown or blocked codes.
create or replace function public.partner_name(code text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(p.firma, p.name) from jarvis_intern.empfehlungspartner p where p.code = lower(partner_name.code) and p.status = 'aktiv'
$$;
revoke all on function public.partner_name(text) from public;
grant execute on function public.partner_name(text) to anon, authenticated;

-- Current terms for the public partner page.
create or replace function public.empfehlung_konditionen() returns jsonb
language sql stable security definer set search_path = '' as $$ select to_jsonb(e) - 'id' from jarvis_intern.empfehlung_einstellungen e $$;
revoke all on function public.empfehlung_konditionen() from public;
grant execute on function public.empfehlung_konditionen() to anon, authenticated;

-- The partner's own overview behind his secret link (no login): firms only as count and month, no names.
create or replace function public.partner_uebersicht(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', coalesce(p.firma, p.name), 'code', p.code, 'status', p.status,
    'satz', coalesce(p.satz, e.satz), 'monate', e.monate,
    'kunden', (select count(*) from jarvis_intern.empfehlungen x where x.partner_id = p.id),
    'zahlende', (select count(distinct v.firma_id) from jarvis_intern.provisionen v where v.partner_id = p.id),
    'offen_cent', (select coalesce(sum(v.provision_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id and v.ausgezahlt is null),
    'bezahlt_cent', (select coalesce(sum(v.provision_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id and v.ausgezahlt is not null),
    'monatlich', (select coalesce(jsonb_agg(m order by m->>'monat' desc), '[]'::jsonb) from (
       select jsonb_build_object('monat', to_char(date_trunc('month', v.gezahlt), 'YYYY-MM'), 'zahlungen', count(*), 'provision_cent', sum(v.provision_cent),
                                 'offen_cent', coalesce(sum(v.provision_cent) filter (where v.ausgezahlt is null), 0)) m
       from jarvis_intern.provisionen v where v.partner_id = p.id group by date_trunc('month', v.gezahlt) order by date_trunc('month', v.gezahlt) desc limit 24) q))
  from jarvis_intern.empfehlungspartner p cross join jarvis_intern.empfehlung_einstellungen e
  where p.token = partner_uebersicht.token and length(partner_uebersicht.token) = 64
$$;
revoke all on function public.partner_uebersicht(text) from public;
grant execute on function public.partner_uebersicht(text) to anon, authenticated;

-- A new firm belongs to the partner whose code the creating account carried at sign-up (user data "partner").
create or replace function jarvis_intern.empfehlung_zuordnen() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c text; pid uuid;
begin
  select lower(u.raw_user_meta_data->>'partner') into c from auth.users u where u.id = auth.uid();
  if c is null or c = '' then return new; end if;
  select p.id into pid from jarvis_intern.empfehlungspartner p where p.code = c and p.status = 'aktiv';
  if pid is not null then
    insert into jarvis_intern.empfehlungen (firma_id, partner_id) values (new.id, pid) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists jarvis_empfehlung_zuordnen on public.firmen;
create trigger jarvis_empfehlung_zuordnen after insert on public.firmen for each row execute function jarvis_intern.empfehlung_zuordnen();

-- Paid Stripe invoice (webhook, worker database connection). Applied once per event; records the commission when the
-- firm belongs to an active partner and the payment lies within the first <monate> months after its first payment.
create or replace function jarvis_intern.zahlung_erfasst(ereignis text, rechnung text, kunde text, firma uuid, betrag_cent integer, gezahlt timestamptz) returns boolean
language plpgsql security definer set search_path = '' as $$
declare f uuid; fname text; pid uuid; psatz numeric; e jarvis_intern.empfehlung_einstellungen; erste timestamptz;
begin
  insert into jarvis_intern.stripe_ereignisse (id, typ, firma_id) values (ereignis, 'invoice.paid', firma) on conflict do nothing;
  if not found then return false; end if;
  select x.id, x.name into f, fname from public.firmen x
  where x.id = zahlung_erfasst.firma or (zahlung_erfasst.firma is null and kunde is not null and x.stripe_kunde = kunde) limit 1;
  if f is null or coalesce(betrag_cent, 0) <= 0 then return true; end if;
  select p.id, p.satz into pid, psatz from jarvis_intern.empfehlungen m join jarvis_intern.empfehlungspartner p on p.id = m.partner_id
  where m.firma_id = f and p.status = 'aktiv';
  if pid is null then return true; end if;
  select * into e from jarvis_intern.empfehlung_einstellungen;
  select min(v.gezahlt) into erste from jarvis_intern.provisionen v where v.firma_id = f;
  if erste is not null and gezahlt >= erste + make_interval(months => e.monate) then return true; end if;
  insert into jarvis_intern.provisionen (rechnung, partner_id, firma_id, firma_name, betrag_cent, satz, provision_cent, gezahlt)
  values (zahlung_erfasst.rechnung, pid, f, fname, betrag_cent, coalesce(psatz, e.satz), round(betrag_cent * coalesce(psatz, e.satz) / 100), gezahlt)
  on conflict on constraint provisionen_pkey do nothing;
  return true;
end $$;
revoke all on function jarvis_intern.zahlung_erfasst(text, text, text, uuid, integer, timestamptz) from public, anon, authenticated;

-- Operator: list of partners with their numbers, settings, and the actions on /konto/betreiber/partner.
create or replace function public.betreiber_partner() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt'; end if;
  return jsonb_build_object(
    'einstellungen', (select to_jsonb(e) - 'id' from jarvis_intern.empfehlung_einstellungen e),
    'partner', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'firma', p.firma, 'email', p.email, 'website', p.website, 'zielgruppe', p.zielgruppe, 'code', p.code,
      'token', p.token, 'status', p.status, 'satz', p.satz, 'erstellt', p.erstellt, 'freigeschaltet', p.freigeschaltet,
      'firmen', (select coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'paket', x.paket, 'seit', m.erstellt) order by m.erstellt desc), '[]'::jsonb)
                 from jarvis_intern.empfehlungen m join public.firmen x on x.id = m.firma_id where m.partner_id = p.id),
      'umsatz_cent', (select coalesce(sum(v.betrag_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id),
      'offen_cent', (select coalesce(sum(v.provision_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id and v.ausgezahlt is null),
      'bezahlt_cent', (select coalesce(sum(v.provision_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id and v.ausgezahlt is not null)
    ) order by (p.status = 'neu') desc, p.erstellt desc), '[]'::jsonb) from jarvis_intern.empfehlungspartner p));
end $$;
revoke all on function public.betreiber_partner() from public;
grant execute on function public.betreiber_partner() to authenticated;

create or replace function public.betreiber_partner_setzen(p uuid, aktion text, code text default null, satz numeric default null) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt'; end if;
  if aktion = 'freischalten' then
    select coalesce(nullif(jarvis_intern.partner_code(coalesce(betreiber_partner_setzen.code, '')), ''), x.code, jarvis_intern.partner_code(coalesce(x.firma, x.name)))
      into c from jarvis_intern.empfehlungspartner x where x.id = p;
    if c is null or length(c) < 3 then raise exception 'CODE_UNGUELTIG'; end if;
    if exists (select 1 from jarvis_intern.empfehlungspartner x where x.code = c and x.id <> p) then raise exception 'CODE_VERGEBEN'; end if;
    update jarvis_intern.empfehlungspartner x set status = 'aktiv', code = c, freigeschaltet = coalesce(x.freigeschaltet, now()) where x.id = p;
    return c;
  elsif aktion = 'sperren' then
    update jarvis_intern.empfehlungspartner x set status = 'gesperrt' where x.id = p;
  elsif aktion = 'satz' then
    update jarvis_intern.empfehlungspartner x set satz = betreiber_partner_setzen.satz where x.id = p;
  elsif aktion = 'ausgezahlt' then
    update jarvis_intern.provisionen v set ausgezahlt = current_date where v.partner_id = p and v.ausgezahlt is null;
  elsif aktion = 'loeschen' then
    delete from jarvis_intern.empfehlungspartner x where x.id = p and not exists (select 1 from jarvis_intern.provisionen v where v.partner_id = x.id);
  else
    raise exception 'AKTION_UNBEKANNT';
  end if;
  return null;
end $$;
revoke all on function public.betreiber_partner_setzen(uuid, text, text, numeric) from public;
grant execute on function public.betreiber_partner_setzen(uuid, text, text, numeric) to authenticated;

create or replace function public.betreiber_empfehlung_einstellen(satz numeric, monate integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_betreiber() then raise exception 'nicht erlaubt'; end if;
  update jarvis_intern.empfehlung_einstellungen e set satz = betreiber_empfehlung_einstellen.satz, monate = betreiber_empfehlung_einstellen.monate;
end $$;
revoke all on function public.betreiber_empfehlung_einstellen(numeric, integer) from public;
grant execute on function public.betreiber_empfehlung_einstellen(numeric, integer) to authenticated;

notify pgrst, 'reload schema';
