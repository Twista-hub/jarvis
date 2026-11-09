import { test } from "node:test";
import assert from "node:assert/strict";
import { startseite } from "../src/rechtliches.ts";
import { PLAENE } from "../src/plaene.ts";
import { statisch } from "../src/app.ts";
import { landesSeite } from "../src/besucher.ts";

test("Startseite: Dia-Show, Live-Zahlen mit Beispiel, Preise wie in den Plänen, öffentliche Mailadresse", () => {
  const html = startseite("<p>Beispiel</p>", { woche: 1234, offen: 5526, beispiel: { id: "bks:x1", titel: "Unterhaltsreinigung <Schulen>", ort: "50667 Köln", frist: "2026-12-01T10:00:00Z" } });
  for (let i = 1; i <= 4; i++) assert.match(html, new RegExp(`src="/bilder/dia-${i}-v1.webp"`));
  assert.match(html, /<strong>1\.234<\/strong> neue öffentliche Ausschreibungen/);
  assert.match(html, /href="\/ausschreibung\/bks%3Ax1"/);
  assert.match(html, /Unterhaltsreinigung &#60;Schulen&#62;|Unterhaltsreinigung &lt;Schulen&gt;/);
  for (const p of PLAENE.filter((x) => x.monat > 0)) assert.match(html, new RegExp(`<strong>${p.name}</strong> ${p.monat} €`), `Preis ${p.name} aktuell`);
  assert.match(html, /hello@crewtender\.eu/);
  assert.doesNotMatch(html, /kontakt@wpdigitalranger/);
  assert.equal((html.match(/<li><span aria-hidden="true">/g) ?? []).length, 6, "6 statt 14 Kacheln");
  assert.doesNotMatch(startseite("", null), /start-live/, "ohne Zahlen kein Kasten");
});

test("Bilder der Dia-Show werden ausgeliefert", () => {
  const r = statisch("/bilder/dia-1-v1.webp");
  assert.equal(r?.headers.get("content-type"), "image/webp");
});

test("Internationale Startseite: Überschrift zuerst (nur einmal)", () => {
  const l = landesSeite({ land: "US", iso3: "USA", sprache: "de" }, "https://crewtender.eu", "");
  assert.ok(l.inhalt.startsWith("<h1>"));
});
