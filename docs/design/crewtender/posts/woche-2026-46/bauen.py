"""Weekly Facebook/Instagram package, week 46/2026 (posts Wed 11.11., Fri 13.11., Mon 16.11.). Data from
`social.py woche` (run 08.11.2026): new public tenders 1–7 Nov 2026 per trade, best current tender. Writes HTML;
render with: node rendern.cjs <dir>."""
import pathlib, re, sys
hier = pathlib.Path(__file__).parent
quelle = (hier.parent / "entwuerfe.py").read_text(encoding="utf-8")
LOGO = re.search(r"LOGO = '''(.*?)'''", quelle, re.S).group(1)
BASE = re.search(r"BASE = '''(.*?)'''", quelle, re.S).group(1)
HELL = "background:radial-gradient(800px 600px at 100% 0%,rgba(124,198,240,.6),transparent 60%),radial-gradient(700px 600px at 0% 100%,rgba(22,138,173,.3),transparent 65%),linear-gradient(160deg,#eef8fe 0%,#d6ecfa 55%,#c2e2f6 100%);color:#102a40"
DUNKEL = "background:radial-gradient(900px 700px at 90% 0%,rgba(160,220,250,.55),transparent 60%),radial-gradient(800px 700px at 0% 100%,rgba(22,138,173,.45),transparent 60%),linear-gradient(165deg,#2a86c4 0%,#1f6fa8 45%,#15507e 100%);color:#fff"
marke = f'<div class="marke" style="left:72px;top:64px">{LOGO}Crewtender</div>'

# 1 — Wed: deadlines tip (example data)
fristen = [("Cleaning of 3 schools", "Bid due in 2 days", "#c0392b", "Reminder sent today"), ("Security, town hall", "Bid due in 7 days", "#d68910", "Reminder sent today"),
           ("Winter service, 25 sites", "Bid due in 19 days", "#1f6fa8", "Reminders 7 and 2 days before"), ("Staff for trade fair catering", "Questions until 21 Nov", "#1f6fa8", "Bidder questions deadline")]
zeilen = "".join(f'''<div style="display:flex;align-items:center;gap:22px;padding:24px 30px;border-radius:24px;background:#fff;border:1px solid #e3eef6;margin-bottom:16px;box-shadow:0 20px 40px -28px rgba(21,50,75,.5)">
<span style="flex:0 0 14px;height:64px;border-radius:7px;background:{farbe}"></span><div style="flex:1"><div style="font-size:30px;font-weight:800;color:#14202b">{t}</div><div style="font-size:21px;color:#66665f;margin-top:4px">{n}</div></div>
<span style="font-size:24px;font-weight:800;color:{farbe};text-align:right">{f}</span></div>''' for t, f, farbe, n in fristen)
p1 = BASE + f'''<div class="post" style="{HELL}">{marke}
<div style="position:absolute;left:72px;right:72px;top:170px"><div style="font-size:24px;font-weight:700;color:#1f6fa8;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px">Crewtender tip</div>
<div style="font-size:74px;font-weight:850;line-height:1.03;letter-spacing:-.025em">Never miss a<br><span style="color:#1f6fa8">bid deadline.</span></div>
<div style="font-size:30px;line-height:1.35;margin-top:26px;color:#2a4a63">Crewtender reminds you 7 and 2 days before each deadline – by e-mail and on your phone.</div></div>
<div style="position:absolute;left:72px;right:72px;top:640px">{zeilen}</div>
<div class="fuss" style="color:#24506e"><span style="font-weight:700">crewtender.eu</span><span class="klein">Example tenders for illustration</span></div></div></body></html>'''

# 2 — Fri: number of the week (real data, oeffentlichevergabe.de, 1–7 Nov 2026)
gewerke = [("Electrical work", 61), ("Joinery", 49), ("Building cleaning", 36), ("Painting & drywall", 32), ("Roofing & carpentry", 32), ("Flooring & tiling", 32), ("Plumbing & heating", 31), ("Landscaping & winter service", 14), ("Security services", 12)]
hoechst = max(n for _, n in gewerke)
balken = "".join(f'''<div style="display:grid;grid-template-columns:330px 1fr 60px;align-items:center;gap:16px;margin-bottom:14px"><span style="font-size:24px;font-weight:600">{g}</span>
<span style="height:30px;border-radius:9px;background:linear-gradient(90deg,#bfe7ff,#ffffff);width:{round(100 * n / hoechst)}%"></span><span style="font-size:26px;font-weight:800;text-align:right">{n}</span></div>''' for g, n in gewerke)
p2 = BASE + f'''<div class="post" style="{DUNKEL}">{marke}
<div style="position:absolute;left:72px;right:72px;top:170px"><div style="font-size:24px;font-weight:700;color:#d4efff;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">Number of the week · 1–7 Nov 2026</div>
<div style="font-size:190px;font-weight:850;letter-spacing:-.045em;line-height:1">1,133</div>
<div style="font-size:40px;font-weight:800;line-height:1.15;margin-top:34px">new public tenders in Germany</div></div>
<div style="position:absolute;left:72px;right:72px;top:600px;padding:34px 36px 22px;border-radius:30px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.35)">
<div style="font-size:22px;color:#d4efff;margin-bottom:20px">Selected trades (a tender can count for several)</div>{balken}</div>
<div class="fuss" style="color:#eaf6fd"><span style="font-weight:700">crewtender.eu</span><span class="klein">Source: oeffentlichevergabe.de</span></div></div></body></html>'''

# 3 — Mon: tender of the week (real notice)
p3 = BASE + f'''<div class="post" style="{HELL}">{marke}
<div style="position:absolute;left:72px;right:72px;top:170px"><div style="font-size:24px;font-weight:700;color:#1f6fa8;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px">Tender of the week</div>
<div style="font-size:66px;font-weight:850;line-height:1.05;letter-spacing:-.02em">Cleaning contract<br><span style="color:#1f6fa8">open for bids.</span></div></div>
<div style="position:absolute;left:72px;right:72px;top:480px;padding:48px 50px 44px;border-radius:40px;background:rgba(255,255,255,.7);border:1.5px solid rgba(255,255,255,.95);box-shadow:0 50px 90px -40px rgba(21,50,75,.55)">
<div style="display:inline-block;padding:10px 20px;border-radius:999px;background:#e8f2f9;color:#1f5f8b;font-weight:800;font-size:22px;margin-bottom:26px">Real public tender · Germany</div>
<div style="font-size:42px;font-weight:800;line-height:1.2;color:#14202b">Regular and deep cleaning at the waste and energy centre Asdonkshof</div>
<div style="font-size:24px;color:#66665f;margin:14px 0 34px;font-style:italic">„Unterhalts- und Grundreinigung im Abfall- und Energiezentrum Asdonkshof“</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
<div style="padding:22px;border-radius:22px;background:#fff;border:1px solid #e3eef6"><div style="font-size:20px;color:#66665f">Place</div><div style="font-size:32px;font-weight:800">Kamp-Lintfort (NRW)</div></div>
<div style="padding:22px;border-radius:22px;background:#fff;border:1px solid #e3eef6"><div style="font-size:20px;color:#66665f">Bid deadline</div><div style="font-size:32px;font-weight:800">10 Dec 2026</div></div></div></div>
<div style="position:absolute;left:72px;right:72px;top:1080px;font-size:34px;font-weight:700;line-height:1.25;color:#24506e">Crewtender finds tenders like this every morning – and tells you which ones fit.</div>
<div class="fuss" style="color:#24506e"><span style="font-weight:700">crewtender.eu</span><span class="klein">Source: oeffentlichevergabe.de</span></div></div></body></html>'''

for n, h in [("1-mi-fristen", p1), ("2-fr-zahl-der-woche", p2), ("3-mo-ausschreibung-der-woche", p3)]:
    (hier / f"{n}.html").write_text(h, encoding="utf-8")
