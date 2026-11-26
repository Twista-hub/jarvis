"""Facebook/Instagram package, weeks 48-50/2026 (posts Fri 27.11. to Fri 11.12., three a week). Data from
`social.py woche` (run 26.11.2026): new public tenders 19-25 Nov 2026 per trade, best current tender. The tips use
the texts of alarm/social.py (TIPPS) with example data. Backgrounds: photos from ../fotos (see ../motive.py). Writes HTML; render with: node rendern.cjs."""
import pathlib, re, sys
hier = pathlib.Path(__file__).parent
sys.path.insert(0, str(hier.parent))
from motive import foto  # noqa: E402
quelle = (hier.parent / "entwuerfe.py").read_text(encoding="utf-8")
LOGO = re.search(r"LOGO = '''(.*?)'''", quelle, re.S).group(1)
BASE = re.search(r"BASE = '''(.*?)'''", quelle, re.S).group(1)
HELL = "background:radial-gradient(800px 600px at 100% 0%,rgba(124,198,240,.6),transparent 60%),radial-gradient(700px 600px at 0% 100%,rgba(22,138,173,.3),transparent 65%),linear-gradient(160deg,#eef8fe 0%,#d6ecfa 55%,#c2e2f6 100%);color:#102a40"
DUNKEL = "background:radial-gradient(900px 700px at 90% 0%,rgba(160,220,250,.55),transparent 60%),radial-gradient(800px 700px at 0% 100%,rgba(22,138,173,.45),transparent 60%),linear-gradient(165deg,#2a86c4 0%,#1f6fa8 45%,#15507e 100%);color:#fff"
marke = f'<div class="marke" style="left:72px;top:64px">{LOGO}Crewtender</div>'
ROT, GELB, BLAU, GRUEN, GRAU = "#c0392b", "#d68910", "#1f6fa8", "#1e8449", "#8a8a84"


def tipp(kopf: str, zeile1: str, zeile2: str, text: str, zeilen: list[tuple[str, str, str, str]], fuss: str, bild: str, dunkel: bool = False) -> str:
    """Tip layout: headline in two lines, one sentence, four white rows (title, note, label on the right, colour)."""
    akzent, hinweis, satz, rand = ("#d4efff", "#eaf6fd", "#eaf6fd", "#eaf6fd") if dunkel else ("#1f6fa8", "#24506e", "#2a4a63", "#24506e")
    karten = "".join(f'''<div style="display:flex;align-items:center;gap:22px;padding:24px 30px;border-radius:24px;background:#fff;border:1px solid #e3eef6;margin-bottom:16px;box-shadow:0 20px 40px -28px rgba(21,50,75,.5)">
<span style="flex:0 0 14px;height:64px;border-radius:7px;background:{farbe}"></span><div style="flex:1"><div style="font-size:30px;font-weight:800;color:#14202b">{t}</div><div style="font-size:21px;color:#66665f;margin-top:4px">{n}</div></div>
<span style="font-size:24px;font-weight:800;color:{farbe};text-align:right;white-space:nowrap">{rechts}</span></div>''' for t, n, rechts, farbe in zeilen)
    return BASE + f'''<div class="post" style="{DUNKEL if dunkel else HELL}">{foto(bild, dunkel)}{marke}
<div style="position:absolute;left:72px;right:72px;top:170px"><div style="font-size:24px;font-weight:700;color:{akzent};letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px">{kopf}</div>
<div style="font-size:74px;font-weight:850;line-height:1.03;letter-spacing:-.025em;{"text-shadow:0 4px 24px rgba(10,40,65,.45)" if dunkel else ""}">{zeile1}<br><span style="color:{akzent}">{zeile2}</span></div>
<div style="font-size:30px;line-height:1.35;margin-top:26px;color:{satz};max-width:610px">{text}</div></div>
<div style="position:absolute;left:72px;right:72px;top:640px">{karten}</div>
<div class="fuss" style="color:{rand}"><span style="font-weight:700">crewtender.eu</span><span class="klein">{fuss}</span></div></div></body></html>'''


# 1 — Fri 27.11.: number of the week (real data, oeffentlichevergabe.de, 19–25 Nov 2026)
gewerke = [("Joinery", 80), ("Electrical work", 66), ("Plumbing & heating", 66), ("Painting & drywall", 57), ("Roofing & carpentry", 54), ("Building cleaning", 48), ("Flooring & tiling", 45), ("Security services", 24), ("Landscaping & winter service", 16)]
hoechst = max(n for _, n in gewerke)
balken = "".join(f'''<div style="display:grid;grid-template-columns:330px 1fr 60px;align-items:center;gap:16px;margin-bottom:14px"><span style="font-size:24px;font-weight:600">{g}</span>
<span style="height:30px;border-radius:9px;background:linear-gradient(90deg,#bfe7ff,#ffffff);width:{round(100 * n / hoechst)}%"></span><span style="font-size:26px;font-weight:800;text-align:right">{n}</span></div>''' for g, n in gewerke)
p1 = BASE + f'''<div class="post" style="{DUNKEL}">{foto("haeuser", True)}{marke}
<div style="position:absolute;left:72px;right:72px;top:170px"><div style="font-size:24px;font-weight:700;color:#d4efff;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">Number of the week · 19–25 Nov 2026</div>
<div style="font-size:190px;font-weight:850;letter-spacing:-.045em;line-height:1">1,702</div>
<div style="font-size:40px;font-weight:800;line-height:1.15;margin-top:34px">new public tenders in Germany</div></div>
<div style="position:absolute;left:72px;right:72px;top:600px;padding:34px 36px 22px;border-radius:30px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.35)">
<div style="font-size:22px;color:#d4efff;margin-bottom:20px">Selected trades (a tender can count for several)</div>{balken}</div>
<div class="fuss" style="color:#eaf6fd"><span style="font-weight:700">crewtender.eu</span><span class="klein">Source: oeffentlichevergabe.de</span></div></div></body></html>'''

# 2 — Mon 30.11.: tender of the week (real notice)
p2 = BASE + f'''<div class="post" style="{HELL}">{foto("fenster")}{marke}
<div style="position:absolute;left:72px;right:72px;top:170px"><div style="font-size:24px;font-weight:700;color:#1f6fa8;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px">Tender of the week</div>
<div style="font-size:66px;font-weight:850;line-height:1.05;letter-spacing:-.02em">Cleaning contract<br><span style="color:#1f6fa8">open for bids.</span></div></div>
<div style="position:absolute;left:72px;right:72px;top:480px;padding:48px 50px 44px;border-radius:40px;background:rgba(255,255,255,.7);border:1.5px solid rgba(255,255,255,.95);box-shadow:0 50px 90px -40px rgba(21,50,75,.55)">
<div style="display:inline-block;padding:10px 20px;border-radius:999px;background:#e8f2f9;color:#1f5f8b;font-weight:800;font-size:22px;margin-bottom:26px">Real public tender · Germany</div>
<div style="font-size:42px;font-weight:800;line-height:1.2;color:#14202b">Final construction cleaning at Hagenbach primary school</div>
<div style="font-size:24px;color:#66665f;margin:14px 0 34px;font-style:italic">„Sanierung und Erweiterung Grundschule Hagenbach – Los 56 – Baureinigung“</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
<div style="padding:22px;border-radius:22px;background:#fff;border:1px solid #e3eef6"><div style="font-size:20px;color:#66665f">Place</div><div style="font-size:32px;font-weight:800">Hagenbach (RLP)</div></div>
<div style="padding:22px;border-radius:22px;background:#fff;border:1px solid #e3eef6"><div style="font-size:20px;color:#66665f">Bid deadline</div><div style="font-size:32px;font-weight:800">13 Jan 2027</div></div></div></div>
<div style="position:absolute;left:72px;right:72px;top:1090px;font-size:34px;font-weight:700;line-height:1.25;color:#24506e">Crewtender finds tenders like this every morning – and tells you which ones fit.</div>
<div class="fuss" style="color:#24506e"><span style="font-weight:700">crewtender.eu</span><span class="klein">Source: oeffentlichevergabe.de</span></div></div></body></html>'''

# 3 — Wed 02.12.: rating (example data)
p3 = tipp("Crewtender tip", "Which tenders", "fit your company?", "Every morning Crewtender rates new tenders for your company, 1–10, with a short reason.", [
    ("Cleaning of 3 schools", "Your trade, your region", "9 / 10", GRUEN), ("Security, town hall", "Fits – night shifts required", "7 / 10", BLAU),
    ("Winter service, 25 sites", "Far from your sites", "4 / 10", GELB), ("Road construction, lot 2", "Not your trade", "1 / 10", GRAU)], "Example tenders for illustration", "checkliste")

# 4 — Fri 04.12.: fact sheet (example data)
p4 = tipp("Crewtender tip", "Tender documents,", "read in minutes.", "Upload the tender documents and Crewtender writes a fact sheet: lots, quantities, deadlines and required evidence.", [
    ("Lots", "3 lots · bids per lot allowed", "", BLAU), ("Quantities", "12,400 m² floor area · 5 days a week", "", BLAU),
    ("Deadlines", "Questions until 4 Dec · bid by 15 Dec", "", GELB), ("Required evidence", "Liability insurance · references · tax clearance", "", GRUEN)], "Example fact sheet for illustration", "unterlagen", dunkel=True)

# 5 — Mon 07.12.: team (example data)
p5 = tipp("Crewtender tip", "Won the contract?", "Plan your crew.", "Shift plan, timesheets and proof of service in one place – and an app for your crew in 6 languages.", [
    ("Mon · School cleaning", "06:00–10:00 · 4 staff", "Fully staffed", GRUEN), ("Tue · Town hall security", "18:00–06:00 · 2 staff", "1 shift open", GELB),
    ("Wed · Trade fair catering", "10:00–20:00 · 8 staff", "Fully staffed", GRUEN), ("Timesheets, November", "Proof of service for the client", "Ready", BLAU)], "Example data for illustration", "team")

# 6 — Wed 09.12.: demo search
p6 = tipp("Crewtender tip", "Search real tenders.", "No sign-up.", "Try the demo: search real public tenders in Germany by keyword and region.", [
    ("1 · Enter a keyword", "e.g. Reinigung, Sicherheitsdienst, Elektro", "", BLAU), ("2 · Add a place or postal code", "e.g. Aachen or 52", "", BLAU),
    ("3 · See the open tenders", "With deadline, buyer and link to the official notice", "", GRUEN), ("4 · Like what you see?", "Crewtender can check new tenders for you every morning", "", GRUEN)], "Source of the tenders: oeffentlichevergabe.de", "lupe", dunkel=True)

# 7 — Fri 11.12.: deadlines (example data)
p7 = tipp("Crewtender tip", "Bid deadlines", "under control.", "Crewtender reminds you 7 and 2 days before each deadline – by e-mail and on your phone.", [
    ("Catering, school canteen", "Reminder sent today", "Bid due in 2 days", ROT), ("Building cleaning, lot 3", "Reminder sent today", "Bid due in 7 days", GELB),
    ("Security, event hall", "Reminders 7 and 2 days before", "Bid due in 16 days", BLAU), ("Electrical work, sports hall", "Bidder questions deadline", "Questions until 18 Dec", BLAU)], "Example tenders for illustration", "wecker")

for n, h in [("1-fr-zahl-der-woche", p1), ("2-mo-ausschreibung-der-woche", p2), ("3-mi-bewertung", p3), ("4-fr-steckbrief", p4), ("5-mo-team", p5), ("6-mi-suche", p6), ("7-fr-fristen", p7)]:
    (hier / f"{n}.html").write_text(h, encoding="utf-8")
