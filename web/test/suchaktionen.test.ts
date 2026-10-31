import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { SUCH_AKTION_JS } from "../src/suchaktionen.ts";

function seite(action: string, auto = false) {
  const timers: (() => void)[] = [];
  const attribute: Record<string, string> = {};
  let status: any = null;
  let submit: (e: any) => void = () => {};
  const button = { disabled: false, textContent: "Starten", getAttribute: () => null, insertAdjacentElement: (_: string, element: any) => { status = element; } };
  const form = {
    dataset: {} as Record<string, string>,
    addEventListener: (_: string, handler: (e: any) => void) => { submit = handler; },
    getAttribute: () => action, setAttribute: (k: string, v: string) => { attribute[k] = v; },
    querySelector: (selector: string) => selector === "[data-einrichtung-status]" ? status : button,
    querySelectorAll: () => [button],
    requestSubmit: () => submit({ submitter: null, preventDefault() {} }),
  };
  const document = {
    querySelectorAll: (selector: string) => selector === "form[data-suchaktion]" || auto ? [form] : [],
    createElement: () => ({ textContent: "", setAttribute() {}, prepend() {}, scrollIntoView() {} }),
  };
  runInNewContext(SUCH_AKTION_JS, { document, window: { setTimeout: (f: () => void) => timers.push(f) } });
  return { button, form, attribute, timers, submit: (e: any) => submit(e), status: () => status };
}

test("erneute Recherche zeigt sofort Wartezustand auch beim Zweitbutton im Speicherformular", () => {
  const s = seite("/konto/einrichtung/speichern");
  const rechercheButton = { ...s.button, getAttribute: (key: string) => key === "formaction" ? "/konto/einrichtung/automatisch" : null };
  s.submit({ submitter: rechercheButton, preventDefault() {} });
  assert.match(rechercheButton.textContent, /Firma wird recherchiert/);
  assert.match(s.status().textContent, /bis zu zwei Minuten/);
  assert.equal(s.attribute["aria-busy"], "true");
  assert.equal(rechercheButton.disabled, false, "der Browser muss Aktion und Formularwerte noch einsammeln können");
  let verhindert = false;
  s.submit({ submitter: rechercheButton, preventDefault() { verhindert = true; } });
  assert.equal(verhindert, true, "Doppelklick startet keine zweite kostenpflichtige Recherche");
  s.timers.shift()!();
  assert.equal(s.button.disabled, true);
});

test("Ausschreibungssuche bekommt ihren eigenen verständlichen Wartezustand", () => {
  const s = seite("/konto/einrichtung/starten");
  s.submit({ submitter: s.button, preventDefault() {} });
  assert.match(s.status().textContent, /Suche nach Ausschreibungen/);
  assert.doesNotMatch(s.status().textContent, /recherchiert deine Firma/);
});

test("automatische Ersteinrichtung startet ohne weiteren Klick und zeigt ebenfalls Fortschritt", () => {
  const s = seite("/konto/einrichtung/automatisch", true);
  assert.equal(s.timers.length, 1);
  s.timers.shift()!();
  assert.match(s.status().textContent, /recherchiert deine Firma/);
  assert.equal(s.form.dataset.beschaeftigt, "1");
});
