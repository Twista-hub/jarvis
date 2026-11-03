-- Rechtsprüfung 03.11.2026, Arbeitsrecht A3: Equal Pay after 9 months only applies with a collective agreement for
-- temporary agency work (§ 8 Abs. 4 AÜG); without one it applies from day 1. null = not stated (shown as a hint).
alter table public.firmenprofil add column if not exists zeitarbeit_tarif boolean;
notify pgrst, 'reload schema';
