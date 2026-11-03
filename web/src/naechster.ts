// "Nächster Schritt" on the tender page: one box at the top that says what to do now, depending on the state, the
// uploaded documents and the offer approval, with the button for it. The long page below stays as reference.
import { escape } from "./seite.ts";

export type SchrittDaten = {
  id: string; status: string; frist: string | null;
  mitUnterlagen: boolean;            // Steckbrief from the tender documents exists
  laeuft: boolean;                   // documents are being read right now
  mappe: "keine" | "wartet" | "genehmigt" | "abgelehnt";
  finanzen: boolean; darfAendern: boolean; admin: boolean;
  kalkulation: string; portal: string | null; heute: string;
};

const datumDe = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });

/** Status buttons post to /konto/status and come back to this page. */
function stand(id: string, status: string, text: string, zweit = false): string {
  return `<form method="post" action="/konto/status"><input type="hidden" name="id" value="${id}"><input type="hidden" name="weiter" value="/konto/vorgang/${id}"><button name="status" value="${status}"${zweit ? ' class="zweit"' : ""}>${text}</button></form>`;
}
const knopf = (href: string, text: string, zweit = false) => `<a class="knopf${zweit ? " zweit" : ""}" href="${escape(href)}">${text}</a>`;

export function naechsterSchritt(d: SchrittDaten): string {
  const abgelaufen = Boolean(d.frist && d.frist.slice(0, 10) < d.heute);
  const bis = d.frist ? ` bis ${datumDe(d.frist)}` : "";
  let titel = "", text = "", aktionen: string[] = [];
  if (["verloren", "verworfen"].includes(d.status)) return "";
  if (abgelaufen && ["neu", "pruefen"].includes(d.status)) {
    titel = "Frist abgelaufen";
    text = "Für diese Ausschreibung kann kein Angebot mehr abgegeben werden.";
    aktionen = d.darfAendern ? [stand(d.id, "verworfen", "🗂️ Ins Archiv")] : [];
  } else if (d.status === "neu") {
    titel = "Passt das zu euch?";
    text = "Lies den Steckbrief unten und entscheide. „Prüfen“ legt die Ausschreibung unter „In Arbeit“ ab.";
    aktionen = d.darfAendern ? [stand(d.id, "pruefen", "✅ Passt, prüfen"), stand(d.id, "verworfen", "✕ Passt nicht", true)] : [knopf("#steckbrief", "📋 Zum Steckbrief")];
  } else if (d.laeuft) {
    titel = "Crewtender liest die Unterlagen";
    text = "Steckbrief und Kalkulation sind in 2 bis 5 Minuten fertig. Die Seite aktualisiert sich von selbst.";
  } else if (d.status === "pruefen" && !d.mitUnterlagen) {
    titel = "Vergabeunterlagen hochladen";
    text = "Erst mit den Unterlagen kennt Crewtender Lose, Mengen, Nachweise und das Preisblatt.";
    aktionen = [knopf("#unterlagen", "📥 Unterlagen hochladen"), ...(d.portal ? [knopf(d.portal, "🌐 Zum Vergabeportal", true)] : [])];
  } else if (d.status === "pruefen") {
    titel = d.finanzen ? "Preis kalkulieren und entscheiden" : "Entscheiden: bieten oder nicht?";
    text = "Der Steckbrief aus den Unterlagen steht unten. Wenn ihr bietet, setzt den Stand auf „Angebot in Arbeit“.";
    aktionen = [...(d.finanzen ? [knopf(d.kalkulation, "💶 Kalkulation")] : []), ...(d.darfAendern ? [stand(d.id, "angebot", "📝 Wir bieten", !d.finanzen ? false : true)] : [])];
  } else if (d.status === "angebot") {
    if (d.mappe === "keine" || d.mappe === "abgelehnt") {
      titel = d.mappe === "abgelehnt" ? "Angebot überarbeiten" : "Angebot vorbereiten";
      text = d.mappe === "abgelehnt" ? "Die Firmenleitung hat das Angebot zurückgegeben. Die Anmerkung steht beim Angebot." : `Crewtender stellt Angebotstext und Unterlagen zusammen. Abgabe${bis}.`;
      aktionen = d.finanzen ? [knopf(`/konto/vorgang/${d.id}/angebot`, "📝 Angebot vorbereiten"), knopf(d.kalkulation, "💶 Kalkulation", true)] : [];
    } else if (d.mappe === "wartet") {
      titel = "Angebot wartet auf Freigabe";
      text = d.admin ? "Bitte prüfen und freigeben oder mit Anmerkung zurückgeben." : "Die Firmenleitung muss das Angebot noch freigeben.";
      aktionen = d.admin ? [knopf("/konto/angebotsfreigaben", "✅ Zur Freigabe")] : [];
    } else {
      titel = "Angebot abgeben";
      text = `Das Angebot ist freigegeben. Im Vergabeportal hochladen${bis} und danach hier als abgegeben markieren.`;
      aktionen = [...(d.portal ? [knopf(d.portal, "🌐 Zum Vergabeportal")] : []), ...(d.darfAendern ? [stand(d.id, "abgegeben", "📤 Abgegeben", Boolean(d.portal))] : [])];
    }
  } else if (d.status === "abgegeben") {
    titel = "Auf den Zuschlag warten";
    text = "Sobald der Auftraggeber entschieden hat, das Ergebnis eintragen. Gewonnene Aufträge erscheinen unter „Laufende Aufträge“.";
    aktionen = d.darfAendern ? [stand(d.id, "gewonnen", "🏆 Zuschlag"), stand(d.id, "verloren", "❌ Absage", true)] : [];
  } else if (d.status === "gewonnen") {
    titel = "Auftrag gewonnen";
    text = "Laufzeit, Personal und Verlängerungsfrist pflegt ihr unter „Laufende Aufträge“.";
    aktionen = [knopf(`/konto/auftraege?offen=${d.id}`, "🏗️ Laufender Auftrag")];
  } else return "";
  return `<section class="naechster-schritt" aria-label="Nächster Schritt"><p class="klein">👉 Nächster Schritt</p><h2>${escape(titel)}</h2><p>${escape(text)}</p>${aktionen.length ? `<div class="aktionsleiste">${aktionen.join("")}</div>` : ""}</section>`;
}
