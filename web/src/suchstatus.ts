import { escape } from "./seite.ts";

export interface Suchstand {
  erstlauf?: string | null;
  fertig?: string | null;
  ergebnis?: { neu?: number; treffer?: number; ungeprueft?: number; kandidaten?: number; bewertet?: number; ausstehend?: number; katalog_geprueft?: number; importtage_offen?: number | null } | null;
  fehler?: boolean | null;
  zwischenstand?: { zeit?: string; treffer?: number; bewertet?: number; kandidaten?: number } | null;
}

// A full run over the whole catalog takes well over 20 minutes; only after an hour is it considered stuck.
const LAUFZEIT = 60 * 60_000;

/** Progress written by the running alarm; ignored when it belongs to an earlier run. */
export function zwischenstand(p: Suchstand): { treffer: number; bewertet: number; kandidaten: number } | null {
  const z = p.zwischenstand;
  if (!z || !(Date.parse(z.zeit || "") >= Date.parse(p.erstlauf || ""))) return null;
  const n = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
  return { treffer: n(z.treffer), bewertet: n(z.bewertet), kandidaten: n(z.kandidaten) };
}

export function sucheLaeuft(p: Suchstand, jetzt = Date.now()): boolean {
  const start = Date.parse(p.erstlauf || "");
  const fertig = Date.parse(p.fertig || "") || 0;
  return Number.isFinite(start) && start <= jetzt && jetzt - start < LAUFZEIT && fertig < start;
}

export function suchmeldung(p: Suchstand, firma: string, jetzt = Date.now()): string {
  if (sucheLaeuft(p, jetzt)) {
    const z = zwischenstand(p);
    const stand = z
      ? `Bisher ${z.treffer} passende ${z.treffer === 1 ? "Ausschreibung" : "Ausschreibungen"} gefunden${z.kandidaten ? `, ${z.bewertet} von ${z.kandidaten} möglichen geprüft` : ""}. Neue Treffer erscheinen unten, während Crewtender weitersucht.`
      : "Crewtender sammelt die passenden Ausschreibungen. Die ersten Treffer erscheinen unten, sobald sie bewertet sind.";
    return `<p class="laedt" role="status" data-suchlauf="${escape(firma)}" data-treffer="${z ? z.treffer : 0}"><span class="kreisel" aria-hidden="true"></span><span><strong>Crewtender sucht passende Ausschreibungen.</strong><br><span class="klein">${escape(stand)}</span></span></p>`;
  }
  const start = Date.parse(p.erstlauf || "") || 0;
  const fertig = Date.parse(p.fertig || "") || 0;
  if (start > fertig) return `<p role="status">Die Suche dauert länger als erwartet. Du kannst sie im Suchprofil erneut starten.</p>`;
  if (!fertig) return "";
  if (p.fehler) return `<p class="fehler" role="status">Die letzte Suche konnte nicht abgeschlossen werden. Deine bisherigen Treffer bleiben erhalten. Bitte starte die Suche erneut.</p>`;
  const datum = new Date(fertig).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" });
  const anzahl = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  const ergebnis = p.ergebnis;
  const quelleUnklar = ergebnis?.kandidaten !== undefined && ergebnis.importtage_offen == null;
  const unvollstaendig = ergebnis && (quelleUnklar || anzahl(ergebnis.ausstehend) > 0 || anzahl(ergebnis.importtage_offen) > 0);
  // One short line; the numbers behind it fold out.
  const kurz = `${unvollstaendig ? "Zwischenstand der Suche" : "✓ Letzte Suche abgeschlossen"}: ${escape(datum)} Uhr${ergebnis ? ` · ${anzahl(ergebnis.treffer)} Treffer${anzahl(ergebnis.neu) ? `, ${anzahl(ergebnis.neu)} neu` : ""}` : ""}`;
  const mehr = `${ergebnis ? `${anzahl(ergebnis.neu)} neu hinzugekommen · ${anzahl(ergebnis.treffer)} passende Treffer gefunden.${ergebnis.kandidaten !== undefined ? `<br>${anzahl(ergebnis.katalog_geprueft)} bekannte Ausschreibungen durchsucht; ${anzahl(ergebnis.bewertet)} von ${anzahl(ergebnis.kandidaten)} möglichen Treffern bewertet.` : ""}${anzahl(ergebnis.ausstehend) ? `<br>${anzahl(ergebnis.ausstehend)} Bewertungen stehen noch aus. Die nächsten Suchläufe setzen dort fort.` : ""}${anzahl(ergebnis.importtage_offen) ? `<br>Für ${anzahl(ergebnis.importtage_offen)} Tage werden Quelldaten noch nachgeholt. Es können weitere Treffer hinzukommen.` : ""}${quelleUnklar ? `<br>Der vollständige Quellenstand ist derzeit nicht bestätigt. Es können weitere Treffer hinzukommen.` : ""}${anzahl(ergebnis.ungeprueft) ? `<br>${anzahl(ergebnis.ungeprueft)} angezeigte Treffer bisher nur anhand der Suchbegriffe geprüft.` : ""}` : ""}`;
  return mehr ? `<details class="suchstand" role="status"><summary>${kurz}</summary><p class="klein">${mehr}</p></details>` : `<p class="klein suchstand" role="status">${kurz}</p>`;
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
      var d = r.ok ? await r.json() : null;
      // Reload when the run is done or when it has put new hits into the list.
      if (d && (d.laeuft === false || (d.treffer || 0) > Number(hinweis.dataset.treffer || 0))) { window.location.reload(); return; }
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
