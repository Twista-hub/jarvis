import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { parseHTML } from "linkedom";
import { arbeitsAuswahl, MAX_ARBEITEN } from "../src/arbeitsauswahl.ts";
import { ARBEITSAUSWAHL_JS } from "../src/arbeitsauswahl-browser.ts";
import { SUCH_AKTION_JS } from "../src/suchaktionen.ts";
import { ausFormular, type Leistung } from "../src/einrichtung.ts";

const fliesen: Leistung = { name: "Fliesenarbeiten", cpv: ["45431000"], woerter: ["fliesenarbeiten", "fliesenverlegung"] };

function auswahl(leistungen: Leistung[], js = true) {
  const { document, window } = parseHTML(`<html><body><form data-suchaktion action="/konto/einrichtung/speichern">${arbeitsAuswahl(leistungen)}</form></body></html>`);
  const root = document.querySelector("[data-arbeitsauswahl]")!;
  document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((i) => { i.checked = i.hasAttribute("checked"); });
  const dropdown = document.querySelector("select")!;
  // Linkedom lacks the native select.value setter; the browser has it.
  let wert = "";
  Object.defineProperty(dropdown, "value", { get: () => wert, set: (v: string) => { wert = v; } });
  if (js) runInNewContext(ARBEITSAUSWAHL_JS, { document });
  const klick = (el: Element) => el.dispatchEvent(new window.Event("click", { bubbles: true }));
  const waehlen = (name: string) => {
    const o = [...dropdown.querySelectorAll("option")].find((o) => o.dataset.arbeitName === name || o.value === name)!;
    assert.ok(o, `Auswahl fehlt: ${name}`);
    assert.equal(Boolean(o.disabled), false);
    const button = root.querySelector<HTMLButtonElement>(`[data-arbeit-waehlen="${o.value}"]`)!;
    assert.ok(button, `Sichtbare Auswahl fehlt: ${name}`);
    assert.equal(Boolean(button.disabled), false);
    klick(button);
  };
  const entfernen = (name: string) => klick(root.querySelector(`[aria-label="${name} entfernen"]`)!);
  const formulardaten = () => {
    const f = new FormData();
    root.querySelectorAll<HTMLInputElement>("[data-arbeit-felder] input[name]").forEach((i) => {
      if (i.type !== "checkbox" || i.checked) f.append(i.name, i.value);
    });
    return ausFormular(f).leistungen;
  };
  return { document, window, root, dropdown, klick, waehlen, entfernen, formulardaten, chips: () => root.querySelectorAll(".arbeits-chip") };
}

test("Dropdown ergänzt Kästchen; Entfernen und Wiederhinzufügen bewahren Suchwörter und CPV", () => {
  const a = auswahl([fliesen]);
  assert.equal(a.chips().length, 1);
  a.waehlen("Natursteinarbeiten");
  assert.equal(a.chips().length, 2);
  a.entfernen("Fliesenarbeiten");
  a.waehlen("Malerarbeiten"); // reuses the removed form row
  a.waehlen("Fliesenarbeiten"); // restores evidence from the dropdown into a fresh row
  assert.equal(a.chips().length, 3);
  assert.deepEqual(a.formulardaten().find((l) => l.name === "Fliesenarbeiten"), fliesen);
  assert.ok(a.formulardaten().find((l) => l.name === "Natursteinarbeiten")!.woerter.includes("naturstein"));
});

test("Arbeitenliste filtert linksbündige Textknöpfe und schließt nach Auswahl", () => {
  const a = auswahl([fliesen]);
  const menue = a.root.querySelector<HTMLDetailsElement>("[data-arbeit-menue]")!;
  const filter = a.root.querySelector<HTMLInputElement>("[data-arbeit-filter]")!;
  const liste = a.root.querySelector("[data-arbeit-liste]")!;
  assert.equal(a.dropdown.hidden, true, "das native Menü mit unterschiedlich eingerückten Gruppen wird ersetzt");
  menue.open = true;
  filter.value = "naturstein";
  filter.dispatchEvent(new a.window.Event("input"));
  assert.equal(liste.querySelectorAll("h3").length, 1);
  assert.equal(liste.querySelectorAll("button").length, 2, "nur ein Treffer plus eigene Arbeit");
  a.waehlen("Natursteinarbeiten");
  assert.equal(menue.open, false);
  assert.equal(filter.value, "");
  assert.equal(a.chips().length, 2);
  assert.ok([...liste.querySelectorAll("button")].some((b) => b.textContent === "Malerarbeiten"));
});

test("eigene Arbeiten werden speicherbar ergänzt und doppelte Namen verhindert", () => {
  const a = auswahl([fliesen]);
  const eingabe = a.root.querySelector<HTMLInputElement>("[data-arbeit-eigener-name]")!;
  const button = a.root.querySelector("[data-arbeit-eigene-anlegen]")!;
  for (let i = 0; i < 2; i++) {
    a.waehlen("__eigen");
    eingabe.value = "Küchenrückwände montieren";
    a.klick(button);
  }
  assert.equal(a.chips().length, 2);
  assert.match(a.root.querySelector("[data-arbeit-status]")!.textContent!, /bereits ausgewählt/);
  assert.ok(a.formulardaten().find((l) => l.name === "Küchenrückwände montieren")!.woerter.includes("küchenrückwände"));
});

test("Kästchen öffnet Detailbearbeitung und speichert geänderte Suchwörter nach Entfernen erneut", () => {
  const a = auswahl([fliesen]);
  a.klick(a.root.querySelector('[aria-label="Fliesenarbeiten bearbeiten"]')!);
  const editor = a.root.querySelector<HTMLElement>("[data-arbeit-felder]")!;
  assert.equal(editor.hidden, false);
  const w = editor.querySelector<HTMLInputElement>("[data-arbeit-woerter]")!;
  w.value = "fliesen, wandfliesen";
  w.dispatchEvent(new a.window.Event("input", { bubbles: true }));
  a.entfernen("Fliesenarbeiten");
  a.waehlen("Fliesenarbeiten");
  assert.deepEqual(a.formulardaten()[0].woerter, ["fliesen", "wandfliesen"]);
  assert.deepEqual(a.formulardaten()[0].cpv, fliesen.cpv);
});

test("Auswahlgrenze gilt vor dem Speichern; entfernte Arbeit gibt einen Platz frei", () => {
  const a = auswahl(Array.from({ length: MAX_ARBEITEN }, (_, i) => ({ name: `Arbeit ${i}`, cpv: [], woerter: [`arbeit${i}`] })));
  assert.equal(a.dropdown.disabled, true);
  assert.equal(a.chips().length, MAX_ARBEITEN);
  a.entfernen("Arbeit 0");
  assert.equal(a.dropdown.disabled, false);
  a.waehlen("Fliesenarbeiten");
  assert.equal(a.formulardaten().length, MAX_ARBEITEN);
});

test("ohne JavaScript bleiben Arbeiten auswählbar und eigene Namen reichen zum Speichern", () => {
  const a = auswahl([fliesen], false);
  const zeilen = a.root.querySelectorAll("[data-arbeit-felder] [data-arbeit-zeile]");
  zeilen[1].querySelector<HTMLInputElement>("[data-arbeit-aktiv]")!.checked = true;
  zeilen[1].querySelector<HTMLInputElement>("[data-arbeit-name]")!.value = "Treppenbeläge verlegen";
  assert.deepEqual(a.formulardaten()[0], fliesen);
  assert.ok(a.formulardaten()[1].woerter.includes("treppenbeläge"));
});

test("eigene Namen werden als Text dargestellt und erzeugen kein HTML", () => {
  const a = auswahl([fliesen]);
  a.waehlen("__eigen");
  a.root.querySelector<HTMLInputElement>("[data-arbeit-eigener-name]")!.value = '<img src=x onerror="alert(1)">';
  a.klick(a.root.querySelector("[data-arbeit-eigene-anlegen]")!);
  assert.equal(a.root.querySelector("img"), null);
  assert.match(a.chips()[1].textContent!, /<img/);
});

test("auch später hinzugefügte Kästchen bleiben nach Absenden und Browser-Zurück bedienbar", () => {
  const a = auswahl([fliesen]);
  const timers: (() => void)[] = [];
  let pageshow: (event: { persisted: boolean }) => void = () => {};
  a.window.HTMLElement.prototype.scrollIntoView = () => {};
  runInNewContext(SUCH_AKTION_JS, { document: a.document, window: { setTimeout: (f: () => void) => timers.push(f), addEventListener: (_: string, f: typeof pageshow) => { pageshow = f; } } });
  a.waehlen("Natursteinarbeiten");
  const entfernen = a.root.querySelector<HTMLButtonElement>('[aria-label="Natursteinarbeiten entfernen"]')!;
  const e = new a.window.Event("submit", { bubbles: true, cancelable: true });
  Object.defineProperty(e, "submitter", { value: entfernen });
  a.document.querySelector("form")!.dispatchEvent(e);
  timers.shift()!();
  assert.equal(entfernen.disabled, true);
  pageshow({ persisted: true });
  assert.equal(entfernen.disabled, false);
  a.klick(entfernen);
  assert.equal(a.chips().length, 1);
});
