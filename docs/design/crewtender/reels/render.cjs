const { chromium } = require('playwright');
const [,, html, outdir, dauer] = process.argv;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('file://' + html); await p.waitForTimeout(300);
const fps = 30, n = Math.round(+dauer * fps);
for (let i = 0; i < n; i++) { await p.evaluate(t => window.setT(t), i / fps); await p.screenshot({ path: `${outdir}/f${String(i).padStart(4, '0')}.png` }); }
await b.close(); })();
