-- Referral programme (09.11.2026): refunded or charged-back payments cancel their commission, as the partner terms say
-- ("Für erstattete oder zurückgebuchte Zahlungen entfällt die Provision; bereits ausgezahlte Beträge werden verrechnet").
-- Stripe sends charge.refunded (cumulative amount_refunded per charge) and charge.dispute.funds_withdrawn; each event
-- books the refunded part not booked before for that charge. The commission row is found by the invoice id when Stripe
-- sends it, otherwise by the firm (Stripe customer) and the commission row paid closest to the charge (within 3 days).
-- A cancellation that is not yet settled lowers the open amount; once the operator marks a payout, it is settled too
-- (so an already paid commission is offset against the next payout).

create table if not exists jarvis_intern.provision_storno (
  ereignis text primary key check (length(ereignis) between 5 and 120),
  zahlung text not null check (zahlung ~ '^(ch|py)_[A-Za-z0-9]{6,80}$'),
  rechnung text not null references jarvis_intern.provisionen(rechnung) on delete cascade,
  partner_id uuid not null references jarvis_intern.empfehlungspartner(id) on delete cascade,
  betrag_cent integer not null check (betrag_cent > 0),
  provision_cent integer not null check (provision_cent >= 0),
  zeit timestamptz not null default now(),
  ausgezahlt date
);
create index if not exists provision_storno_partner on jarvis_intern.provision_storno (partner_id, ausgezahlt);
create index if not exists provision_storno_zahlung on jarvis_intern.provision_storno (zahlung);
revoke all on jarvis_intern.provision_storno from public, anon, authenticated;

-- One refund or chargeback event. erstattet_cent = everything refunded on this charge so far (Stripe's amount_refunded).
create or replace function jarvis_intern.erstattung_erfasst(ereignis text, zahlung text, rechnung text, kunde text, erstattet_cent integer, zahlung_zeit timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v jarvis_intern.provisionen; schon integer; neu integer; schon_prov integer; prov integer;
begin
  insert into jarvis_intern.stripe_ereignisse (id, typ, firma_id) values (ereignis, 'erstattung', null) on conflict do nothing;
  if not found then return false; end if;
  if coalesce(erstattet_cent, 0) <= 0 or zahlung !~ '^(ch|py)_[A-Za-z0-9]{6,80}$' then return true; end if;
  if rechnung is not null then
    select * into v from jarvis_intern.provisionen x where x.rechnung = erstattung_erfasst.rechnung;
  end if;
  if v.rechnung is null and kunde is not null and zahlung_zeit is not null then
    select x.* into v from jarvis_intern.provisionen x join public.firmen f on f.id = x.firma_id
    where f.stripe_kunde = kunde and x.gezahlt between zahlung_zeit - interval '3 days' and zahlung_zeit + interval '3 days'
    order by abs(extract(epoch from x.gezahlt - zahlung_zeit)) limit 1;
  end if;
  if v.rechnung is null then return true; end if;  -- payment without commission
  select coalesce(sum(s.betrag_cent), 0), coalesce(sum(s.provision_cent), 0) into schon, schon_prov
  from jarvis_intern.provision_storno s where s.zahlung = erstattung_erfasst.zahlung;
  neu := least(erstattet_cent, v.betrag_cent) - schon;
  if neu <= 0 then return true; end if;
  -- Never more than the commission of this payment in total.
  prov := least(round(neu * v.satz / 100)::int, v.provision_cent - schon_prov);
  insert into jarvis_intern.provision_storno (ereignis, zahlung, rechnung, partner_id, betrag_cent, provision_cent)
  values (erstattung_erfasst.ereignis, erstattung_erfasst.zahlung, v.rechnung, v.partner_id, neu, greatest(prov, 0));
  return true;
end $$;
revoke all on function jarvis_intern.erstattung_erfasst(text, text, text, text, integer, timestamptz) from public, anon, authenticated;

-- Partner overview: open and paid amounts net of cancellations; cancelled total shown separately.
create or replace function public.partner_uebersicht(token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', coalesce(p.firma, p.name), 'code', p.code, 'status', p.status,
    'satz', coalesce(p.satz, e.satz), 'monate', e.monate,
    'kunden', (select count(*) from jarvis_intern.empfehlungen x where x.partner_id = p.id),
    'zahlende', (select count(distinct v.firma_id) from jarvis_intern.provisionen v where v.partner_id = p.id),
    'offen_cent', (select coalesce(sum(v.provision_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id and v.ausgezahlt is null)
                - (select coalesce(sum(s.provision_cent), 0) from jarvis_intern.provision_storno s where s.partner_id = p.id and s.ausgezahlt is null),
    'bezahlt_cent', (select coalesce(sum(v.provision_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id and v.ausgezahlt is not null)
                  - (select coalesce(sum(s.provision_cent), 0) from jarvis_intern.provision_storno s where s.partner_id = p.id and s.ausgezahlt is not null),
    'storniert_cent', (select coalesce(sum(s.provision_cent), 0) from jarvis_intern.provision_storno s where s.partner_id = p.id),
    'monatlich', (select coalesce(jsonb_agg(m order by m->>'monat' desc), '[]'::jsonb) from (
       select jsonb_build_object('monat', to_char(date_trunc('month', v.gezahlt), 'YYYY-MM'), 'zahlungen', count(*), 'provision_cent', sum(v.provision_cent),
                                 'offen_cent', coalesce(sum(v.provision_cent) filter (where v.ausgezahlt is null), 0)) m
       from jarvis_intern.provisionen v where v.partner_id = p.id group by date_trunc('month', v.gezahlt) order by date_trunc('month', v.gezahlt) desc limit 24) q))
  from jarvis_intern.empfehlungspartner p cross join jarvis_intern.empfehlung_einstellungen e
  where p.token = partner_uebersicht.token and length(partner_uebersicht.token) = 64
$$;
revoke all on function public.partner_uebersicht(text) from public;
grant execute on function public.partner_uebersicht(text) to anon, authenticated;

-- Operator list: same netting.
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
      'umsatz_cent', (select coalesce(sum(v.betrag_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id)
                   - (select coalesce(sum(s.betrag_cent), 0) from jarvis_intern.provision_storno s where s.partner_id = p.id),
      'offen_cent', (select coalesce(sum(v.provision_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id and v.ausgezahlt is null)
                  - (select coalesce(sum(s.provision_cent), 0) from jarvis_intern.provision_storno s where s.partner_id = p.id and s.ausgezahlt is null),
      'bezahlt_cent', (select coalesce(sum(v.provision_cent), 0) from jarvis_intern.provisionen v where v.partner_id = p.id and v.ausgezahlt is not null)
                    - (select coalesce(sum(s.provision_cent), 0) from jarvis_intern.provision_storno s where s.partner_id = p.id and s.ausgezahlt is not null),
      'storniert_cent', (select coalesce(sum(s.provision_cent), 0) from jarvis_intern.provision_storno s where s.partner_id = p.id)
    ) order by (p.status = 'neu') desc, p.erstellt desc), '[]'::jsonb) from jarvis_intern.empfehlungspartner p));
end $$;
revoke all on function public.betreiber_partner() from public;
grant execute on function public.betreiber_partner() to authenticated;

-- Payout also settles the open cancellations (they were deducted from this payout).
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
    update jarvis_intern.provision_storno s set ausgezahlt = current_date where s.partner_id = p and s.ausgezahlt is null;
  elsif aktion = 'loeschen' then
    delete from jarvis_intern.empfehlungspartner x where x.id = p and not exists (select 1 from jarvis_intern.provisionen v where v.partner_id = x.id);
  else
    raise exception 'AKTION_UNBEKANNT';
  end if;
  return null;
end $$;
revoke all on function public.betreiber_partner_setzen(uuid, text, text, numeric) from public;
grant execute on function public.betreiber_partner_setzen(uuid, text, text, numeric) to authenticated;

notify pgrst, 'reload schema';
