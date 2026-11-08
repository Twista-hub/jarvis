import sys, pathlib
out = pathlib.Path(sys.argv[1])
LOGO = '''<svg viewBox="-540 -540 1080 1080"><rect x="-540" y="-540" width="1080" height="1080" rx="250" fill="#15324b"/><circle r="300" fill="none" stroke="#fff" stroke-width="88" stroke-linecap="round" stroke-dasharray="1450 1885" transform="rotate(40)"/><circle r="300" fill="none" stroke="#ff6b35" stroke-width="88" stroke-linecap="round" stroke-dasharray="1 1884" transform="rotate(40)"/><path d="M-115 5 L-30 90 L130 -85" fill="none" stroke="#ff6b35" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/><circle cx="-130" cy="-120" r="34" fill="#168aad"/><circle cx="-30" cy="-160" r="34" fill="#168aad"/></svg>'''
BASE = '''<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0} body{width:1080px;height:1350px;overflow:hidden;font-family:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.post{position:relative;width:1080px;height:1350px;overflow:hidden}
.marke{position:absolute;display:flex;align-items:center;gap:14px;font-weight:800;font-size:30px;letter-spacing:.01em}
.marke svg{width:56px;height:56px;border-radius:15px;box-shadow:0 8px 20px -8px rgba(0,0,0,.45)}
.fuss{position:absolute;left:72px;right:72px;bottom:54px;display:flex;justify-content:space-between;align-items:center;font-size:24px}
.klein{font-size:19px;opacity:.7}
/* tender card in app style */
.karte{position:absolute;width:780px;padding:34px 38px 30px;border-radius:30px;background:#fff;color:#1d1d1b;box-shadow:0 40px 80px -30px rgba(5,20,35,.55),0 2px 0 rgba(255,255,255,.6) inset;border:1px solid #e6e6e0}
.kopf{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.punkte{padding:8px 16px;border-radius:12px;background:#e8f2f9;color:#1f5f8b;font-weight:800;font-size:22px}
.stand{font-size:20px;color:#66665f}
.titel{font-size:31px;font-weight:800;line-height:1.22;margin-bottom:16px;color:#14202b}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px}
.chip{padding:8px 14px;border-radius:12px;background:#f2f2ee;font-size:19px;color:#3a3a36;font-weight:600}
.wert{display:flex;align-items:baseline;gap:14px;padding-top:18px;border-top:1px solid #ecece6}
.wert b{font-size:52px;letter-spacing:-.02em;color:#0f3a5a}
.wert span{font-size:20px;color:#66665f}
.frist{margin-left:auto;text-align:right;font-size:18px;color:#66665f}
.frist strong{display:block;font-size:24px;color:#1d1d1b}
</style></head><body>'''
def karte(punkte, stand, titel, chips, wert, frist, tage, extra=''):
    return f'''<div class="karte" style="{extra}"><div class="kopf"><span class="punkte">{punkte}/10 match</span><span style="font-size:44px;font-weight:850;letter-spacing:-.02em;color:#0f3a5a">{wert}</span></div>
<div class="titel">{titel}</div><div class="chips">{''.join(f'<span class="chip">{c}</span>' for c in chips)}</div>
<div class="wert" style="justify-content:space-between"><span>est. contract value · {stand}</span><div class="frist" style="margin-left:0">Deadline <strong style="display:inline">in {tage} days</strong></div></div></div>'''

def kompakt(punkte, titel, wert, extra=''):
    return f'''<div class="karte" style="padding:24px 34px 70px;{extra}"><div style="display:flex;align-items:center;gap:18px"><span class="punkte" style="flex:0 0 auto">{punkte}/10</span><span style="flex:1;min-width:0;font-size:26px;font-weight:750;color:#14202b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{titel}</span><span style="flex:0 0 auto;font-size:40px;font-weight:850;letter-spacing:-.02em;color:#0f3a5a">{wert}</span></div></div>'''

# 1 — stacked tender cards, navy, money focus
p1 = BASE + f'''<div class="post" style="background:radial-gradient(900px 700px at 90% 0%,rgba(160,220,250,.55),transparent 60%),radial-gradient(800px 700px at 0% 100%,rgba(22,138,173,.45),transparent 60%),linear-gradient(165deg,#2b84c2 0%,#1f6fa8 50%,#1b5d8f 100%);color:#fff">
<div class="marke" style="left:72px;top:64px">{LOGO}Crewtender</div>
<div style="position:absolute;left:72px;right:72px;top:170px">
<div style="font-size:24px;font-weight:700;color:#d4efff;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px">Public tenders · Every morning</div>
<div style="font-size:76px;font-weight:850;line-height:1.02;letter-spacing:-.025em">Contracts worth<br><span style="background:linear-gradient(90deg,#bfe7ff,#ffffff);-webkit-background-clip:text;color:transparent">millions.</span> Found for you.</div></div>
{kompakt(6,"Winter service, 40 properties","€210,000","left:120px;top:500px;width:840px")}
{kompakt(7,"Facility services, 11 daycare centres","€640,000","left:120px;top:604px;width:840px")}
{kompakt(8,"Security, city hall and museum","€1,350,000","left:120px;top:708px;width:840px")}
{karte(9,"bid in progress","Cleaning of 6 schools and administration buildings","4 lots · 48 months · 24 km away".split(" · "),"€2,100,000",26,26,"left:120px;top:812px;width:840px")}
<div class="fuss" style="color:#eaf6fd"><span style="font-weight:700">crewtender.eu</span><span class="klein">Example tenders for illustration</span></div></div></body></html>'''

# 2 — big number, light glass
p2 = BASE + f'''<div class="post" style="background:radial-gradient(800px 600px at 100% 0%,rgba(124,198,240,.6),transparent 60%),radial-gradient(700px 600px at 0% 100%,rgba(22,138,173,.3),transparent 65%),linear-gradient(160deg,#eef8fe 0%,#d6ecfa 55%,#c2e2f6 100%);color:#102a40">
<div class="marke" style="left:72px;top:64px">{LOGO}Crewtender</div>
<div style="position:absolute;left:72px;right:72px;top:230px;padding:70px 64px 60px;border-radius:44px;background:rgba(255,255,255,.55);border:1.5px solid rgba(255,255,255,.95);box-shadow:0 50px 90px -40px rgba(21,50,75,.55),inset 0 2px 0 #fff;backdrop-filter:blur(14px)">
<div style="display:inline-block;padding:10px 20px;border-radius:999px;background:#e8f2f9;color:#1f5f8b;font-weight:800;font-size:24px;margin-bottom:34px">9/10 match for your company</div>
<div style="font-size:150px;font-weight:850;letter-spacing:-.045em;line-height:.95;color:#0f3a5a">€2.1m</div>
<div style="font-size:30px;color:#2a4a63;margin:18px 0 44px">estimated value · cleaning of 6 public buildings · 4 years</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
<div style="padding:20px;border-radius:20px;background:#fff;border:1px solid #e3eef6"><div style="font-size:18px;color:#66665f">Lots</div><div style="font-size:32px;font-weight:800">4</div></div>
<div style="padding:20px;border-radius:20px;background:#fff;border:1px solid #e3eef6"><div style="font-size:18px;color:#66665f">Deadline</div><div style="font-size:32px;font-weight:800">26 days</div></div>
<div style="padding:20px;border-radius:20px;background:#fff;border:1px solid #e3eef6"><div style="font-size:18px;color:#66665f">Distance</div><div style="font-size:32px;font-weight:800">24 km</div></div></div></div>
<div style="position:absolute;left:72px;right:72px;top:880px;font-size:44px;font-weight:800;line-height:1.18">Over 1,000 new public tenders every week. Crewtender reads them all – and shows you the ones that fit.</div>
<div class="fuss" style="color:#24506e"><span style="font-weight:700">crewtender.eu</span><span class="klein">Example tender for illustration</span></div></div></body></html>'''

# 3 — index-card tabs (Registerkarten) with features
tabs = [("Tenders","#1f6fa8"),("Bids","#2a8fd0"),("Shifts","#168aad"),("Hours & payroll","#4fb3ea")]
tabhtml=''
for i,(t,c) in enumerate(tabs):
    top = 380 + i*70
    tabhtml += f'<div style="position:absolute;left:{120+i*24}px;right:{120-i*24}px;top:{top}px;height:{780-i*70}px;border-radius:30px;background:#fff;border:1px solid #e3e3dc;box-shadow:0 -10px 30px -18px rgba(5,20,35,.35)"><div style="position:absolute;top:-46px;left:{40+i*170}px;padding:12px 26px 22px;border-radius:18px 18px 0 0;background:{c};color:#fff;font-weight:800;font-size:24px">{t}</div></div>'
front = f'''<div style="position:absolute;left:192px;right:48px;top:600px;height:560px;border-radius:30px;background:#fff;border:1px solid #e3e3dc;padding:40px 44px;box-shadow:0 40px 80px -30px rgba(5,20,35,.45)">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px"><span class="punkte">9/10 match</span><span class="stand">Fact sheet</span></div>
<div class="titel" style="font-size:34px">Cleaning of 6 schools and administration buildings</div>
<div style="display:grid;gap:14px;font-size:23px;color:#3a3a36;margin:10px 0 26px">
<div>📅 <b>Deadline</b> in 26 days · site visit on day 9</div><div>📦 <b>4 lots</b> · 48 months · 6 buildings</div><div>✅ <b>Evidence</b> insurance, references, ISO 9001</div><div>🧮 <b>Your price</b> €31.40 per hour</div></div>
<div class="wert"><b>€2,100,000</b><span>est. contract value</span></div></div>'''
p3 = BASE + f'''<div class="post" style="background:radial-gradient(900px 700px at 90% 0%,rgba(160,220,250,.55),transparent 60%),radial-gradient(800px 700px at 0% 100%,rgba(22,138,173,.45),transparent 60%),linear-gradient(165deg,#2b84c2 0%,#1f6fa8 50%,#1b5d8f 100%);color:#fff">
<div class="marke" style="left:72px;top:64px">{LOGO}Crewtender</div>
<div style="position:absolute;left:72px;right:72px;top:160px;font-size:62px;font-weight:850;line-height:1.05;letter-spacing:-.02em">From tender to team.<br><span style="color:#cdeeff">One app.</span></div>
{tabhtml}{front}
<div class="fuss" style="color:#eaf6fd"><span style="font-weight:700">crewtender.eu</span><span class="klein">Example data for illustration</span></div></div></body></html>'''

# 4 — three phones layered with real app screenshots (German demo)
def phone(img, style):
    return f'<div style="position:absolute;width:390px;height:800px;border-radius:56px;background:#0b1620;padding:14px;box-shadow:0 50px 90px -30px rgba(5,20,35,.6);{style}"><div style="width:100%;height:100%;border-radius:44px;overflow:hidden;background:#f7f7f5"><img src="{img}" style="width:100%;display:block"></div></div>'
p4 = BASE + f'''<div class="post" style="background:radial-gradient(800px 600px at 100% 0%,rgba(124,198,240,.6),transparent 60%),linear-gradient(160deg,#eef8fe 0%,#d6ecfa 55%,#c2e2f6 100%);color:#102a40">
<div class="marke" style="left:72px;top:64px">{LOGO}Crewtender</div>
<div style="position:absolute;left:72px;right:72px;top:160px;font-size:60px;font-weight:850;line-height:1.05;letter-spacing:-.02em">Auftrag gewinnen.<br><span style="color:#1f6fa8">Dann das Team planen.</span></div>
{phone("clean_demo_schichten.de.png","left:60px;top:430px;transform:rotate(-8deg) scale(.92);opacity:.95")}
{phone("clean_demo_stunden.de.png","right:60px;top:430px;transform:rotate(8deg) scale(.92);opacity:.95")}
{phone("clean_demo_treffer.de.png","left:345px;top:380px;z-index:2")}
<div class="fuss" style="color:#24506e;z-index:3"><span style="font-weight:700">crewtender.eu</span><span class="klein">Ausschreibungen · Schichtplan · Stundenzettel</span></div></div></body></html>'''

for n,h in [("post1-ausschreibungen",p1),("post2-auftragswert",p2),("post3-registerkarten",p3),("post4-handys",p4)]:
    (out/f"{n}.html").write_text(h, encoding="utf-8")
