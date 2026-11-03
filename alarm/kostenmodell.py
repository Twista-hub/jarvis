"""AI cost model per firm size and plan (docs/ki-kosten-plaene.md). Pure calculation, no API or database.

Unit costs are the values measured on 03.11.2026 (durchspielen-ki.yml, ki-kosten-auswertung.yml). When prices or
models change, adjust STUECK and run `python3 alarm/kostenmodell.py` to print the tables for the document again.
"""

EUR_JE_USD = 0.90          # cautious rate, as in docs/abos.md
OHNE_VORSTEUER = 1.19      # small business (§ 19 UStG): no input tax, reverse charge on the API invoice

# Measured cost per unit in $ (03.11.2026).
STUECK = {
    "bewertung": 0.002,          # one candidate, Haiku pre-filter + Sonnet, batch (direct: 0.0037)
    "kurzsteckbrief": 0.07,      # from the notice, daily alarm, at most 4 per firm and day
    "steckbrief": 1.80,          # from uploaded documents, Opus: 1.18 (3 PDFs) to 2.45 (16 files)
    "beleg": 0.0003,             # receipt reader, Haiku
    "nachweis": 0.0003,          # proof/certificate reader, Haiku
    "einrichtung": 1.20 / 12,    # firm research 0.24 + first run about 0.96, spread over 12 months
}
STECKBRIEF_MAX = 2.45            # largest measured Steckbrief (16 files)

# Usage per month: normal = typical month, voll = full load (team works with the app every day, many bids).
GROESSEN = {
    "1–5 MA": {
        "plan": "Basis", "standorte": 1,
        "normal": {"bewertung": 300, "kurzsteckbrief": 20, "steckbrief": 2, "beleg": 20, "nachweis": 5},
        "voll": {"bewertung": 900, "kurzsteckbrief": 60, "steckbrief": 5, "beleg": 60, "nachweis": 15},
    },
    "10 MA": {
        "plan": "Pro", "standorte": 1,
        "normal": {"bewertung": 600, "kurzsteckbrief": 40, "steckbrief": 4, "beleg": 60, "nachweis": 20},
        "voll": {"bewertung": 1500, "kurzsteckbrief": 100, "steckbrief": 10, "beleg": 150, "nachweis": 40},
    },
    "100 MA": {
        "plan": "Business", "standorte": 4,
        "normal": {"bewertung": 2000, "kurzsteckbrief": 90, "steckbrief": 12, "beleg": 300, "nachweis": 120},
        "voll": {"bewertung": 5000, "kurzsteckbrief": 120, "steckbrief": 35, "beleg": 1000, "nachweis": 300},
    },
    "1000 MA": {
        "plan": "Business", "standorte": 20,
        "normal": {"bewertung": 6000, "kurzsteckbrief": 120, "steckbrief": 30, "beleg": 2000, "nachweis": 800},
        "voll": {"bewertung": 15000, "kurzsteckbrief": 120, "steckbrief": 100, "beleg": 6000, "nachweis": 2000},
    },
}


def euro(dollar: float) -> float:
    """$ from the API invoice -> € cost for the business (rate and missing input tax)."""
    return dollar * EUR_JE_USD * OHNE_VORSTEUER


def kosten(nutzung: dict, stueck: dict | None = None) -> dict:
    """Cost per driver in $ per month, plus 'summe'."""
    s = stueck or STUECK
    teile = {k: n * s[k] for k, n in nutzung.items()}
    teile["einrichtung"] = s["einrichtung"]
    teile["summe"] = sum(teile.values())
    return teile


def stripe(preis: float) -> float:
    return preis * 0.022 + 0.25 if preis else 0.0


# Worst case per plan: every quota used up, every Steckbrief as large as the largest measured one.
# alt = proposal of 02.11.2026 (docs/abos.md), neu = proposal of 03.11.2026 (docs/ki-kosten-plaene.md).
PLAENE = {
    "Free": {"preis": 0, "bewertung": 300, "kurzsteckbrief": 0, "alt": 0, "neu": 0},
    "Basis": {"preis": 59, "bewertung": 600, "kurzsteckbrief": 60, "alt": 5, "neu": 3},
    "Pro": {"preis": 149, "bewertung": 1500, "kurzsteckbrief": 120, "alt": 30, "neu": 15},
    "Business": {"preis": 399, "bewertung": 5000, "kurzsteckbrief": 120, "alt": 100, "neu": 40},
}
INFRA_JE_KUNDE = 1.43  # € gross per paying customer and month (docs/abos.md)


def obergrenze(plan: str, stand: str = "neu") -> dict:
    p = PLAENE[plan]
    ki = euro(p["bewertung"] * STUECK["bewertung"] + p["kurzsteckbrief"] * STUECK["kurzsteckbrief"] + p[stand] * STECKBRIEF_MAX + STUECK["einrichtung"])
    rest = p["preis"] - ki - stripe(p["preis"]) - (INFRA_JE_KUNDE if p["preis"] else 0)
    return {"ki": ki, "rest": rest, "marge": rest / p["preis"] if p["preis"] else None}


def tabelle(stueck: dict | None = None) -> list[str]:
    zeilen = []
    for name, g in GROESSEN.items():
        for fall in ("normal", "voll"):
            k = kosten(g[fall], stueck)
            zeilen.append(f"{name} | {fall} | " + " | ".join(f"{k[x]:.2f}" for x in ("bewertung", "kurzsteckbrief", "steckbrief", "beleg", "nachweis", "einrichtung"))
                          + f" | {k['summe']:.2f} $ | {euro(k['summe']):.2f} €")
    return zeilen


if __name__ == "__main__":
    print("Größe | Fall | Bewertung | Kurz-Steckbrief | Steckbrief | Belege | Nachweise | Einrichtung | Summe $ | Summe €")
    print("\n".join(tabelle()))
    print("\nMit Sonnet statt Opus für Steckbriefe (halber Preis, noch nicht getestet):")
    print("\n".join(tabelle({**STUECK, "steckbrief": STUECK["steckbrief"] / 2})))
    print("\nSteckbrief-Kontingent voll ausgeschöpft (Ø 1,80 $ / größter 2,45 $):")
    for plan, n in (("Basis", 5), ("Pro", 30), ("Business", 100)):
        print(f"{plan} {n}: {euro(n * STUECK['steckbrief']):.0f} € / {euro(n * STECKBRIEF_MAX):.0f} €")
    print("\nPlan | Preis | Kontingent alt -> neu | KI-Obergrenze alt | Rest alt | KI-Obergrenze neu | Rest neu")
    for plan, p in PLAENE.items():
        a, n = obergrenze(plan, "alt"), obergrenze(plan, "neu")
        print(f"{plan} | {p['preis']} € | {p['alt']} -> {p['neu']} | {a['ki']:.0f} € | {a['rest']:.0f} € | {n['ki']:.0f} € | {n['rest']:.0f} €"
              + (f" ({a['marge']:.0%} -> {n['marge']:.0%})" if p["preis"] else ""))
