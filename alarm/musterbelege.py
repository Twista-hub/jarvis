"""Synthetic German receipts with known values for testing the receipt reader (web/src/belegleser.*).

No real receipts needed: fictitious shops, realistic layouts (till receipt with several VAT rates, fuel receipt,
A4 invoice incl. small business without VAT, hotel bill, parking ticket, phone bill), then "photographed": rotated,
blurred, noisy, low-contrast thermal paper, shadows. Deterministic (seed), so results are comparable between runs.
Usage: python3 alarm/musterbelege.py <out-dir>  -> PNG/JPG/PDF files plus wahrheit.json
"""
import json
import os
import random
import sys
from datetime import date, timedelta

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

SCHRIFT = "/usr/share/fonts/truetype/dejavu/"


def schrift(groesse: int, art: str = "DejaVuSansMono.ttf") -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(SCHRIFT + art, groesse)


def eur(x: float) -> str:
    return f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def kassenbon(r: random.Random, nr: int, art: str) -> tuple[Image.Image, dict]:
    """Narrow till receipt; art: baumarkt | tanken | buero | imbiss | parken."""
    tag = date(2026, 10, 1) + timedelta(days=r.randint(0, 31))
    laeden = {
        "baumarkt": ("BAUFUCHS Baumarkt", "Industriestr. 12, 52499 Baesweiler", "material",
                     [("Schrauben 4x40 200St", 7.99, 19), ("Dübel 8mm 100St", 5.49, 19), ("Silikon transp.", 6.95, 19), ("Arbeitshandschuhe", 4.99, 19), ("Abdeckplane 4x5m", 9.90, 19)]),
        "tanken": ("ROTPUNKT Tankstelle", "Aachener Str. 88, 52511 Geilenkirchen", "fahrzeug", []),
        "buero": ("PAPIERWELT Bürobedarf", "Markt 3, 52525 Heinsberg", "buero",
                  [("Kopierpapier A4 500Bl", 4.29, 19), ("Ordner breit", 2.49, 19), ("Toner TN-2420", 39.90, 19), ("Briefumschläge DL", 3.59, 19)]),
        "imbiss": ("Bäckerei Krümel", "Bahnhofstr. 5, 52531 Übach-Palenberg", "reise",
                   [("Kaffee to go", 2.80, 19), ("Brötchen belegt", 3.50, 7), ("Croissant", 1.60, 7), ("Wasser 0,5l", 1.90, 19)]),
        "parken": ("PARKHAUS AM DOM", "Domhof 1, 52062 Aachen", "fahrzeug", []),
    }
    name, adresse, kat, sortiment = laeden[art]
    zeilen = [(name, True), (adresse, False), ("Tel. 0" + str(r.randint(2400, 2499)) + "/" + str(r.randint(10000, 99999)), False),
              (f"St.-Nr. {r.randint(200, 299)}/{r.randint(1000, 9999)}/{r.randint(1000, 9999)}", False), ("", False)]
    posten: list[tuple[str, float, int]] = []
    if art == "tanken":
        liter = round(r.uniform(25, 70), 2)
        preis = round(r.uniform(1.62, 1.89), 3)
        posten = [(f"Diesel  {liter:.2f} l x {preis:.3f}".replace(".", ","), round(liter * preis, 2), 19)]
        if r.random() < 0.5:
            posten.append(("Scheibenreiniger", 4.49, 19))
    elif art == "parken":
        stunden = r.randint(1, 6)
        posten = [(f"Parkgebühr {stunden} Std.", round(stunden * 2.5, 2), 19)]
    else:
        posten = r.sample(sortiment, r.randint(2, len(sortiment)))
    for text, betrag, satz in posten:
        zeilen.append((f"{text[:24]:<24}{eur(betrag):>9} {'A' if satz == 19 else 'B'}", False))
    summe = round(sum(p[1] for p in posten), 2)
    zeilen += [("-" * 36, False), (f"{'SUMME EUR':<24}{eur(summe):>9}", True)]
    gegeben = summe if r.random() < 0.5 else float(int(summe / 10 + 1) * 10)
    zeilen += [(f"{'Bar' if gegeben != summe else 'EC-Karte':<24}{eur(gegeben):>9}", False)]
    if gegeben != summe:
        zeilen.append((f"{'Rückgeld':<24}{eur(gegeben - summe):>9}", False))
    zeilen.append(("", False))
    for satz, kz in ((19, "A"), (7, "B")):
        brutto = round(sum(p[1] for p in posten if p[2] == satz), 2)
        if brutto:
            netto = round(brutto / (1 + satz / 100), 2)
            zeilen.append((f"{kz} {satz}% MwSt {eur(brutto - netto):>8} Netto {eur(netto):>8}", False))
    zeilen += [("", False), (f"{tag.strftime('%d.%m.%Y')}  {r.randint(7, 19):02d}:{r.randint(0, 59):02d}  Bon {r.randint(1000, 9999)}", False),
               ("TSE-Signatur: " + "".join(r.choice("ABCDEF0123456789") for _ in range(16)), False), ("Vielen Dank für Ihren Einkauf!", False)]
    gross, w = 22, 560
    bild = Image.new("L", (w, 60 + len(zeilen) * (gross + 10)), 255)
    d = ImageDraw.Draw(bild)
    y = 30
    for text, fett in zeilen:
        f = schrift(gross + (4 if fett else 0), "DejaVuSansMono-Bold.ttf" if fett else "DejaVuSansMono.ttf")
        d.text((24, y), text, fill=30, font=f)
        y += gross + 10
    saetze = {p[2] for p in posten}
    gross_anteil = max((19, 7), key=lambda s: sum(p[1] for p in posten if p[2] == s))
    return bild, {"datum": tag.isoformat(), "lieferant": name, "brutto": summe, "ust_satz": gross_anteil, "gemischt": len(saetze) > 1, "kategorie": kat}


def rechnung(r: random.Random, nr: int, art: str) -> tuple[Image.Image, dict]:
    """A4 invoice; art: werkstatt | telefon | kleinunternehmer | hotel | versicherung."""
    tag = date(2026, 9, 15) + timedelta(days=r.randint(0, 45))
    daten = {
        "werkstatt": ("Autohaus Schmitz GmbH", "fahrzeug", [("Inspektion lt. Herstellervorgabe", 189.00), ("Motoröl 5W-30, 5 l", 64.50), ("Ölfilter", 14.90)], 19),
        "telefon": ("FunkNetz Mobil AG", "telefon", [("Grundgebühr Business M", 29.99), ("Datenpaket 10 GB", 9.99)], 19),
        "kleinunternehmer": ("Malerbetrieb Jansen", "personal", [("Streicharbeiten Büro, 12 Std.", 480.00), ("Material", 85.00)], 0),
        "hotel": ("Hotel Zur Post", "reise", [("Übernachtung EZ, 2 Nächte", 178.00)], 7),
        "versicherung": ("Rheinland Versicherung AG", "versicherung", [("Betriebshaftpflicht, Beitrag 4. Quartal", 312.40)], 0),
    }
    name, kat, posten, satz = daten[art]
    netto = round(sum(p[1] for p in posten), 2)
    ust = round(netto * satz / 100, 2)
    brutto = round(netto + ust, 2)
    w, h = 1240, 1754
    bild = Image.new("L", (w, h), 255)
    d = ImageDraw.Draw(bild)
    d.text((90, 90), name, fill=20, font=schrift(40, "DejaVuSans-Bold.ttf"))
    d.text((90, 145), "Hauptstraße 21 · 41812 Erkelenz · USt-IdNr. DE" + str(r.randint(100000000, 999999999)) if satz else "Hauptstraße 21 · 41812 Erkelenz · Steuernr. 208/5123/4567", fill=60, font=schrift(20, "DejaVuSans.ttf"))
    d.text((90, 260), "WP Digital Ranger\nBenjamin Schiffer\nRochusstraße 19\n52531 Übach-Palenberg", fill=20, font=schrift(24, "DejaVuSans.ttf"), spacing=8)
    titel = "Beitragsrechnung" if art == "versicherung" else "Rechnung"
    d.text((90, 470), f"{titel} Nr. RE-{tag.year}-{r.randint(1000, 9999)}", fill=10, font=schrift(32, "DejaVuSans-Bold.ttf"))
    d.text((820, 470), f"Datum: {tag.strftime('%d.%m.%Y')}", fill=20, font=schrift(24, "DejaVuSans.ttf"))
    d.text((820, 505), f"Leistung: {tag.strftime('%m/%Y')}", fill=60, font=schrift(20, "DejaVuSans.ttf"))
    y = 580
    d.line((90, y, 1150, y), fill=120, width=2)
    d.text((90, y + 10), "Pos.  Bezeichnung", fill=20, font=schrift(22, "DejaVuSans-Bold.ttf"))
    d.text((1000, y + 10), "Betrag", fill=20, font=schrift(22, "DejaVuSans-Bold.ttf"))
    y += 60
    for i, (text, betrag) in enumerate(posten, 1):
        d.text((90, y), f"{i}     {text}", fill=30, font=schrift(22, "DejaVuSans.ttf"))
        d.text((980, y), f"{eur(betrag):>10} €", fill=30, font=schrift(22, "DejaVuSans.ttf"))
        y += 42
    y += 20
    d.line((640, y, 1150, y), fill=120, width=2)
    zeilen = [("Nettobetrag", netto)] + ([(f"zzgl. {satz} % USt", ust)] if satz else []) + [("Rechnungsbetrag" if satz or art != "versicherung" else "Zu zahlender Beitrag", brutto)]
    for text, betrag in zeilen:
        y += 14
        fett = text.startswith(("Rechnungsbetrag", "Zu zahlen"))
        f = schrift(26 if fett else 22, "DejaVuSans-Bold.ttf" if fett else "DejaVuSans.ttf")
        d.text((640, y), text, fill=20, font=f)
        d.text((960, y), f"{eur(betrag):>10} €", fill=20, font=f)
        y += 36
    hinweis = {"kleinunternehmer": "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
               "versicherung": "Versicherungsteuer ist im Beitrag enthalten; keine Umsatzsteuer (§ 4 Nr. 10 UStG)."}.get(art, "")
    if hinweis:
        d.text((90, y + 40), hinweis, fill=40, font=schrift(20, "DejaVuSans.ttf"))
    d.text((90, h - 160), f"Zahlbar bis {(tag + timedelta(days=14)).strftime('%d.%m.%Y')} ohne Abzug. IBAN DE{r.randint(10, 99)} 3705 0198 {r.randint(1000, 9999)} {r.randint(1000, 9999)} {r.randint(10, 99)}",
           fill=60, font=schrift(18, "DejaVuSans.ttf"))
    return bild, {"datum": tag.isoformat(), "lieferant": name, "brutto": brutto, "ust_satz": satz, "gemischt": False, "kategorie": kat}


def fotografieren(bild: Image.Image, r: random.Random, staerke: int, thermo: bool) -> Image.Image:
    """Make a clean render look like a phone photo: background, rotation, shadow, blur, noise, contrast."""
    b = bild.convert("L")
    if thermo:  # faded thermal paper
        b = ImageEnhance.Contrast(b).enhance(0.55 - 0.05 * staerke)
    rand = 80
    hintergrund = Image.new("L", (b.width + 2 * rand, b.height + 2 * rand), r.randint(70, 140))
    hintergrund.paste(b, (rand, rand))
    b = hintergrund.rotate(r.uniform(-2.5, 2.5) * staerke, expand=True, fillcolor=r.randint(70, 140), resample=Image.BICUBIC)
    schatten = Image.linear_gradient("L").resize(b.size).rotate(r.choice([0, 90, 180, 270]))
    b = Image.blend(b, Image.eval(schatten, lambda v: 255 - v // (5 - min(staerke, 3))), 0.25 * staerke / 3)
    b = b.filter(ImageFilter.GaussianBlur(0.5 + 0.6 * staerke))
    rauschen = Image.effect_noise(b.size, 8 + 6 * staerke)
    b = Image.blend(b, rauschen, 0.06 * staerke)
    faktor = 1100 / max(b.size)
    if faktor < 1:
        b = b.resize((int(b.width * faktor), int(b.height * faktor)), Image.LANCZOS)
    return b.convert("RGB")


def main() -> None:
    aus = sys.argv[1]
    os.makedirs(aus, exist_ok=True)
    r = random.Random(20261103)
    plan = [("bon", a) for a in ("baumarkt", "tanken", "buero", "imbiss", "parken") for _ in range(2)] + \
           [("re", a) for a in ("werkstatt", "telefon", "kleinunternehmer", "hotel", "versicherung")] + \
           [("bon", "tanken"), ("bon", "baumarkt"), ("re", "werkstatt"), ("re", "hotel"), ("bon", "imbiss")]
    wahrheit = {}
    for i, (typ, art) in enumerate(plan, 1):
        bild, w = (kassenbon if typ == "bon" else rechnung)(r, i, art)
        staerke = (i % 3) + 1  # 1 light … 3 strong
        name = f"beleg{i:02d}_{art}"
        if typ == "re" and i % 4 == 0:  # some invoices as clean PDF (like an e-mail attachment)
            datei = name + ".pdf"
            bild.convert("RGB").save(os.path.join(aus, datei), "PDF", resolution=150)
        else:
            datei = name + ".jpg"
            fotografieren(bild, r, staerke, typ == "bon").save(os.path.join(aus, datei), "JPEG", quality=r.randint(60, 85))
        wahrheit[datei] = {**w, "staerke": staerke}
    with open(os.path.join(aus, "wahrheit.json"), "w", encoding="utf-8") as f:
        json.dump(wahrheit, f, ensure_ascii=False, indent=1)
    print(f"{len(wahrheit)} Musterbelege in {aus}")


if __name__ == "__main__":
    main()
