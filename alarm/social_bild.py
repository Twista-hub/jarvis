"""Images for the automatic Bluesky/Mastodon posts (09.11.2026): a 1200×675 card in the Crewtender style, drawn with
Pillow (no browser, no AI, no cost). Kinds: tender (title, place, deadline, value), number of the day, feature tip.
Fonts: Inter (SIL Open Font License, social_bilder/LIZENZ-Inter.txt).

For Facebook and Instagram (26.11.2026) the same three kinds exist upright, 1080×1350 as JPEG, with a photo under a
blue veil (the `*_hoch` functions; photos in docs/design/crewtender/posts/fotos, made with Canva's image generation,
no real persons; without the photo file the picture gets the plain blue background)."""
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ORDNER = Path(__file__).parent / "social_bilder"
B, H = 1200, 675
NAVY, BLAU, HELL, ORANGE, TEXT, GRAU = (15, 58, 90), (31, 111, 168), (212, 239, 255), (255, 107, 53), (20, 32, 43), (102, 102, 95)


def schrift(art: str, groesse: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(ORDNER / f"Inter-{art}.otf"), groesse)


def umbrechen(d: ImageDraw.ImageDraw, text: str, f, breite: int, zeilen: int) -> list[str]:
    """Word wrap to at most `zeilen` lines; the last one ends with … when the text is longer."""
    woerter, aus, zeile = text.split(), [], ""
    for w in woerter:
        probe = f"{zeile} {w}".strip()
        if d.textlength(probe, font=f) <= breite:
            zeile = probe
            continue
        if zeile:
            aus.append(zeile)
        zeile = w
        if len(aus) == zeilen:
            break
    if zeile and len(aus) < zeilen:
        aus.append(zeile)
    if len(aus) == zeilen and " ".join(aus) != " ".join(woerter):
        letzte = aus[-1]
        while letzte and d.textlength(letzte + " …", font=f) > breite:
            letzte = letzte.rsplit(" ", 1)[0] if " " in letzte else letzte[:-1]
        aus[-1] = letzte.rstrip(" ,;:-–") + " …"
    return aus


def grund() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """Blue gradient background, logo and name top left, address bottom right."""
    bild = Image.new("RGB", (B, H))
    oben, unten = (43, 132, 194), (27, 93, 143)
    for y in range(H):
        a = y / H
        ImageDraw.Draw(bild).line([(0, y), (B, y)], fill=tuple(round(oben[i] + (unten[i] - oben[i]) * a) for i in range(3)))
    d = ImageDraw.Draw(bild)
    logo = Image.open(ORDNER / "logo.png").convert("RGB").resize((64, 64), Image.LANCZOS)
    maske = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, 63, 63], radius=16, fill=255)
    bild.paste(logo, (60, 48), maske)
    d.text((140, 80), "Crewtender", font=schrift("ExtraBold", 34), fill="white", anchor="lm")
    d.text((B - 60, H - 42), "crewtender.eu", font=schrift("Bold", 26), fill=HELL, anchor="rm")
    return bild, d


def png(bild: Image.Image) -> bytes:
    puffer = io.BytesIO()
    bild.save(puffer, "PNG", optimize=True)
    return puffer.getvalue()


def ausschreibung_bild(titel: str, ort: str, frist: str, wert: str, quelle: str) -> tuple[bytes, str]:
    bild, d = grund()
    d.text((60, 160), "PUBLIC TENDER · GERMANY", font=schrift("Bold", 24), fill=HELL)
    d.rounded_rectangle([60, 205, B - 60, H - 95], radius=28, fill="white")
    f = schrift("ExtraBold", 46)
    y = 245
    for z in umbrechen(d, titel, f, B - 220, 3):
        d.text((100, y), z, font=f, fill=TEXT)
        y += 58
    y = max(y + 18, 430)
    chips = [x for x in (f"📍 {ort}" if ort else "", f"Deadline {frist}", f"Est. value {wert}" if wert else "") if x]
    x = 100
    fc = schrift("Bold", 26)
    for c in chips:
        c = c.replace("📍 ", "")  # Inter has no emoji
        w = d.textlength(c, font=fc) + 36
        if x + w > B - 100:
            break
        d.rounded_rectangle([x, y, x + w, y + 52], radius=14, fill=(232, 242, 249))
        d.text((x + 18, y + 26), c, font=fc, fill=NAVY, anchor="lm")
        x += w + 14
    d.text((100, H - 128), f"Source: {quelle}", font=schrift("Medium", 22), fill=GRAU, anchor="lm")
    alt = f"Public tender in Germany: {titel}." + (f" Place: {ort}." if ort else "") + f" Deadline {frist}." + (f" Estimated value {wert}." if wert else "")
    return png(bild), alt[:900]


def zahl_bild(zahl: int, zeile: str, unterzeile: str) -> tuple[bytes, str]:
    bild, d = grund()
    d.text((60, 160), "NUMBER OF THE DAY", font=schrift("Bold", 24), fill=HELL)
    d.text((60, 330), f"{zahl:,}", font=schrift("ExtraBold", 190), fill="white", anchor="lm")
    f = schrift("Bold", 40)
    y = 460
    for z in umbrechen(d, zeile, f, B - 120, 2):
        d.text((60, y), z, font=f, fill="white")
        y += 52
    if unterzeile:
        d.text((60, y + 14), unterzeile, font=schrift("Medium", 28), fill=HELL)
    return png(bild), f"Number of the day: {zahl:,} {zeile}. {unterzeile}".strip()


def tipp_bild(satz: str) -> tuple[bytes, str]:
    bild, d = grund()
    d.text((60, 160), "CREWTENDER TIP", font=schrift("Bold", 24), fill=HELL)
    f = schrift("ExtraBold", 54)
    y = 225
    for z in umbrechen(d, satz, f, B - 120, 5):
        d.text((60, y), z, font=f, fill="white")
        y += 68
    return png(bild), f"Crewtender tip: {satz}"


# ---- Upright pictures for Facebook and Instagram (1080×1350) ----
BH, HH = 1080, 1350
FOTOS = Path(__file__).parent.parent / "docs" / "design" / "crewtender" / "posts" / "fotos"
SCHLEIER = [(0.0, (31, 111, 168), .80), (.30, (31, 111, 168), .62), (.62, (21, 80, 126), .86), (1.0, (15, 58, 90), .96)]


def _schleier(a: float) -> tuple[int, int, int, int]:
    for (a0, f0, d0), (a1, f1, d1) in zip(SCHLEIER, SCHLEIER[1:]):
        if a <= a1:
            t = (a - a0) / (a1 - a0)
            return (*(round(f0[i] + (f1[i] - f0[i]) * t) for i in range(3)), round(255 * (d0 + (d1 - d0) * t)))
    return (*SCHLEIER[-1][1], round(255 * SCHLEIER[-1][2]))


def grund_hoch(foto: str = "", quelle: str = "") -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """Photo over the whole picture under a blue veil, logo and name top left, address and source at the bottom."""
    datei = FOTOS / f"{foto}.jpg"
    if foto and datei.exists():
        f = Image.open(datei).convert("RGB")
        m = max(BH / f.width, HH / f.height)
        f = f.resize((round(f.width * m), round(f.height * m)), Image.LANCZOS)
        bild = f.crop(((f.width - BH) // 2, (f.height - HH) // 2, (f.width - BH) // 2 + BH, (f.height - HH) // 2 + HH))
    else:
        bild = Image.new("RGB", (BH, HH), (43, 132, 194))
    schleier = Image.new("RGBA", (BH, HH))
    ds = ImageDraw.Draw(schleier)
    for y in range(HH):
        ds.line([(0, y), (BH, y)], fill=_schleier(y / (HH - 1)))
    bild = Image.alpha_composite(bild.convert("RGBA"), schleier).convert("RGB")
    d = ImageDraw.Draw(bild)
    logo = Image.open(ORDNER / "logo.png").convert("RGB").resize((60, 60), Image.LANCZOS)
    maske = Image.new("L", (60, 60), 0)
    ImageDraw.Draw(maske).rounded_rectangle([0, 0, 59, 59], radius=15, fill=255)
    bild.paste(logo, (72, 62), maske)
    d.text((148, 92), "Crewtender", font=schrift("ExtraBold", 32), fill="white", anchor="lm")
    d.text((72, HH - 72), "crewtender.eu", font=schrift("Bold", 26), fill=(234, 246, 253), anchor="lm")
    if quelle:
        d.text((BH - 72, HH - 72), f"Source: {quelle}", font=schrift("Medium", 21), fill=(200, 226, 243), anchor="rm")
    return bild, d


def jpeg(bild: Image.Image) -> bytes:
    puffer = io.BytesIO()
    bild.save(puffer, "JPEG", quality=88, optimize=True)
    return puffer.getvalue()


def _zeilen(d, text: str, f, x: int, y: int, breite: int, hoechstens: int, abstand: int, farbe) -> int:
    for z in umbrechen(d, text, f, breite, hoechstens):
        d.text((x, y), z, font=f, fill=farbe)
        y += abstand
    return y


def ausschreibung_bild_hoch(titel: str, ort: str, frist: str, wert: str, quelle: str, foto: str = "haeuser") -> tuple[bytes, str]:
    bild, d = grund_hoch(foto, quelle)
    d.text((72, 186), "PUBLIC TENDER · GERMANY", font=schrift("Bold", 25), fill=HELL)
    d.text((72, 228), "New tender,", font=schrift("ExtraBold", 74), fill="white")
    d.text((72, 308), "open for bids.", font=schrift("ExtraBold", 74), fill=HELL)
    d.rounded_rectangle([72, 480, BH - 72, 1040], radius=40, fill=(250, 252, 254))
    pille = "Real public tender · Germany"
    fp = schrift("Bold", 23)
    d.rounded_rectangle([118, 524, 118 + d.textlength(pille, font=fp) + 40, 572], radius=24, fill=(232, 242, 249))
    d.text((138, 548), pille, font=fp, fill=(31, 95, 139), anchor="lm")
    _zeilen(d, titel, schrift("ExtraBold", 44), 118, 606, BH - 236, 4, 56, TEXT)
    felder = [x for x in (("Place", ort), ("Bid deadline", frist), ("Est. value", wert)) if x[1]][:3]
    if len(felder) == 3 and d.textlength(ort, font=schrift("ExtraBold", 30)) > 250:
        felder = felder[:2]
    breite = (BH - 236 - 18 * (len(felder) - 1)) // max(len(felder), 1)
    for i, (name, inhalt) in enumerate(felder):
        x = 118 + i * (breite + 18)
        d.rounded_rectangle([x, 876, x + breite, 996], radius=22, fill="white", outline=(227, 238, 246), width=2)
        d.text((x + 22, 906), name, font=schrift("Medium", 21), fill=GRAU, anchor="lm")
        fw = schrift("ExtraBold", 30)
        d.text((x + 22, 956), (umbrechen(d, inhalt, fw, breite - 44, 1) or [""])[0], font=fw, fill=TEXT, anchor="lm")
    _zeilen(d, "Crewtender finds tenders like this every morning – and tells you which ones fit.", schrift("Bold", 34), 72, 1092, BH - 144, 3, 46, (234, 246, 253))
    alt = f"Public tender in Germany: {titel}." + (f" Place: {ort}." if ort else "") + f" Deadline {frist}." + (f" Estimated value {wert}." if wert else "")
    return jpeg(bild), alt[:900]


def zahl_bild_hoch(zahl: int, zeile: str, unterzeile: str, foto: str = "haeuser") -> tuple[bytes, str]:
    bild, d = grund_hoch(foto, "oeffentlichevergabe.de")
    d.text((72, 186), "NUMBER OF THE DAY", font=schrift("Bold", 25), fill=HELL)
    d.text((66, 360), f"{zahl:,}", font=schrift("ExtraBold", 230), fill="white", anchor="lm")
    y = _zeilen(d, zeile, schrift("ExtraBold", 46), 72, 500, BH - 144, 3, 60, "white")
    if unterzeile:
        y = _zeilen(d, unterzeile, schrift("Bold", 34), 72, y + 18, BH - 144, 2, 46, HELL)
    d.rounded_rectangle([72, 960, BH - 72, 1140], radius=34, fill=(250, 252, 254))
    _zeilen(d, "Crewtender reads them all every morning and picks the ones that fit your company.", schrift("Bold", 36), 116, 1002, BH - 232, 2, 50, NAVY)
    return jpeg(bild), f"Number of the day: {zahl:,} {zeile}. {unterzeile}".strip()


def tipp_bild_hoch(satz: str, foto: str = "checkliste") -> tuple[bytes, str]:
    bild, d = grund_hoch(foto)
    d.text((72, 186), "CREWTENDER TIP", font=schrift("Bold", 25), fill=HELL)
    _zeilen(d, satz, schrift("ExtraBold", 62), 72, 236, BH - 144, 9, 78, "white")
    d.rounded_rectangle([72, 1040, BH - 72, 1180], radius=34, fill=(250, 252, 254))
    d.text((116, 1110), "Try it in the free demo – no sign-up.", font=schrift("Bold", 36), fill=NAVY, anchor="lm")
    return jpeg(bild), f"Crewtender tip: {satz}"
