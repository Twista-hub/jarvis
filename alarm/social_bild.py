"""Images for the automatic Bluesky/Mastodon posts (09.11.2026): a 1200×675 card in the Crewtender style, drawn with
Pillow (no browser, no AI, no cost). Kinds: tender (title, place, deadline, value), number of the day, feature tip.
Fonts: Inter (SIL Open Font License, social_bilder/LIZENZ-Inter.txt)."""
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
