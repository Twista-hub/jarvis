"""End-to-end check for a foreign firm without an account and without writing anything: profile (region, language) →
national notices of the last days (France: BOAMP, Poland: BZP) → area and word filter → AI rating → fact sheet →
morning mail (rendered, not sent). Uses the real AI within the central budget (katalog.reservieren). Prints everything.
Usage: ANTHROPIC_API_KEY=... SUPABASE_DB_PASSWORD=... python3 alarm/frankreich_durchlauf.py [days back] [fr|pl]
"""
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone

import boamp
import bzp
import anac
import katalonien
import ki
import mail
from alarm import cpv_codes, item, kurzbrief, score, sprach_arg
from profile_db import aus_db, im_suchgebiet

IDF = ["75", "77", "78", "91", "92", "93", "94", "95"]
LAENDER = {
    "fr": {"quelle": boamp, "name": "Nettoyage Dupont SARL (Test)", "plz": "75011", "zone": mail.PARIS, "betreff": "Nouveau :",
           "sprache": re.compile(r"\b(le|la|les|des|du|une|est|pour|avec|dans|marché|prestations?)\b", re.IGNORECASE),
           "gebiet": ("departements", IDF),
           "einstellungen": {"laender": ["FRA"], "departements": IDF,
                             "leistungen": [{"name": "Nettoyage de locaux et vitrerie", "cpv": ["90910000", "90911200", "90911300", "90919200"],
                                             "woerter": ["nettoyage", "propreté", "vitrerie", "entretien des locaux", "remise en état"]}]},
           "beschreibung": ("Entreprise de propreté à Paris, 25 salariés. Nettoyage courant de bureaux, écoles et bâtiments publics, "
                            "vitrerie et remise en état après travaux en Île-de-France. Pas de nettoyage industriel ni hospitalier.")},
    "pl": {"quelle": bzp, "name": "Sprzątanie Kowalski Sp. z o.o. (Test)", "plz": "00-950", "zone": mail.WARSCHAU, "betreff": "Nowe przetargi",
           "sprache": re.compile(r"\b(i|w|na|do|się|jest|oraz|dla|przez|zamówienia|usług[ia]?)\b", re.IGNORECASE),
           "gebiet": ("woiwodschaften", ["mazowieckie", "lodzkie"]),
           "einstellungen": {"laender": ["POL"], "woiwodschaften": ["mazowieckie", "lodzkie"],
                             "leistungen": [{"name": "Sprzątanie pomieszczeń i mycie okien", "cpv": ["90910000", "90911200", "90911300", "90919200"],
                                             "woerter": ["sprzątanie", "utrzymanie czystości", "mycie okien", "usługi porządkowe", "sprzątania"]}]},
           "beschreibung": ("Firma sprzątająca z Warszawy, 40 pracowników. Sprzątanie biur, szkół i budynków publicznych, mycie okien "
                            "i sprzątanie po remontach w województwie mazowieckim i łódzkim. Bez sprzątania przemysłowego i szpitali.")},
    "es": {"quelle": katalonien, "name": "Limpiezas Puig S.L. (Test)", "plz": "08013", "zone": mail.MADRID, "betreff": "Nuevas licitaciones",
           "sprache": re.compile(r"\b(el|la|los|las|de|del|para|con|en|y|servicio|limpieza|contrato)\b", re.IGNORECASE),
           "gebiet": ("comunidades", ["ES51"]),
           "einstellungen": {"laender": ["ESP"], "comunidades": ["ES51"],
                             "leistungen": [{"name": "Limpieza de edificios y cristales", "cpv": ["90910000", "90911200", "90911300", "90919200"],
                                             "woerter": ["limpieza", "neteja", "netejа", "servei de neteja", "servicio de limpieza", "cristales", "vidres"]}]},
           "beschreibung": ("Empresa de limpieza de Barcelona, 60 trabajadores. Limpieza de oficinas, escuelas y edificios públicos, "
                            "limpieza de cristales y limpiezas tras obras en Cataluña. Sin limpieza industrial ni hospitalaria.")},
    "it": {"quelle": anac, "name": "Pulizie Rossi S.r.l. (Test)", "plz": "20121", "zone": mail.ROM, "betreff": "Nuove gare",
           "sprache": re.compile(r"\b(il|lo|la|gli|le|di|del|della|per|con|e|servizio|pulizia|appalto)\b", re.IGNORECASE),
           "gebiet": ("regioni", ["ITC4", "ITH3"]),
           "einstellungen": {"laender": ["ITA"], "regioni": ["ITC4", "ITH3"],
                             "leistungen": [{"name": "Pulizia di edifici e vetri", "cpv": ["90910000", "90911200", "90911300", "90919200"],
                                             "woerter": ["pulizia", "pulizie", "servizio di pulizia", "sanificazione", "igiene ambientale", "vetri"]}]},
           "beschreibung": ("Impresa di pulizie di Milano, 45 dipendenti. Pulizia di uffici, scuole ed edifici pubblici, pulizia vetri "
                            "e pulizie dopo lavori in Lombardia e Veneto. Niente pulizie industriali né ospedaliere.")},
}
L = LAENDER["fr"]


def pruefe(bedingung: bool, text: str, fehler: list) -> None:
    print(("OK   " if bedingung else "FEHLT ") + text)
    if not bedingung:
        fehler.append(text)


def main(tage: int, code: str = "fr") -> None:
    global L
    L = LAENDER[code]
    fehler: list[str] = []
    profil = aus_db(f"test-{code}", L["name"], L["beschreibung"], L["einstellungen"], L["plz"])
    feld, gebiet = L["gebiet"]
    print("== Profil ==")
    print(json.dumps({k: profil.get(k) for k in ("laender", feld, "sprache", "cpv")}, ensure_ascii=False))
    pruefe(profil.get("sprache") == code, f"Profil: KI-Sprache {code} (nur dieses Land gesucht)", fehler)
    pruefe(profil.get(feld) == sorted(gebiet), f"Profil: Suchgebiet {feld}", fehler)

    print("\n== Quelle ==")
    alle = []
    for i in range(1, tage + 1):
        tag = (date.today() - timedelta(days=i)).isoformat()
        r = L["quelle"].releases(tag)
        print(f"{tag}: {len(r)} Aufrufe zum Wettbewerb")
        alle += [(tag, x) for x in r]
    pruefe(len(alle) > 0, "Quelle liefert Bekanntmachungen", fehler)
    im_gebiet = [(t, r) for t, r in alle if im_suchgebiet(profil, r)]
    kandidaten = []
    for tag, rel in im_gebiet:
        t = rel.get("tender") or {}
        punkte, grund = score(profil, f"{t.get('title', '')} {t.get('description', '')}".lower(), cpv_codes(t))
        if punkte:
            kandidaten.append((punkte, tag, rel))
    kandidaten.sort(key=lambda k: -k[0])
    print(f"Im Suchgebiet: {len(im_gebiet)} von {len(alle)}; nach Wörtern/CPV passend: {len(kandidaten)}")
    pruefe(0 < len(im_gebiet) < len(alle), "Gebietsfilter grenzt ein", fehler)
    pruefe(len(kandidaten) > 0, "Passende Reinigungs-Kandidaten gefunden", fehler)
    if not kandidaten:
        sys.exit("Keine Kandidaten – Abbruch")

    print("\n== KI-Bewertung ==")
    auswahl = kandidaten[:8]
    items = [item(n, rel) for n, (_, _, rel) in enumerate(auswahl)]
    bewertungen = ki.score(profil["beschreibung"], items, **sprach_arg(profil))
    for n, b in sorted(bewertungen.items(), key=lambda x: -x[1]["punkte"]):
        print(f"{b['punkte']:>2}/10  {items[n]['titel'][:90]}\n       kurz: {b['kurz']}\n       grund: {b['grund']}")
    pruefe(len(bewertungen) == len(items), "KI bewertet alle Kandidaten", fehler)
    texte = " ".join(b["kurz"] + " " + b["grund"] for b in bewertungen.values())
    pruefe(len(L["sprache"].findall(texte)) >= len(bewertungen) * 2, "Bewertungstexte in der Landessprache", fehler)

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
    pruefe(len(L["sprache"].findall(text or "")) >= 20, "Steckbrief: Inhalt in der Landessprache", fehler)

    print("\n== Morgenmail (nur erzeugt, nicht verschickt) ==")
    frist_text = (rel["tender"].get("tenderPeriod") or {}).get("endDate")
    frist = datetime.fromisoformat(frist_text) if frist_text else None
    neu = [(f"v{n}", items[n]["titel"], bewertungen.get(n, {}).get("punkte"), frist if n == bester else None) for n in range(len(items))]
    m = mail.nachricht("test@example.invalid", L["name"], neu, [("v0", items[bester]["titel"], frist or datetime.now(timezone.utc) + timedelta(days=5))], [], code, L["zone"])
    print("Betreff:", m["Subject"])
    inhalt = m.get_body(preferencelist=("plain",)).get_content()
    print(inhalt)
    pruefe(m["Subject"].startswith(L["betreff"]), "Mail: Betreff in der Landessprache", fehler)
    pruefe("Ausschreibung" not in inhalt and "Frist" not in inhalt, "Mail: kein Deutsch im Text", fehler)

    print(f"\nKI-Kosten dieses Laufs: {ki.kosten():.3f} $")
    print("ERGEBNIS: " + ("ALLES OK" if not fehler else "FEHLT: " + "; ".join(fehler)))
    if fehler:
        sys.exit(1)


if __name__ == "__main__":
    main(max(1, min(10, int(sys.argv[1]) if len(sys.argv) > 1 else 4)), sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] in LAENDER else "fr")
