-- Benjamin 08.11.2026: tell the operator when money moves – new subscription, plan change, cancellation, failed payment,
-- end of a subscription, add-ons. Same channel as "new sign-up" (push to the operator's phone, jarvis_intern.betreiber_melden).
-- Changes the operator makes himself and the full preview plan "test" are not reported.
create or replace function jarvis_intern.abo_gemeldet() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  bezahlt text[] := array['basis', 'pro', 'business', 'erfolg'];
  name text := left(new.name, 60);
  plan text := initcap(new.paket) || case new.abo_zahlweise when 'jahr' then ' jährlich' when 'monat' then ' monatlich' else '' end;
  bis text := coalesce(to_char(new.abo_bis at time zone 'Europe/Berlin', 'DD.MM.YYYY'), '?');
begin
  if auth.uid() is not null and public.ist_betreiber() then return new; end if;
  if new.paket is distinct from old.paket and 'test' <> all (array[old.paket, new.paket]) then
    if new.paket = any (bezahlt) and not old.paket = any (bezahlt) then
      perform jarvis_intern.betreiber_melden('💶 Neues Abo', name || ' · ' || plan);
    elsif new.paket = any (bezahlt) then
      perform jarvis_intern.betreiber_melden('🔁 Planwechsel', name || ' · ' || initcap(old.paket) || ' → ' || plan);
    elsif old.paket = any (bezahlt) then
      perform jarvis_intern.betreiber_melden('👋 Abo beendet', name || ' · vorher ' || initcap(old.paket) || ', jetzt ' || initcap(new.paket));
    end if;
  end if;
  if new.paket <> 'test' then
    if new.abo_kuendigt and not old.abo_kuendigt then
      perform jarvis_intern.betreiber_melden('📉 Abo gekündigt', name || ' · ' || plan || ', läuft bis ' || bis);
    elsif old.abo_kuendigt and not new.abo_kuendigt and new.abo_status in ('active', 'trialing', 'past_due') then
      perform jarvis_intern.betreiber_melden('↩️ Kündigung zurückgenommen', name || ' · ' || plan);
    end if;
    if new.abo_status = 'past_due' and old.abo_status is distinct from 'past_due' then
      perform jarvis_intern.betreiber_melden('⚠️ Zahlung fehlgeschlagen', name || ' · ' || plan || '. Stripe versucht es erneut.');
    end if;
    if new.steckbrief_guthaben > old.steckbrief_guthaben then
      perform jarvis_intern.betreiber_melden('📄 Steckbrief-Paket gekauft', name || ' · +' || (new.steckbrief_guthaben - old.steckbrief_guthaben) || ' Steckbriefe');
    end if;
    if new.zusatz_einsatzkraefte is distinct from old.zusatz_einsatzkraefte then
      perform jarvis_intern.betreiber_melden('👷 Weitere Einsatzkräfte', name || ' · ' || old.zusatz_einsatzkraefte || ' → ' || new.zusatz_einsatzkraefte);
    end if;
  end if;
  return new;
end $$;
revoke all on function jarvis_intern.abo_gemeldet() from public, anon, authenticated;
drop trigger if exists firmen_abo_gemeldet on public.firmen;
create trigger firmen_abo_gemeldet after update of paket, abo_status, abo_kuendigt, steckbrief_guthaben, zusatz_einsatzkraefte on public.firmen
  for each row execute function jarvis_intern.abo_gemeldet();
