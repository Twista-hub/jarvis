"""Quality comparison for cheaper AI scoring (read-only: saves no ratings, writes nothing to the database).

Takes notices the production model (Sonnet 5.5, method score-v2) already rated for a firm, rates the same notices again
with Haiku 5.5 using the identical prompt, and compares: do the same notices pass (>= 6 points)? How many Sonnet hits
would a Haiku pre-filter (>= 4) let through? What does it cost? Hard cap on spend per run.
Usage: SUPABASE_DB_PASSWORD=... ANTHROPIC_API_KEY=... python3 alarm/ki_vergleich.py [notices per firm, default 80]
"""
import json
import random
import sys

import anthropic

import katalog
import ki
import profile_db
from alarm import item, sprach_arg

HAIKU = "claude-haiku-5-5"
PREIS = (0.10, 0.50)  # $ per million input / output tokens (prompts under 100K tokens)
GRENZE = 0.50  # $ hard cap for the whole comparison
client = anthropic.Anthropic(max_retries=2)
kosten = [0.0]


def haiku_score(beschreibung: str, items: list[dict], sprache: str = "de") -> dict[int, dict]:
    system = ki.score_system(sprache)
    r = client.messages.create(model=HAIKU, max_tokens=min(16000, max(1024, len(items) * 280 + 256)), system=system,
                               output_config={"effort": "low", "format": {"type": "json_schema", "schema": ki.SCORE_SCHEMA}},
                               messages=[{"role": "user", "content": ki.bewertung_inhalt(beschreibung, items)}])
    u = r.usage
    kosten[0] += ((u.input_tokens + (u.cache_creation_input_tokens or 0) * 1.25 + (u.cache_read_input_tokens or 0) * 0.1) * PREIS[0] + u.output_tokens * PREIS[1]) / 1e6
    if r.stop_reason == "refusal":
        return {}
    return {b["nr"]: b for b in json.loads(next(b.text for b in r.content if b.type == "text"))["bewertungen"]}


def stichprobe(profil: dict, n: int) -> list[tuple[dict, dict]]:
    with profile_db.verbinden() as con:
        con.execute("set transaction read only")
        rows = con.execute("""select b.ergebnis, k.roh, k.id, k.version from jarvis_katalog.bewertungen b
            join public.vergabekatalog k on k.id = b.katalog_id
            where b.firma_id = %s and b.profil_version = %s and b.methode = %s""",
                           (profil["firma_id"], katalog.profil_version(profil), katalog.BEWERTUNG_METHODE)).fetchall()
    paare = [(e, dict(rel, _katalog_id=kid, _katalog_version=v)) for e, rel, kid, v in rows]
    random.Random(7).shuffle(paare)
    treffer = [p for p in paare if p[0].get("punkte", 0) >= 6][: n // 2]
    rest = [p for p in paare if p[0].get("punkte", 0) < 6][: n - len(treffer)]
    return treffer + rest


def main(n: int) -> None:
    gesamt = {"paare": 0, "s_treffer": 0, "h6": 0, "h4": 0, "fp": 0, "rest_raus": 0, "rest": 0, "diff": 0}
    verteilung = {"treffer": [0] * 11, "rest": [0] * 11}  # Haiku points of Sonnet hits / non-hits
    for name, profil in profile_db.laden().items():
        if not profil.get("firma_id") or profil.get("zusatz"):
            continue
        paare = stichprobe(profil, n)
        if not paare:
            continue
        print(f"\n## {profil['name']}: {len(paare)} bereits bewertete Ausschreibungen")
        abweichungen = []
        for anfang in range(0, len(paare), 8):
            if kosten[0] >= GRENZE:
                print(f"Kostengrenze {GRENZE} $ erreicht")
                break
            stapel = paare[anfang:anfang + 8]
            h = haiku_score(profil["beschreibung"], [item(i, p[1]) for i, p in enumerate(stapel)], **sprach_arg(profil))
            for i, (sonnet, rel) in enumerate(stapel):
                if i not in h:
                    continue
                s, hp = sonnet.get("punkte", 0), h[i]["punkte"]
                gesamt["paare"] += 1
                gesamt["diff"] += abs(s - hp)
                verteilung["treffer" if s >= 6 else "rest"][max(0, min(10, hp))] += 1
                if s >= 6:
                    gesamt["s_treffer"] += 1
                    gesamt["h6"] += hp >= 6
                    gesamt["h4"] += hp >= 4
                else:
                    gesamt["rest"] += 1
                    gesamt["fp"] += hp >= 6
                    gesamt["rest_raus"] += hp < 4
                if (s >= 6) != (hp >= 6):
                    abweichungen.append(f"- Sonnet {s}, Haiku {hp}: {(rel.get('tender') or {}).get('title', '')[:90]} | Haiku: {h[i]['grund'][:140]}")
        print("\n".join(abweichungen[:12]) or "- keine Abweichung beim Schwellenwert 6")
    g = gesamt
    if not g["paare"]:
        sys.exit("Keine gespeicherten Bewertungen gefunden")
    print(f"\n# Ergebnis ({g['paare']} Ausschreibungen, Haiku-Kosten {kosten[0]:.3f} $)")
    print(f"Sonnet-Treffer (>= 6): {g['s_treffer']}; davon Haiku >= 6: {g['h6']} ({g['h6'] / max(1, g['s_treffer']):.0%}), Haiku >= 4: {g['h4']} ({g['h4'] / max(1, g['s_treffer']):.0%})")
    print(f"Sonnet-Nicht-Treffer: {g['rest']}; Haiku fälschlich >= 6: {g['fp']}; Haiku < 4 (Vorfilter würde aussortieren): {g['rest_raus']} ({g['rest_raus'] / max(1, g['rest']):.0%})")
    print(f"Mittlere Abweichung der Punkte: {g['diff'] / g['paare']:.2f}")
    for schwelle in (2, 3, 4, 5):
        behalten = sum(verteilung["treffer"][schwelle:])
        raus = sum(verteilung["rest"][:schwelle])
        print(f"Vorfilter Haiku >= {schwelle}: {behalten}/{g['s_treffer']} Sonnet-Treffer behalten, {raus}/{g['rest']} Nicht-Treffer aussortiert")


if __name__ == "__main__":
    main(max(8, min(160, int(sys.argv[1]) if len(sys.argv) > 1 else 80)))
