export const FUNKTIONEN = ["Geschäftsführung", "Regionalleitung", "Standortleitung", "Abteilungsleiter/in", "Serviceleiter/in", "Teamleitung", "Disposition", "Kalkulation", "Facharbeiter/in", "Servicekraft", "Verwaltung", "Mitarbeiter/in"];

export const ZUGRIFFE: Record<string, string> = {
  inhaber: "Inhaber (alle Rechte)", admin: "Administration (alle Informationen)",
  bearbeiter: "Vollständige Steckbriefe bearbeiten", leser: "Vollständige Steckbriefe lesen",
  mitarbeiter: "Nur persönlich freigegebene Informationen",
};

export function darfFinanzen(rolle: string, finanzen = false): boolean {
  return ["inhaber", "admin"].includes(rolle) || (["bearbeiter", "leser"].includes(rolle) && finanzen === true);
}
