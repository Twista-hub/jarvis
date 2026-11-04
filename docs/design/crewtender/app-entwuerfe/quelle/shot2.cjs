const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
for (const n of process.argv.slice(3)) { await p.goto('file://' + process.argv[2] + '/' + n + '.html'); await p.waitForTimeout(150); await p.screenshot({ path: process.argv[2] + '/' + n + '.png' }); }
await b.close(); })();
