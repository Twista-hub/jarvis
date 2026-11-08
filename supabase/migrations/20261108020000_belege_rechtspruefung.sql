-- Rechtsprüfung 03.11.2026, Steuern S10 and S20 (docs/recht/pruefung-2026-11.md); S9 (input VAT only from receipts
-- with a file, hint above 250 €) is handled in the web app and needs no schema change.
-- S10: business meals get their own category "bewirtung" (separate from travel) and need occasion and participants
--      (§ 4 Abs. 5 Nr. 2 EStG). Other categories leave both empty.
-- S20: a receipt with 19 % and 7 % (supermarket, restaurant) carries the gross amount at 7 % contained in the total;
--      VAT = 19 % from (brutto - brutto_7) plus 7 % from brutto_7. Only together with ust_satz 19.
-- Receipts are never updated (update revoked, S5), so the checks apply to new receipts; RLS stays unchanged.
alter table public.belege add column if not exists anlass text;
alter table public.belege add column if not exists teilnehmer text;
alter table public.belege add column if not exists brutto_7 numeric(12, 2);

alter table public.belege drop constraint if exists belege_kategorie_check;
alter table public.belege add constraint belege_kategorie_check check (kategorie in ('material', 'fahrzeug', 'buero', 'miete', 'versicherung', 'telefon', 'reise', 'bewirtung', 'personal', 'sonstiges'));
alter table public.belege drop constraint if exists belege_anlass_laenge;
alter table public.belege add constraint belege_anlass_laenge check (anlass is null or length(anlass) <= 300);
alter table public.belege drop constraint if exists belege_teilnehmer_laenge;
alter table public.belege add constraint belege_teilnehmer_laenge check (teilnehmer is null or length(teilnehmer) <= 500);
alter table public.belege drop constraint if exists belege_bewirtung_angaben;
alter table public.belege add constraint belege_bewirtung_angaben check (kategorie <> 'bewirtung' or (length(btrim(coalesce(anlass, ''))) > 0 and length(btrim(coalesce(teilnehmer, ''))) > 0));
alter table public.belege drop constraint if exists belege_brutto_7;
alter table public.belege add constraint belege_brutto_7 check (brutto_7 is null or (ust_satz = 19 and brutto_7 > 0 and brutto_7 <= brutto));
notify pgrst, 'reload schema';
