"""Neutral sample Steckbriefe for the public demo (Benjamin 06.11.2026, about 1 $ once).

Only from public notices of the official catalog (oeffentlichevergabe.de, CC0), one per trade, written with the same
instructions as in production but for no particular firm: no fit section, no names of persons. Nothing from customers
is used. Results go to jarvis_intern.demo_steckbriefe, which the demo reads through public.demo_eintrag.
The AI budget is reserved centrally like every other request (ki.steckbrief); KI_LIMIT_DOLLAR caps the run.

CLI: python3 demo_steckbriefe.py <anzahl 1-20>
"""
import json
import re
import sys
from datetime import date

import ki
from alarm import eforms_text, item
from profile_db import verbinden

NEUTRAL = ("Kein bestimmter Kunde. Dies ist ein neutraler Beispiel-Steckbrief für die öffentliche Demo von Crewtender, "
           "für jede Firma, die sich für diese Ausschreibung interessiert. Lass den Abschnitt „Passt das zum Kunden?“ ganz weg "
           "und bewerte nicht, ob die Ausschreibung zu einer Firma passt. Nenne keine Namen von Personen, keine persönlichen "
           "E-Mail-Adressen und keine Durchwahlen; nenne stattdessen die Vergabestelle.")
# (label, title pattern): Crewtender's trades, one sample each.
GEWERKE = [
    ("Gebäudereinigung", "unterhaltsreinigung|gebäudereinigung"), ("Glasreinigung", "glasreinigung|fensterreinigung"),
    ("Sicherheitsdienst", "bewachung|sicherheitsdienst|wachdienst"), ("Zeitarbeit", "arbeitnehmerüberlassung|personaldienstleist|zeitarbeit|leiharbeit"),
    ("Hausmeisterdienst", "hausmeister"), ("Winterdienst", "winterdienst"), ("Catering", "catering|verpflegung|speisenversorgung|mittagessen"),
    ("Grünpflege", "grünpflege|grünanlagen|grünflächen"), ("Empfang & Pforte", "empfang|pforte|pförtner"),
    ("Malerarbeiten", "malerarbeiten|maler- und"), ("Elektro", "elektroinstallation|elektroarbeiten"), ("Sanitär & Heizung", "sanitär|heizung"),
    ("Umzug", "umzug"), ("Schulbegleitung & Betreuung", "schulbegleitung|betreuung|kinderbetreuung"), ("Veranstaltungen", "veranstaltung|messe"),
    ("Dachdecker", "dachdecker|dacharbeiten"), ("Tischler", "tischler|schreiner"), ("Fahrdienst", "fahrdienst|beförderung|schülerbeförderung"),
    ("Wäscherei", "wäsche|textilreinigung"), ("Facility Management", "facility|gebäudemanagement"),
]


def neutral(text: str) -> str:
    """Drop a fit section if the model wrote one anyway; mask e-mail addresses and phone numbers."""
    text = re.sub(r"\n##\s*Passt das zum Kunden\?.*?(?=\n## |\Z)", "\n", text, flags=re.S)
    text = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[E-Mail ausgeblendet]", text)
    text = re.sub(r"(?<![\d.,/])(?:\+49|0)[\d /()-]{7,}\d", "[Telefon ausgeblendet]", text)
    return text.strip()


def auswahl(anzahl: int) -> list[tuple]:
    faelle, gesehen = [], set()
    with verbinden() as c:
        c.execute("set transaction read only")
        vorhanden = {r[0] for r in c.execute("select katalog_id from jarvis_intern.demo_steckbriefe").fetchall()}
        for label, muster in GEWERKE:
            if len(faelle) >= anzahl:
                break
            row = c.execute("""select id, roh, titel, auftraggeber, ort, frist, link from public.vergabekatalog
                               where quelle = 'bks' and status in ('offen', 'unbekannt') and frist > now() + interval '14 days'
                                 and titel ~* %s and not (id = any(%s))
                               order by quell_datum desc limit 1""", (muster, list(vorhanden | gesehen))).fetchone()
            if not row:
                print(f"Keine passende offene Bekanntmachung für {label}")
                continue
            gesehen.add(row[0])
            faelle.append((label,) + row)
    return faelle


def main() -> None:
    anzahl = max(1, min(20, int(sys.argv[1] if len(sys.argv) > 1 else "15")))
    neu = 0
    for label, kid, rel, titel, auftraggeber, ort, frist, link in auswahl(anzahl):
        voll = eforms_text(rel)
        dokumente = ("Nur die öffentliche Bekanntmachung, keine Vergabeunterlagen.\n"
                     + (f"Vollständige Bekanntmachung (eForms, Feldname: Wert):\n{voll}\n\n" if voll else "")
                     + "Kurzfassung (OCDS):\n" + json.dumps(rel, ensure_ascii=False)[:40000])
        vorher = ki.kosten()
        text = ki.steckbrief(NEUTRAL, json.dumps(item(0, rel) | {"link": link}, ensure_ascii=False), dokumente)
        kosten = ki.kosten() - vorher
        if not text:
            print(f"{label}: kein Steckbrief (Budget oder Ablehnung), Kosten {kosten:.3f} $")
            if ki.kosten() >= ki.LIMIT:
                break
            continue
        text = (neutral(text) + f"\n\n---\n_Beispiel-Steckbrief, automatisch erstellt von Crewtender am {date.today().strftime('%d.%m.%Y')} "
                f"nur aus der öffentlichen Bekanntmachung, ohne Bezug zu einer Firma. Quelle: [{link}]({link}). "
                "Ohne Gewähr, vor dem Angebot bitte die Originalunterlagen prüfen._\n")
        with verbinden() as c:
            c.execute("""insert into jarvis_intern.demo_steckbriefe (katalog_id, titel, auftraggeber, ort, frist, link, gewerk, markdown, kosten)
                         values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                         on conflict (katalog_id) do update set markdown = excluded.markdown, frist = excluded.frist, kosten = excluded.kosten, erstellt = now()""",
                      (kid, titel[:400], auftraggeber[:300], ort[:200], frist, link[:1000], label, text[:60000], round(kosten, 4)))
        neu += 1
        print(f"{label}: {titel[:80]} – {len(text)} Zeichen, {kosten:.3f} $")
    print(f"{neu} Beispiel-Steckbriefe gespeichert, KI-Kosten zusammen {ki.kosten():.2f} $")


if __name__ == "__main__":
    main()
