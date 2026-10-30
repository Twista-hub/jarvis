import { db, sitzung, weiterleiten, type Bereich, type KontoEnv } from "./konto.ts";
import { escape } from "./seite.ts";
import { FUNKTIONEN, ZUGRIFFE } from "./rechte.ts";
import { bereichPfad } from "./bereiche.ts";

export type Person = { user_id: string; rolle: string; anzeigename?: string; funktion?: string; finanzen?: boolean; alle_bereiche?: boolean };
export const funktionsListe = `<datalist id="funktionen">${FUNKTIONEN.map((f) => `<option value="${escape(f)}">`).join("")}</datalist>`;

export function personFormular(person: Person, firma: string, bereiche: Bereich[], zugeordnet: string[], inhaber: boolean): string {
  if (person.rolle === "inhaber" && !inhaber) return "";
  const standorte = bereiche.filter((b) => b.art === "standort" && !bereiche.some((x) => x.parent_id === b.id && x.art === "standort"));
  const leitung = person.rolle === "standortleitung";
  return `<details><summary>Funktion & Rechte ändern</summary><form method="post" action="/konto/mitarbeiter">
    <input type="hidden" name="firma" value="${firma}"><input type="hidden" name="person" value="${person.user_id}">
    <label>Name<input name="name" maxlength="200" value="${escape(person.anzeigename ?? "")}"></label>
    <label>Funktion im Betrieb<input name="funktion" list="funktionen" required maxlength="100" value="${escape(person.funktion ?? "Mitarbeiter/in")}"></label>
    <label>Zugriff<select name="rolle" data-rolle>${Object.entries(ZUGRIFFE).filter(([r]) => r !== "inhaber" || inhaber).map(([r, label]) => `<option value="${r}"${person.rolle === r ? " selected" : ""}>${escape(label)}</option>`).join("")}</select></label>
    <p class="klein">„Nur persönlich freigegebene Informationen“ zeigt ausschließlich die ausgewählten Texte. Vollständige Steckbriefe können bereits Preisangaben enthalten. Standortleitung gilt nur für zugeordnete Standorte, kann dort Personal und Einsätze pflegen und hat keinen Zugriff auf Kalkulation oder Firmenunterlagen.</p>
    <label class="zeile"><input type="checkbox" name="finanzen"${person.finanzen ? " checked" : ""}>Kalkulation, Firmenunterlagen und Angebotsmappen freigeben</label>
    <p class="klein">Finanzfreigabe gilt nur beim Zugriff auf vollständige Steckbriefe. Inhaber und Administration sehen immer alle Informationen.</p>
    <fieldset data-bereiche-mehrfach${leitung ? " hidden" : ""}><legend>Bereiche für vollständige Steckbriefe</legend><label class="zeile"><input type="checkbox" name="alle"${person.alle_bereiche ? " checked" : ""}>Alle Bereiche</label>${bereiche.map((b) => `<label class="zeile"><input type="checkbox" name="bereiche" value="${b.id}"${zugeordnet.includes(b.id) ? " checked" : ""}>${escape(bereichPfad(bereiche, b))}</label>`).join("")}</fieldset>
    <fieldset data-bereich-einzel${leitung ? "" : " hidden"}><legend>Standort der Leitung</legend><p class="klein">Wähle genau einen Standort aus. Dann kann diese Person dort Personal und Einsätze verwalten. Regionen werden nicht angeboten.</p>${standorte.length ? standorte.map((b) => `<label class="zeile"><input type="radio" name="bereiche" value="${b.id}"${zugeordnet.includes(b.id) ? " checked" : ""}${leitung ? " required" : " disabled"}>${escape(bereichPfad(bereiche, b))}</label>`).join("") : `<p>Lege zuerst einen Standort an.</p>`}</fieldset>
    <button>Rechte speichern</button></form></details>`;
}

export async function mitarbeiterVerwalten(request: Request, env: KontoEnv): Promise<Response | null> {
  if (new URL(request.url).pathname !== "/konto/mitarbeiter" || request.method !== "POST") return null;
  const s = await sitzung(request, env);
  if (!s) return weiterleiten("/konto");
  const f = await request.formData();
  const firma = String(f.get("firma") ?? "");
  const person = String(f.get("person") ?? "");
  const rolle = String(f.get("rolle") ?? "");
  const bereiche = f.getAll("bereiche").map(String);
  if (![firma, person, ...bereiche].every((id) => /^[0-9a-f-]{36}$/.test(id)) || !Object.hasOwn(ZUGRIFFE, rolle)) return weiterleiten("/konto/team?hinweis=Ungültige%20Auswahl.");
  if (rolle === "standortleitung" && (f.has("alle") || bereiche.length !== 1)) return weiterleiten(`/konto/team?firma=${firma}&hinweis=${encodeURIComponent("Standortleitung braucht genau einen zugeordneten Standort.")}`);
  const r = await db(s, env, "rpc/mitglied_aktualisieren", { method: "POST", body: JSON.stringify({ f: firma, u: person, n: String(f.get("name") ?? "").trim().slice(0, 200), funktion_neu: String(f.get("funktion") ?? "Mitarbeiter/in").trim().slice(0, 100) || "Mitarbeiter/in", rolle_neu: rolle, finanzen_neu: f.has("finanzen"), alle: f.has("alle"), bereiche }) });
  return weiterleiten(`/konto/team?firma=${firma}&hinweis=${encodeURIComponent(r.ok ? "Funktion und Rechte gespeichert." : "Die Rechte konnten nicht geändert werden. Nur Administratoren dürfen das; der letzte Inhaber muss erhalten bleiben.")}`, s.cookies);
}
