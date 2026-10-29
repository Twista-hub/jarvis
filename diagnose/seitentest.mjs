// Opens a page like a mid-range phone, records catalog requests, console errors and screenshots.
import { chromium, devices } from "playwright";
import fs from "node:fs";

const url = process.argv[2] ?? "https://restockhero.eu/";
const out = "diagnose/ergebnis";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["Pixel 7"] });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const log = [];
const t0 = Date.now();
const t = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
page.on("console", (m) => log.push(`${t()} console.${m.type()}: ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => log.push(`${t()} PAGEERROR: ${e.message.slice(0, 300)}`));
page.on("requestfailed", (r) => log.push(`${t()} FAILED ${r.url()} ${r.failure()?.errorText}`));
page.on("response", async (r) => {
  if (r.url().includes("/api/") || r.request().resourceType() === "document" || r.request().resourceType() === "script") {
    const h = r.headers();
    log.push(`${t()} ${r.status()} ${r.url().slice(0, 120)} enc=${h["content-encoding"] ?? "-"} len=${h["content-length"] ?? "?"} gen=${h["x-generated-at"] ?? "-"}`);
  }
});
page.on("requestfinished", (r) => { if (r.url().includes("/api/catalog")) log.push(`${t()} FERTIG ${r.url().slice(0, 120)}`); });
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
await cdp.send("Profiler.start");
await page.goto(url, { waitUntil: "commit", timeout: 60000 });
for (const s of [5, 15, 30, 60]) {
  await page.waitForTimeout(s * 1000 - (Date.now() - t0));
  await page.screenshot({ path: `${out}/nach-${s}s.png` });
  const text = (await page.evaluate(() => document.body?.innerText ?? "")).replace(/\s+/g, " ").slice(0, 200);
  log.push(`${t()} SCREENSHOT nach ${s}s, Text: ${text}`);
}
// CPU profile: self time per function (top 25), to see what blocks the start.
const { profile } = await cdp.send("Profiler.stop");
const self = new Map();
const dt = profile.timeDeltas ?? [];
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
(profile.samples ?? []).forEach((id, i) => {
  const n = byId.get(id); const f = n.callFrame;
  const key = `${f.functionName || "(anonym)"} ${f.url.split("/").pop()}:${f.lineNumber}:${f.columnNumber}`;
  self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
});
const total = [...self.values()].reduce((a, b) => a + b, 0);
log.push(`CPU gesamt ${(total / 1000).toFixed(1)}s, Top:`);
for (const [k, v] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) log.push(`  ${(v / 1000).toFixed(2)}s  ${k}`);
const mem = await page.evaluate(() => (performance).memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) + " MB" : "?");
log.push(`JS-Speicher: ${mem}`);
fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
console.log(log.join("\n"));
await browser.close();
