import assert from "node:assert/strict";
import { test } from "node:test";
import { challenge, cookie, jwt, sicherWeiter } from "../src/konto.ts";

test("PKCE challenge is base64url(sha256(verifier)) without padding", async () => {
  // Expected value from Python: base64.urlsafe_b64encode(hashlib.sha256(v).digest()).rstrip(b"=")
  assert.equal(await challenge("dBjftJeZ4CVP-mJ92K-1qwkkZWQ8vM9dU0hPBcSUx3Lg"), "UaA7jJ1i3zT0Ti0CZXP-5Z5q1njPTyKsOw6xd04HCy0");
});

test("only local paths as redirect target", () => {
  assert.equal(sicherWeiter("/einladung?token=abc_DEF-123"), "/einladung?token=abc_DEF-123");
  assert.equal(sicherWeiter("//evil.example"), "/konto");
  assert.equal(sicherWeiter("https://evil.example"), "/konto");
  assert.equal(sicherWeiter("/\\evil.example"), "/konto");
  assert.equal(sicherWeiter(""), "/konto");
});

test("reads cookies and the token payload", () => {
  const r = new Request("https://x/", { headers: { cookie: "a=1; jv_at=x.y.z; b=2=3" } });
  assert.equal(cookie(r, "jv_at"), "x.y.z");
  assert.equal(cookie(r, "b"), "2=3");
  assert.equal(cookie(r, "fehlt"), null);
  const payload = btoa(JSON.stringify({ sub: "u1", email: "a@b.de", exp: 2000000000 })).replace(/=+$/, "");
  assert.deepEqual(jwt(`h.${payload}.s`), { sub: "u1", email: "a@b.de", exp: 2000000000 });
  assert.equal(jwt("kaputt"), null);
});

