import assert from "node:assert/strict";
import { test } from "node:test";
import { einladungsMail } from "../src/mail.ts";

test("invitation mail", () => {
  const m = einladungsMail("anna@perlease.de", "Perlease\r\nBcc: x@y.de", "Bearbeiter", "https://x/einladung?token=abc");
  assert.equal(m.to, "anna@perlease.de");
  assert.equal(m.from.email, "kontakt@wpdigitalranger.com");
  assert.ok(!/[\r\n]/.test(m.subject), "no header injection via firm name");
  assert.ok(m.text.includes("https://x/einladung?token=abc"));
  assert.throws(() => einladungsMail("kaputt", "F", "Leser", "l"));
});
