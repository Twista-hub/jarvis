import test from "node:test";
import assert from "node:assert/strict";
import { ampelChip, klein, pruefen, usKasten, type UsDaten, type UsProfil } from "../src/ampel.ts";
import { usProfilAusFormular, usProfilFormular } from "../src/usprofil.ts";

const jetzt = new Date("2026-11-02T12:00:00Z");
const profil = (x: Partial<UsProfil> = {}): UsProfil => ({ uei: "ABCDEF123456", cage: "1A2B3", sam_gueltig_bis: "2027-06-30", naics: ["561720"], klein_naics: ["561720"], zertifikate: [], umsatz_durchschnitt: null, mitarbeiter: null, ...x });
const us = (x: Partial<UsDaten> = {}): UsDaten => ({ notice_id: "abc", naics: "561720", set_aside: "SBA", set_aside_text: "Total Small Business Set-Aside (FAR 19.5)", frist: "2026-11-20T14:00:00-05:00", ...x });

test("Ampel: grün, wenn Registrierung, NAICS und Kleinunternehmen passen", () => {
  const r = pruefen(us(), profil(), jetzt);
  assert.equal(r.farbe, "gruen");
  assert.ok(r.gruende.every((g) => g.farbe === "gruen"));
});

test("Ampel: rot bei fehlender Zertifizierung, abgelaufener Registrierung, vorbei, zu groß", () => {
  assert.equal(pruefen(us({ set_aside: "WOSB" }), profil(), jetzt).farbe, "rot");
  assert.equal(pruefen(us({ set_aside: "WOSB" }), profil({ zertifikate: ["edwosb"] }), jetzt).farbe, "gruen", "EDWOSB darf auch WOSB");
  assert.equal(pruefen(us(), profil({ sam_gueltig_bis: "2026-10-01" }), jetzt).farbe, "rot");
  assert.match(pruefen(us(), profil({ sam_gueltig_bis: "2026-11-10" }), jetzt).gruende.map((g) => g.de).join(), /läuft vor der Abgabefrist ab/);
  assert.equal(pruefen(us({ frist: "2026-11-01T14:00:00-05:00" }), profil(), jetzt).farbe, "rot");
  assert.equal(pruefen(us(), profil({ klein_naics: [], umsatz_durchschnitt: 30_000_000 }), jetzt).farbe, "rot", "Reinigung: Grenze 22 Mio. $");
  assert.equal(klein("561720", profil({ klein_naics: [], umsatz_durchschnitt: 5_000_000 })), true);
});

test("Ampel: gelb ohne Profil, fehlendes NAICS, unbekannte Größe; offen für alle ohne Set-aside", () => {
  assert.equal(pruefen(us(), null, jetzt).farbe, "gelb");
  assert.equal(pruefen(us({ naics: "238210", set_aside: "" }), profil(), jetzt).farbe, "gelb", "NAICS fehlt im Profil");
  const offen = pruefen(us({ set_aside: "" }), profil(), jetzt);
  assert.equal(offen.farbe, "gruen");
  assert.match(offen.gruende.map((g) => g.en).join(), /full and open/);
  assert.equal(pruefen(us({ naics: "999999" }), profil({ klein_naics: [] }), jetzt).farbe, "gelb");
});

test("US-Kasten: Fristen-Tracker mit Zeitzone, Amendments, Kontakt, zweisprachig", () => {
  const html = usKasten({ id: "v1", link: null }, us({ solicitation: "36C25726Q0042", aenderungen: [{ feld: "frist", alt: "2026-11-18T14:00:00-05:00", neu: "2026-11-20T14:00:00-05:00", gesehen: "2026-11-02" }], kontakt: { name: "Jane Doe", email: "jane.doe@va.gov" } }), profil(), "en", true);
  assert.match(html, /May I bid\?/);
  assert.match(html, /Nov 20, 2026, 2:00 PM EST/);
  assert.match(html, /1 change\(s\) since first seen/);
  assert.match(html, /SF 30/);
  assert.match(html, /mailto:jane\.doe@va\.gov/);
  assert.match(html, /sam\.gov\/opp\/abc\/view/);
  assert.match(html, /36C25726Q0042/);
  const de = usKasten({ id: "v1", link: null, fragefrist: "2026-11-10T12:00:00-05:00" }, us(), null, "de", false);
  assert.match(de, /Darf ich bieten\?/);
  assert.match(de, /Frist für Rückfragen/);
  assert.doesNotMatch(de, /us-profil/, "ohne Recht kein Link zum Profil");
  assert.match(ampelChip(us(), profil(), "en"), /us-ampel gruen[^>]*>🟢 Total Small Business/);
});

test("US-Bieterprofil: Formular prüfen und anzeigen", () => {
  const f = new FormData();
  f.set("uei", "abcdef123456"); f.set("cage", "1a2b3"); f.set("sam_gueltig_bis", "2027-01-31"); f.set("naics", "561720, 561730 12345"); f.append("klein_naics", "561720"); f.append("klein_naics", "238210");
  f.append("zertifikate", "wosb"); f.append("zertifikate", "erfunden"); f.set("umsatz_durchschnitt", "$1,250,000");
  const p = usProfilAusFormular(f, false) as UsProfil;
  assert.equal(p.uei, "ABCDEF123456");
  assert.deepEqual(p.naics, ["561720", "561730"]);
  assert.deepEqual(p.klein_naics, ["561720"]);
  assert.deepEqual(p.zertifikate, ["wosb"]);
  assert.equal(p.umsatz_durchschnitt, 1250000);
  f.set("uei", "zu-kurz");
  assert.match(usProfilAusFormular(f, true) as string, /12 Zeichen/);
  const html = usProfilFormular(p, false, true);
  assert.match(html, /Which ones are you listed as/);
  assert.match(html, /value="561720" checked/);
  assert.match(usProfilFormular(p, true, false), /disabled/);
});
