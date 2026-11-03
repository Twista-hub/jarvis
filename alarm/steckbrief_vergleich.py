"""Quality comparison Opus 5.5 vs. Sonnet 5.5 for the Steckbrief (docs/ki-kosten-plaene.md, Benjamin's OK 03.11.2026).

Both models get exactly the same instructions and input as in production:
- notices: open notices from oeffentlichevergabe.de (CC0) as the daily alarm builds them (full eForms notice),
- documents: the public Bundesbank tender in alarm/test-unterlagen (text via pdftotext, bundled like web/src/bundle.ts).
A third call (Opus, blind: the two Steckbriefe in random order as A and B) checks both against the source text and
lists wrong facts and important gaps. Nothing is saved in the database. The log shows numbers and the judged errors (public tenders
only); the full texts go to the workflow artifact. Hard cost cap: GRENZE_DOLLAR (default 4 $), checked before every call.

CLI: python3 steckbrief_vergleich.py <notices 0-10> <documents: keine|kern|alle> <out-dir>
"""
import json
import os
import random
import re
import subprocess
import sys
import time
from pathlib import Path

import anthropic

import ki
from alarm import eforms_text, item

OPUS, SONNET = "claude-opus-5-5", "claude-sonnet-5-5"
GRENZE = float(os.environ.get("GRENZE_DOLLAR") or "4")
client = anthropic.Anthropic(max_retries=2)
kosten = {"gesamt": 0.0}

# Broad facility/staffing firm, so that every test notice is relevant (same style as a real search profile).
KUNDE = ("Rheinland Facility Service GmbH, Düsseldorf, 140 Beschäftigte, Standorte Düsseldorf, Köln, Aachen. Leistungen: "
         "Unterhalts- und Glasreinigung, Objekt- und Veranstaltungsschutz (Sicherheitsdienst §34a), Hausmeister- und "
         "Winterdienst, Grünpflege, Arbeitnehmerüberlassung (Erlaubnis nach AÜG) für Empfang, Service und Logistik, "
         "Catering-Service für Veranstaltungen. Tarifbindung Gebäudereinigung und Sicherheit NRW. Aufträge in ganz NRW.")
MUSTER = ["reinigung", "bewachung|sicherheitsdienst|wachdienst", "arbeitnehmerüberlassung|personaldienstleist|zeitarbeit",
          "hausmeister", "winterdienst", "catering|verpflegung|speisen", "grünpflege|grünanlagen|grünflächen", "empfang|pforte"]

URTEIL_SCHEMA = {
    "type": "object",
    "properties": {
        **{f"steckbrief_{x}": {
            "type": "object",
            "properties": {
                "falsche_angaben": {"type": "array", "items": {"type": "object", "properties": {
                    "angabe": {"type": "string"}, "laut_quelle": {"type": "string"}, "schwer": {"type": "boolean"}},
                    "required": ["angabe", "laut_quelle", "schwer"], "additionalProperties": False}},
                "wichtige_luecken": {"type": "array", "items": {"type": "string"}},
                "punkte": {"type": "integer"},
            },
            "required": ["falsche_angaben", "wichtige_luecken", "punkte"], "additionalProperties": False,
        } for x in ("a", "b")},
        "besser": {"type": "string", "enum": ["A", "B", "gleich"]},
        "begruendung": {"type": "string"},
    },
    "required": ["steckbrief_a", "steckbrief_b", "besser", "begruendung"], "additionalProperties": False,
}
PRUEFER = """Du prüfst zwei Steckbriefe (A und B) zu derselben öffentlichen Ausschreibung gegen die Quelle.
Ein Steckbrief soll einer Firma schnell sagen: worum es geht, Fristen, Lose und Mengen, Eignung und Nachweise,
Zuschlagskriterien, Vertragslaufzeit, Risiken und ob die Ausschreibung zur Firma passt.
Prüfe für A und B getrennt, nur gegen die Quelle:
- falsche_angaben: jede Angabe, die der Quelle widerspricht oder dort nicht steht (erfunden). schwer=true, wenn sie
  zu einer falschen Entscheidung oder einem Ausschluss führen könnte (Frist, Los, Menge, Pflichtnachweis, Kriterium).
  „nicht angegeben“, obwohl es in der Quelle steht, ist eine Lücke, keine falsche Angabe.
- wichtige_luecken: wichtige Angaben aus der Quelle, die im Steckbrief fehlen (nur wirklich entscheidungsrelevante).
- punkte: Gesamtnutzen für die Firma 1–10 (Richtigkeit zählt am meisten, dann Vollständigkeit, dann Klarheit).
Dann besser = A, B oder gleich (gleich, wenn kein für die Entscheidung wichtiger Unterschied besteht).
Länge allein ist kein Vorteil. Antworte nur mit dem JSON."""


def preis(usage, model: str) -> float:
    p = ki.PREISE[model]
    eingabe = usage.input_tokens + (usage.cache_creation_input_tokens or 0) + (usage.cache_read_input_tokens or 0)
    return (eingabe * p[0] + usage.output_tokens * p[1]) / 1e6


def bremse(naechste: float) -> None:
    if kosten["gesamt"] + naechste > GRENZE:
        raise SystemExit(f"Kostengrenze {GRENZE} $ wäre überschritten (bisher {kosten['gesamt']:.2f} $), Abbruch.")


def schaetzung(text: str, model: str, ausgabe: int) -> float:
    p = ki.PREISE[model]
    return (len(text) / 3 * p[0] + ausgabe * p[1]) / 1e6


def steckbrief(model: str, user: str) -> dict:
    bremse(schaetzung(user, model, 8000))
    t = time.time()
    with client.beta.messages.stream(model=model, betas=["server-side-fallback-2026-07-01"], fallbacks="default",
                                     max_tokens=32000, output_config={"effort": "medium"}, system=ki.anleitung("de"),
                                     messages=[{"role": "user", "content": user}]) as s:
        m = s.get_final_message()
    k = preis(m.usage, model)
    kosten["gesamt"] += k
    text = "\n".join(b.text for b in m.content if b.type == "text").strip()
    return {"text": text, "kosten": k, "sekunden": round(time.time() - t), "eingabe": m.usage.input_tokens,
            "ausgabe": m.usage.output_tokens, "abgelehnt": m.stop_reason == "refusal"}


def urteil(quelle: str, a: str, b: str) -> dict:
    inhalt = f"QUELLE:\n{quelle}\n\n===== STECKBRIEF A\n{a}\n\n===== STECKBRIEF B\n{b}"
    bremse(schaetzung(inhalt, OPUS, 4000))
    m = client.beta.messages.create(model=OPUS, betas=["server-side-fallback-2026-07-01"], fallbacks="default",
                                    max_tokens=16000, system=PRUEFER,
                                    output_config={"effort": "medium", "format": {"type": "json_schema", "schema": URTEIL_SCHEMA}},
                                    messages=[{"role": "user", "content": inhalt}])
    kosten["gesamt"] += preis(m.usage, OPUS)
    return json.loads(next(b.text for b in m.content if b.type == "text"))


def bekanntmachungen(anzahl: int) -> list[dict]:
    from profile_db import verbinden
    faelle = []
    with verbinden() as c:
        c.execute("set transaction read only")
        for muster in MUSTER[:anzahl]:
            row = c.execute("""select roh from public.vergabekatalog where quelle = 'bks' and status in ('offen', 'unbekannt')
                               and (frist is null or frist > now()) and titel ~* %s
                               order by quell_datum desc limit 1""", (muster,)).fetchone()
            if not row:
                print(f"Keine offene Bekanntmachung für „{muster}“")
                continue
            rel = row[0]
            voll = eforms_text(rel)  # like the alarm: without eForms only the OCDS summary
            kopf = json.dumps(item(0, rel), ensure_ascii=False)
            dokumente = ("Nur die öffentliche Bekanntmachung, keine Vergabeunterlagen.\n"
                         + (f"Vollständige Bekanntmachung (eForms, Feldname: Wert):\n{voll}\n\n" if voll else "")
                         + "Kurzfassung (OCDS):\n" + json.dumps(rel, ensure_ascii=False)[:40000])
            faelle.append({"name": f"Bekanntmachung {muster.split('|')[0]}" + ("" if voll else " (ohne eForms)"), "quelle": dokumente,
                           "user": f"Kunde:\n{KUNDE}\n\nAusschreibung:\n{kopf}\n\nVergabeunterlagen:\n{dokumente}"})
    return faelle


def unterlagen(auswahl: str) -> list[dict]:
    if auswahl == "keine":
        return []
    ordner = Path(__file__).parent / "test-unterlagen" / "dtvp-CXP4Y63M3X1"
    pdfs = sorted(p for p in ordner.glob("*.pdf") if auswahl == "alle" or re.match(r"(A0|B0|B5)_", p.name))
    skip = re.compile(r"tarifvertrag|verpflichtungserkl|sanktion|datenschutz|kennzettel", re.I)
    erst = re.compile(r"leistungsbeschreibung|leistungsverzeichnis|aufforderung|verg(ü|ue)tung|preisblatt|preis|^b0|^a0", re.I)
    teile, gesamt = [], 0
    for p in sorted(pdfs, key=lambda p: (0 if erst.search(p.name) else 1, p.name)):  # same order and limits as bundle.ts
        if skip.search(p.name):
            continue
        text = subprocess.run(["pdftotext", "-layout", str(p), "-"], capture_output=True, text=True).stdout
        text = re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t]{2,}", " ", text)).strip()
        platz = min(350_000 - gesamt, 80_000)
        if platz < 2000 or not text:
            continue
        text = text[:platz]
        teile.append(f"===== DATEI: {p.name}\n{text}")
        gesamt += len(text)
    dokumente = "\n\n".join(teile)
    titel = "Servicepersonal für Kongresse und Veranstaltungen (Arbeitnehmerüberlassung), Deutsche Bundesbank"
    return [{"name": f"Unterlagen Bundesbank ({len(teile)} PDFs)", "quelle": dokumente,
             "user": f"Kunde:\n{KUNDE}\n\nAusschreibung (Angaben des Kunden):\n{titel}\n\nVergabeunterlagen:\n{dokumente}"}]


def main() -> None:
    anzahl, auswahl, out = int(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    out.mkdir(parents=True, exist_ok=True)
    faelle = unterlagen(auswahl) + bekanntmachungen(anzahl)
    rnd = random.Random(20261103)
    ergebnis = []
    print(f"{len(faelle)} Fälle, Kostengrenze {GRENZE} $")
    for nr, f in enumerate(faelle, 1):
        try:
            o, s = steckbrief(OPUS, f["user"]), steckbrief(SONNET, f["user"])
            opus_ist_a = rnd.random() < 0.5
            u = urteil(f["quelle"], *((o["text"], s["text"]) if opus_ist_a else (s["text"], o["text"])))
        except SystemExit as e:
            print(e)
            break
        uo, us = (u["steckbrief_a"], u["steckbrief_b"]) if opus_ist_a else (u["steckbrief_b"], u["steckbrief_a"])
        besser = {"gleich": "gleich", "A": "Opus" if opus_ist_a else "Sonnet", "B": "Sonnet" if opus_ist_a else "Opus"}[u["besser"]]
        zeile = {"fall": f["name"], "zeichen_quelle": len(f["quelle"]), "besser": besser, "begruendung": u["begruendung"]}
        for name, r, v in (("opus", o, uo), ("sonnet", s, us)):
            zeile[name] = {"kosten": round(r["kosten"], 4), "sekunden": r["sekunden"], "zeichen": len(r["text"]),
                           "punkte": v["punkte"], "falsch": len(v["falsche_angaben"]),
                           "falsch_schwer": sum(x["schwer"] for x in v["falsche_angaben"]), "luecken": len(v["wichtige_luecken"])}
        ergebnis.append(zeile)
        (out / f"{nr:02d}-opus.md").write_text(o["text"], encoding="utf-8")
        (out / f"{nr:02d}-sonnet.md").write_text(s["text"], encoding="utf-8")
        (out / f"{nr:02d}-urteil.json").write_text(json.dumps({"fall": f["name"], "opus": uo, "sonnet": us, "besser": besser,
                                                              "begruendung": u["begruendung"]}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{nr}. {f['name']} ({len(f['quelle'])} Zeichen) → besser: {besser}")
        for name in ("opus", "sonnet"):
            z = zeile[name]
            print(f"   {name:6} {z['kosten']:.3f} $ {z['sekunden']:4d} s  Punkte {z['punkte']:2d}  falsch {z['falsch']} (schwer {z['falsch_schwer']})  Lücken {z['luecken']}")
            v = uo if name == "opus" else us
            for x in v["falsche_angaben"]:
                print(f"      {'‼' if x['schwer'] else '–'} falsch: {x['angabe'][:160]} | Quelle: {x['laut_quelle'][:160]}")
            for x in v["wichtige_luecken"]:
                print(f"      · fehlt: {x[:160]}")
        print(f"   Urteil: {u['begruendung'][:400]}")
    (out / "ergebnis.json").write_text(json.dumps(ergebnis, ensure_ascii=False, indent=1), encoding="utf-8")
    if ergebnis:
        summe = lambda n, k: sum(z[n][k] for z in ergebnis)  # noqa: E731
        print(f"\nSumme über {len(ergebnis)} Fälle:")
        for n in ("opus", "sonnet"):
            print(f"  {n:6} Kosten {summe(n, 'kosten'):.2f} $  Ø Punkte {summe(n, 'punkte') / len(ergebnis):.1f}  "
                  f"falsch {summe(n, 'falsch')} (schwer {summe(n, 'falsch_schwer')})  Lücken {summe(n, 'luecken')}  Ø {summe(n, 'sekunden') // len(ergebnis)} s")
        print("  besser: " + ", ".join(f"{k} {sum(z['besser'] == k for z in ergebnis)}" for k in ("Opus", "Sonnet", "gleich")))
    print(f"Gesamtkosten inkl. Prüfung: {kosten['gesamt']:.2f} $")


if __name__ == "__main__":
    main()
