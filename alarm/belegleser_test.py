"""Quality test of the receipt reader (web/src/belegleser.json: same model, prompt and schema as the app) on the
synthetic receipts from alarm/musterbelege.py. Prints per receipt what was read vs. the truth, a summary per field and
the cost. Saves nothing. Hard cap 0.20 $.
Usage: ANTHROPIC_API_KEY=... python3 alarm/belegleser_test.py <dir with wahrheit.json> [modell]
"""
import base64
import json
import os
import sys

import anthropic

PREISE = {"claude-haiku-5-5": (0.10, 0.50), "claude-sonnet-5-5": (2.0, 10.0)}
LESER = json.load(open(os.path.join(os.path.dirname(__file__), "..", "web", "src", "belegleser.json"), encoding="utf-8"))


def vergleich(gelesen: dict, wahr: dict) -> dict:
    name = lambda s: "".join(c for c in s.lower() if c.isalnum())
    return {
        "datum": gelesen.get("datum") == wahr["datum"],
        "brutto": abs(float(gelesen.get("brutto") or 0) - wahr["brutto"]) < 0.005,
        "ust_satz": gelesen.get("ust_satz") == wahr["ust_satz"],
        "lieferant": name(wahr["lieferant"]).startswith(name(gelesen.get("lieferant", ""))[:6]) and len(name(gelesen.get("lieferant", ""))) >= 4,
        "kategorie": gelesen.get("kategorie") == wahr["kategorie"],
        "gemischt": gelesen.get("gemischt") == wahr["gemischt"],
    }


def main() -> None:
    ordner = sys.argv[1]
    modell = sys.argv[2] if len(sys.argv) > 2 else LESER["modell"]
    wahrheit = json.load(open(os.path.join(ordner, "wahrheit.json"), encoding="utf-8"))
    client = anthropic.Anthropic(max_retries=2)
    kosten, ergebnisse = 0.0, []
    for datei, wahr in wahrheit.items():
        if kosten > 0.20:
            print("Kostengrenze erreicht")
            break
        daten = base64.standard_b64encode(open(os.path.join(ordner, datei), "rb").read()).decode()
        pdf = datei.endswith(".pdf")
        quelle = {"type": "base64", "media_type": "application/pdf" if pdf else "image/jpeg", "data": daten}
        antwort = client.messages.create(
            model=modell, max_tokens=400, system=LESER["system"],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": LESER["schema"]}},
            messages=[{"role": "user", "content": [{"type": "document" if pdf else "image", "source": quelle}, {"type": "text", "text": LESER["frage"]}]}],
        )
        p = PREISE[modell]
        kosten += (antwort.usage.input_tokens * p[0] + antwort.usage.output_tokens * p[1]) / 1e6
        text = "".join(b.text for b in antwort.content if b.type == "text")
        gelesen = json.loads(text) if text else {}
        v = vergleich(gelesen, wahr)
        ergebnisse.append((datei, wahr, gelesen, v))
        fehler = [k for k, ok in v.items() if not ok]
        print(f"{'✅' if not fehler else '⚠️'} {datei} (Stärke {wahr['staerke']}, {antwort.usage.input_tokens} Tokens): "
              f"{gelesen.get('datum')} | {gelesen.get('lieferant')} | {gelesen.get('brutto')} | {gelesen.get('ust_satz')} % | {gelesen.get('kategorie')} | sicher={gelesen.get('sicher')}"
              + (f"  ← falsch: {', '.join(f'{k} (richtig: {wahr[k]})' for k in fehler)}" if fehler else ""))
    n = len(ergebnisse)
    print(f"\nModell {modell}, {n} Belege, Kosten {kosten:.4f} $ ({kosten / max(n, 1) * 100:.3f} Cent pro Beleg)")
    for feld in ("datum", "brutto", "ust_satz", "lieferant", "kategorie", "gemischt"):
        print(f"  {feld:<10} {sum(r[3][feld] for r in ergebnisse)}/{n}")
    kern = sum(r[3]["datum"] and r[3]["brutto"] and r[3]["ust_satz"] for r in ergebnisse)
    print(f"  Datum+Betrag+Steuersatz alle richtig: {kern}/{n}")
    falsch_sicher = sum(r[2].get("sicher") and not (r[3]["datum"] and r[3]["brutto"]) for r in ergebnisse)
    print(f"  'sicher' gemeldet, aber Datum oder Betrag falsch: {falsch_sicher}")


if __name__ == "__main__":
    main()
