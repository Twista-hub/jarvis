-- Rechtsprüfung D2 (Art. 9, 10 DSGVO, § 53 BZRG): no copies of criminal records or health certificates. Since 03.11.
-- uploads of such files are discarded; this removes copies stored before. The file keys go to a deletion list that the
-- nightly backup run works off in R2 (.github/workflows/sicherung.yml); the rows keep name and dates (proof of sight).
-- A check keeps it that way.
create table if not exists jarvis_intern.r2_loeschen (
  schluessel text primary key check (length(schluessel) <= 300),
  grund text not null default '',
  erstellt timestamptz not null default now()
);
revoke all on jarvis_intern.r2_loeschen from public, anon, authenticated;

insert into jarvis_intern.r2_loeschen (schluessel, grund)
select 'personal_nachweise/' || firma_id || '/' || personal_id || '/' || id, 'D2: keine Kopie von Führungs-/Gesundheitszeugnis'
  from public.personal_nachweise
 where datei_name is not null and bezeichnung ~* '(f(ü|ue)hrungszeugnis|gesundheit|(ä|ae)rztlich|tauglichkeit|attest|vorsorge|bzr|strafregister)'
on conflict do nothing;
update public.personal_nachweise set datei_name = null, datei_mime = null, datei_groesse = null
 where datei_name is not null and bezeichnung ~* '(f(ü|ue)hrungszeugnis|gesundheit|(ä|ae)rztlich|tauglichkeit|attest|vorsorge|bzr|strafregister)';
alter table public.personal_nachweise drop constraint if exists personal_nachweise_ohne_kopie;
alter table public.personal_nachweise add constraint personal_nachweise_ohne_kopie
  check (datei_name is null or bezeichnung !~* '(f(ü|ue)hrungszeugnis|gesundheit|(ä|ae)rztlich|tauglichkeit|attest|vorsorge|bzr|strafregister)');
