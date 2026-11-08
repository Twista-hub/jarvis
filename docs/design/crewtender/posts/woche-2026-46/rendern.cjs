// Renders every *.html in this folder to a 1080×1350 PNG (Playwright).
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => { const dir = __dirname; const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) { await p.goto('file://' + path.join(dir, f)); await p.waitForTimeout(200); await p.screenshot({ path: path.join(dir, f.replace('.html', '.png')) }); }
await b.close(); })();
