-- Rechtsprüfung 03.11.2026 (docs/recht/pruefung-2026-11.md L1): country of the firm. Staff planning, time recording,
-- payroll, invoices and VAT follow German law and are only offered for firms in Germany (web/src/laenderfunktionen.ts).
-- Existing firms: Germany if they set up Jarvis in German, the country of the app language for FR/PL/ES/IT; English
-- (US, UK, NL …) stays open and is chosen in the firm profile.
alter table public.firmenprofil add column if not exists land text check (land is null or land ~ '^[A-Z]{2}$');
insert into public.firmenprofil (firma_id, land)
select distinct on (f.id) f.id, case coalesce(s.einstellungen->>'sprache', 'de') when 'de' then 'DE' when 'fr' then 'FR' when 'pl' then 'PL' when 'es' then 'ES' when 'it' then 'IT' end
  from public.firmen f
  left join public.suchprofile s on s.firma_id = f.id and s.bereich_id is null
on conflict (firma_id) do update set land = coalesce(public.firmenprofil.land, excluded.land);
notify pgrst, 'reload schema';
