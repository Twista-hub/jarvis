"""Synthetic German company proofs with a known expiry date, to test reading the date (web/src/firmenunterlagen.ts).

Fictitious issuers and firm; slightly rotated and noisy like a scan. Usage: python3 alarm/musternachweise.py <out-dir>
-> PNG files plus wahrheit.json ({datei: expected YYYY-MM-DD or ""}; a list means several answers are acceptable).
"""
import json
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SCHRIFT = "/usr/share/fonts/truetype/dejavu/"
FIRMA = "Rheinland Facility Service GmbH (Beispiel), Am Beispielpark 12, 52068 Aachen"

NACHWEISE = [
    ("bg_unbedenklichkeit.png", "Berufsgenossenschaft Beispiel (BG Muster)", "Unbedenklichkeitsbescheinigung",
     ["Mitgliedsnummer: 123 456 789", f"Unternehmen: {FIRMA}", "",
      "Hiermit wird bestätigt, dass das oben genannte Unternehmen bei uns versichert ist",
      "und seine Beiträge bis einschließlich 2. Quartal 2026 entrichtet hat.", "",
      "Diese Bescheinigung ist gültig bis 31.03.2027.", "", "Musterstadt, 05.10.2026"], "2027-03-31"),
    ("haftpflicht.png", "Beispiel Versicherung AG", "Versicherungsbestätigung Betriebshaftpflicht",
     [f"Versicherungsnehmer: {FIRMA}", "Vertragsnummer: BH-2026-77881", "",
      "Deckungssummen: Personen- und Sachschäden 5.000.000 EUR je Schadensfall",
      "Versicherungszeitraum: 01.01.2026 bis 31.12.2026", "Der Vertrag verlängert sich jeweils um ein Jahr, sofern nicht gekündigt.", "",
      "Köln, 02.01.2026"], "2026-12-31"),
    ("freistellung_48b.png", "Finanzamt Musterstadt", "Freistellungsbescheinigung nach § 48b EStG",
     [f"Leistender: {FIRMA}", "Steuernummer: 201/5999/0001", "",
      "Die Freistellungsbescheinigung gilt für alle Bauleistungen des Leistenden.",
      "Gültigkeitsdauer: vom 15.11.2026 bis 14.11.2029", "", "Sicherheitsnummer: 4711-0815"], "2029-11-14"),
    ("iso9001.png", "Beispiel-Zertifizierung GmbH", "ZERTIFIKAT ISO 9001:2015",
     [f"Hiermit wird bescheinigt, dass", FIRMA, "ein Qualitätsmanagementsystem eingeführt hat und anwendet.", "",
      "Geltungsbereich: Gebäudereinigung, Hausmeisterdienste, Sicherheitsdienstleistungen",
      "Zertifikat-Nr.: QM-2024-0815   Erstzertifizierung: 23.06.2025", "Gültig bis: 22.06.2028"], "2028-06-22"),
    ("gewerbeanmeldung.png", "Stadt Musterstadt – Ordnungsamt", "Gewerbeanmeldung (GewA 1)",
     [f"Betriebsinhaber: {FIRMA}", "Angemeldete Tätigkeit: Gebäudereinigung, Hausmeisterdienste",
      "Beginn der Tätigkeit: 01.03.2012", "", "Die Anmeldung wurde entgegengenommen.", "Musterstadt, 28.02.2012"], ""),
    ("krankenkasse.png", "Beispiel Krankenkasse", "Unbedenklichkeitsbescheinigung",
     [f"Arbeitgeber: {FIRMA}", "Betriebsnummer: 99999999", "",
      "Der Arbeitgeber ist seinen Zahlungsverpflichtungen bisher nachgekommen.",
      "Diese Bescheinigung wurde am 02.10.2026 ausgestellt und gilt drei Monate.", "", "Aachen, 02.10.2026"], ["2027-01-02", "2027-01-01"]),
]


def bild(kopf: str, titel: str, zeilen: list[str], r: random.Random) -> Image.Image:
    img = Image.new("RGB", (1240, 1754), "white")
    d = ImageDraw.Draw(img)
    d.text((90, 90), kopf, fill="#123", font=ImageFont.truetype(SCHRIFT + "DejaVuSans-Bold.ttf", 34))
    d.line((90, 150, 1150, 150), fill="#123", width=3)
    d.text((90, 230), titel, fill="black", font=ImageFont.truetype(SCHRIFT + "DejaVuSans-Bold.ttf", 40))
    y = 340
    for z in zeilen:
        d.text((90, y), z, fill="#111", font=ImageFont.truetype(SCHRIFT + "DejaVuSans.ttf", 27))
        y += 52
    d.text((90, 1600), "Dieses Dokument ist ein erfundenes Muster für Softwaretests.", fill="#777", font=ImageFont.truetype(SCHRIFT + "DejaVuSans.ttf", 22))
    img = img.rotate(r.uniform(-1.5, 1.5), expand=True, fillcolor="white").filter(ImageFilter.GaussianBlur(0.6))
    return img.resize((img.width * 3 // 4, img.height * 3 // 4))


def main(ziel: str) -> None:
    os.makedirs(ziel, exist_ok=True)
    r = random.Random(7)
    wahrheit = {}
    for datei, kopf, titel, zeilen, erwartet in NACHWEISE:
        bild(kopf, titel, zeilen, r).save(os.path.join(ziel, datei))
        wahrheit[datei] = erwartet
    with open(os.path.join(ziel, "wahrheit.json"), "w", encoding="utf-8") as f:
        json.dump(wahrheit, f, ensure_ascii=False, indent=1)
    print(f"{len(wahrheit)} Muster-Nachweise in {ziel}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "muster-nachweise")
