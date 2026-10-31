import { escape } from "./seite.ts";

export interface Suchstand {
  erstlauf?: string | null;
  fertig?: string | null;
  ergebnis?: { neu?: number; treffer?: number; ungeprueft?: number } | null;
  fehler?: boolean | null;
}

export function sucheLaeuft(p: Suchstand, jetzt = Date.now()): boolean {
  const start = Date.parse(p.erstlauf || "");
  const fertig = Date.parse(p.fertig || "") || 0;
  return Number.isFinite(start) && start <= jetzt && jetzt - start < 20 * 60_000 && fertig < start;
}

export function suchmeldung(p: Suchstand, firma: string, jetzt = Date.now()): string {
  if (sucheLaeuft(p, jetzt)) return `<p class="laedt" role="status" data-suchlauf="${escape(firma)}"><span class="kreisel" aria-hidden="true"></span><span><strong>Jarvis sucht passende Ausschreibungen.</strong><br><span class="klein">Vorhandene Treffer bleiben bis zum Abschluss sichtbar. Das Ergebnis erscheint hier automatisch.</span></span></p>`;
  const start = Date.parse(p.erstlauf || "") || 0;
  const fertig = Date.parse(p.fertig || "") || 0;
  if (start > fertig) return `<p role="status">Die Suche dauert länger als erwartet. Du kannst sie im Suchprofil erneut starten.</p>`;
  if (!fertig) return "";
  if (p.fehler) return `<p class="fehler" role="status">Die letzte Suche konnte nicht abgeschlossen werden. Deine bisherigen Treffer bleiben erhalten. Bitte starte die Suche erneut.</p>`;
  const datum = new Date(fertig).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
  const anzahl = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  const ergebnis = p.ergebnis;
  return `<p class="klein" role="status"><strong>Letzte Suche abgeschlossen: ${escape(datum)} Uhr.</strong>${ergebnis ? `<br>${anzahl(ergebnis.neu)} neu hinzugekommen · ${anzahl(ergebnis.treffer)} passende Treffer gefunden.${anzahl(ergebnis.ungeprueft) ? `<br>${anzahl(ergebnis.ungeprueft)} davon bisher nur anhand der Suchbegriffe geprüft.` : ""}` : ""}</p>`;
}

export const SUCHSTATUS_JS = `
document.querySelectorAll("[data-suchlauf]").forEach(function (hinweis) {
  var timer;
  var aktiv = false;
  async function pruefen() {
    if (aktiv || document.visibilityState === "hidden") return;
    aktiv = true;
    try {
      var r = await fetch("/konto/suchstatus?firma=" + encodeURIComponent(hinweis.dataset.suchlauf), { cache: "no-store" });
      if (r.ok && (await r.json()).laeuft === false) { window.location.reload(); return; }
    } catch (_) { /* The meta refresh remains available if polling fails. */ }
    finally { aktiv = false; }
    window.clearTimeout(timer);
    timer = window.setTimeout(pruefen, 15000);
  }
  timer = window.setTimeout(pruefen, 15000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState !== "hidden") pruefen(); });
  window.addEventListener("pageshow", function (event) { if (event.persisted) pruefen(); });
});
`;
