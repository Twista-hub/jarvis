export const FUNKTIONEN = ["Geschäftsführung", "Regionalleitung", "Standortleitung", "Abteilungsleiter/in", "Serviceleiter/in", "Teamleitung", "Schichtleitung", "Disposition", "Disponent/in", "Personaldisposition", "Sachbearbeiter/in", "Objektleitung", "Projektleitung", "Kalkulation", "Lohnbuchhaltung", "Recruiting", "Kundenbetreuung", "Qualitätsmanagement", "Arbeitsschutz", "Facharbeiter/in", "Elektriker/in", "Mechatroniker/in", "Schweißer/in", "Staplerfahrer/in", "Berufskraftfahrer/in", "Koch/Köchin", "Servicekraft", "Pflegefachkraft", "Reinigungskraft", "Verwaltung", "Mitarbeiter/in"];

export const ZUGRIFFE: Record<string, string> = {
  inhaber: "Inhaber (alle Rechte)", admin: "Administration (alle Informationen)",
  bearbeiter: "Vollständige Steckbriefe bearbeiten", standortleitung: "Standortleitung (Personal & Einsätze am eigenen Standort)", leser: "Vollständige Steckbriefe lesen",
  mitarbeiter: "Nur persönlich freigegebene Informationen",
};

export function darfFinanzen(rolle: string, finanzen = false): boolean {
  return ["inhaber", "admin"].includes(rolle) || (["bearbeiter", "leser"].includes(rolle) && finanzen === true);
}
