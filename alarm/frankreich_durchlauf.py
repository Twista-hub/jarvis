"""End-to-end check for a French firm without an account and without writing anything: profile (départements, language
fr) → BOAMP notices of the last days → area and word filter → AI rating → fact sheet → morning mail (rendered, not sent).
Uses the real AI within the central budget (katalog.reservieren). Prints everything into the log.
Usage: ANTHROPIC_API_KEY=... SUPABASE_DB_PASSWORD=... python3 alarm/frankreich_durchlauf.py [days back, default 4]
"""
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone

import boamp
import ki
import mail
from alarm import cpv_codes, item, kurzbrief, score, sprach_arg
from profile_db import aus_db, im_suchgebiet

FRANZOESISCH = re.compile(r"\b(le|la|les|des|du|une|est|pour|avec|dans|marché|prestations?)\b", re.IGNORECASE)
IDF = ["75", "77", "78", "91", "92", "93", "94", "95"]

EINSTELLUNGEN = {
    "laender": ["FRA"], "departements": IDF,
    "leistungen": [{"name": "Nettoyage de locaux et vitrerie", "cpv": ["90910000", "90911200", "90911300", "90919200"],
                    "woerter": ["nettoyage", "propreté", "vitrerie", "entretien des locaux", "remise en état"]}],
}
BESCHREIBUNG = ("Entreprise de propreté à Paris, 25 salariés. Nettoyage courant de bureaux, écoles et bâtiments publics, "
                "vitrerie et remise en état après travaux en Île-de-France. Pas de nettoyage industriel ni hospitalier.")


def pruefe(bedingung: bool, text: str, fehler: list) -> None:
    print(("OK   " if bedingung else "FEHLT ") + text)
    if not bedingung:
        fehler.append(text)


def main(tage: int) -> None:
    fehler: list[str] = []
    profil = aus_db("test-frankreich", "Nettoyage Dupont SARL (Test)", BESCHREIBUNG, EINSTELLUNGEN, "75011")
    print("== Profil ==")
    print(json.dumps({k: profil[k] for k in ("laender", "departements", "sprache", "cpv")}, ensure_ascii=False))
    pruefe(profil.get("sprache") == "fr", "Profil: KI-Sprache Französisch (nur Frankreich gesucht)", fehler)
    pruefe(profil.get("departements") == sorted(IDF), "Profil: Départements Île-de-France", fehler)

    print("\n== BOAMP ==")
    alle = []
    for i in range(1, tage + 1):
        tag = (date.today() - timedelta(days=i)).isoformat()
        r = boamp.releases(tag)
        print(f"{tag}: {len(r)} Aufrufe zum Wettbewerb")
        alle += [(tag, x) for x in r]
    pruefe(len(alle) > 0, "BOAMP liefert Bekanntmachungen", fehler)
    im_gebiet = [(t, r) for t, r in alle if im_suchgebiet(profil, r)]
    kandidaten = []
    for tag, rel in im_gebiet:
        t = rel.get("tender") or {}
        punkte, grund = score(profil, f"{t.get('title', '')} {t.get('description', '')}".lower(), cpv_codes(t))
        if punkte:
            kandidaten.append((punkte, tag, rel))
    kandidaten.sort(key=lambda k: -k[0])
    print(f"Im Suchgebiet (Île-de-France): {len(im_gebiet)} von {len(alle)}; nach Wörtern/CPV passend: {len(kandidaten)}")
    pruefe(0 < len(im_gebiet) < len(alle), "Départements-Filter grenzt ein", fehler)
    pruefe(len(kandidaten) > 0, "Passende Nettoyage-Kandidaten gefunden", fehler)
    if not kandidaten:
        sys.exit("Keine Kandidaten – Abbruch")

    print("\n== KI-Bewertung (Französisch) ==")
    auswahl = kandidaten[:8]
    items = [item(n, rel) for n, (_, _, rel) in enumerate(auswahl)]
    bewertungen = ki.score(profil["beschreibung"], items, **sprach_arg(profil))
    for n, b in sorted(bewertungen.items(), key=lambda x: -x[1]["punkte"]):
        print(f"{b['punkte']:>2}/10  {items[n]['titel'][:90]}\n       kurz: {b['kurz']}\n       grund: {b['grund']}")
    pruefe(len(bewertungen) == len(items), "KI bewertet alle Kandidaten", fehler)
    texte = " ".join(b["kurz"] + " " + b["grund"] for b in bewertungen.values())
    pruefe(len(FRANZOESISCH.findall(texte)) >= len(bewertungen) * 2, "Bewertungstexte auf Französisch", fehler)

    print("\n== Steckbrief (bester Treffer) ==")
    bester = max(bewertungen, key=lambda n: bewertungen[n]["punkte"]) if bewertungen else 0
    _, tag, rel = auswahl[bester]
    print(kurzbrief(rel, tag))
    kopf = json.dumps(item(0, rel) | {"link": rel["tender"]["documents"][0]["url"], "veroeffentlicht": tag}, ensure_ascii=False)
    dokumente = "Nur die öffentliche Bekanntmachung, keine Vergabeunterlagen.\nKurzfassung (OCDS):\n" + json.dumps(rel, ensure_ascii=False)[:40000]
    text = ki.steckbrief(profil["beschreibung"], kopf, dokumente, **sprach_arg(profil))
    print("----- STECKBRIEF ANFANG -----")
    print(text)
    print("----- STECKBRIEF ENDE -----")
    pruefe(bool(text), "Steckbrief geschrieben", fehler)
    pruefe("## Auf einen Blick" in (text or "") or "# Steckbrief:" in (text or ""), "Steckbrief: deutsche Marken für die App erhalten", fehler)
    pruefe(len(FRANZOESISCH.findall(text or "")) >= 20, "Steckbrief: Inhalt auf Französisch", fehler)

    print("\n== Morgenmail (nur erzeugt, nicht verschickt) ==")
    frist_text = (rel["tender"].get("tenderPeriod") or {}).get("endDate")
    frist = datetime.fromisoformat(frist_text) if frist_text else None
    neu = [(f"v{n}", items[n]["titel"], bewertungen.get(n, {}).get("punkte"), frist if n == bester else None) for n in range(len(items))]
    m = mail.nachricht("test@example.invalid", "Nettoyage Dupont SARL", neu, [("v0", items[bester]["titel"], frist or datetime.now(timezone.utc) + timedelta(days=5))], [], "fr", mail.PARIS)
    print("Betreff:", m["Subject"])
    inhalt = m.get_body(preferencelist=("plain",)).get_content()
    print(inhalt)
    pruefe(m["Subject"].startswith("Nouveau :"), "Mail: Betreff Französisch", fehler)
    pruefe("Ausschreibung" not in inhalt and "Frist" not in inhalt, "Mail: kein Deutsch im Text", fehler)

    print(f"\nKI-Kosten dieses Laufs: {ki.kosten():.3f} $")
    print("ERGEBNIS: " + ("ALLES OK" if not fehler else "FEHLT: " + "; ".join(fehler)))
    if fehler:
        sys.exit(1)


if __name__ == "__main__":
    main(max(1, min(10, int(sys.argv[1]) if len(sys.argv) > 1 else 4)))
