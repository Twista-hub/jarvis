"""Claude: score tender hits for a customer profile and write tender profiles (Steckbriefe).

Uses the official Anthropic SDK; the key comes from ANTHROPIC_API_KEY.
"""
import json
import os
import time
from pathlib import Path
import katalog

import anthropic

# Cost per task (30.10.2026, Benjamin): the daily scoring of hundreds of short tender texts runs on Sonnet 5.5
# (half the price of Opus); the Steckbrief reads long tender documents and stays on Opus 5.5.
MODEL = "claude-opus-5-5"
MODEL_BEWERTEN = "claude-sonnet-5-5"
MODEL_VORFILTER = "claude-haiku-5-5"
# $ per million tokens: input, output, cache read. Cache writes (5-minute entries) cost 1.25x input.
PREISE = {"claude-opus-5-5": (4.0, 20.0, 0.20), "claude-sonnet-5-5": (2.0, 10.0, 0.20), "claude-haiku-5-5": (0.10, 0.50, 0.01)}
CACHE_SCHREIBEN = 1.25
# Pre-filter (ki_vergleich.py, 03.11.2026): Haiku rates every candidate first with the identical prompt; only notices
# it gives at least VORFILTER_SCHWELLE points go to Sonnet, whose rating stays the final one. Clear misfits keep Haiku's
# rating. 0 switches the pre-filter off.
VORFILTER_SCHWELLE = int(os.environ.get("KI_VORFILTER", "3"))
# Message Batches (50 % price on every token): the daily rating of all batches of one profile goes out as one batch and is
# collected when ready. Off by default (results can take minutes to hours; the alarm must start early enough before the
# morning mail). KI_BATCH=1 switches it on; after KI_BATCH_MINUTEN without a result the run falls back to direct calls.
BATCH = os.environ.get("KI_BATCH", "0") == "1"
BATCH_MINUTEN = int(os.environ.get("KI_BATCH_MINUTEN", "50"))
BATCH_RABATT = 0.5
LIMIT = float(os.environ.get("KI_LIMIT_DOLLAR", "3"))  # hard stop per run
client = anthropic.Anthropic(max_retries=0)
_kosten = [0.0]
_cache = [0, 0]  # tokens read from / written to the prompt cache in this run (log line at the end of alarm.py)
# The firm the next requests are for (N6: AI costs per firm in the app); set by alarm.py per search profile.
FIRMA: list = [None]


def kosten() -> float:
    return _kosten[0]


def cache_stand() -> str:
    return f"Prompt-Cache: {_cache[0]} Tokens gelesen, {_cache[1]} geschrieben"


def _zaehlen(usage, model: str = MODEL, faktor: float = 1.0) -> None:
    preis = tuple(x * faktor for x in PREISE[model])
    eingabe = usage.input_tokens * preis[0] + (usage.cache_creation_input_tokens or 0) * preis[0] * CACHE_SCHREIBEN \
        + (usage.cache_read_input_tokens or 0) * preis[2]
    _kosten[0] += (eingabe + usage.output_tokens * preis[1]) / 1e6
    _cache[0] += usage.cache_read_input_tokens or 0
    _cache[1] += usage.cache_creation_input_tokens or 0


def _bremse() -> bool:
    if _kosten[0] >= LIMIT:
        print(f"KI-Limit {LIMIT} $ erreicht, keine weiteren Anfragen.")
        return True
    return False

SCORE_SCHEMA = {
    "type": "object",
    "properties": {
        "bewertungen": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "nr": {"type": "integer"},
                    "punkte": {"type": "integer"},
                    "kurz": {"type": "string"},
                    "grund": {"type": "string"},
                },
                "required": ["nr", "punkte", "kurz", "grund"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["bewertungen"],
    "additionalProperties": False,
}


def _reservieren(kwargs):
    # Byte length bounds input tokens. Account for the most expensive configured fallback.
    body = json.dumps(kwargs, ensure_ascii=False)
    worst = (len(body.encode()) * 5 + kwargs.get("max_tokens", 32000) * 20) / 1e6
    try:
        reservierung = katalog.reservieren(round(worst + 0.0001, 4), "alarm", FIRMA[0])
        if not reservierung:
            print("KI-Budget reicht für diese Anfrage nicht; keine API-Anfrage. Nur eindeutige Wort-/Leistungstreffer bleiben sichtbar.")
        return reservierung
    except Exception as e:
        print(f"Zentrales KI-Budget nicht prüfbar ({type(e).__name__}); API-Anfrage übersprungen.")
        return None


def _create(model: str = MODEL_BEWERTEN, **kwargs):
    reservierung = _reservieren(kwargs)
    if not reservierung:
        return None
    vorher = kosten()
    if model == MODEL_VORFILTER:
        # Haiku has no server-side fallback; a decline simply sends the batch on to Sonnet.
        response = client.messages.create(model=model, **kwargs)
    else:
        # fallbacks="default": a safety decline is retried server-side on Anthropic's recommended model.
        response = client.beta.messages.create(model=model, betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs)
    _zaehlen(response.usage, model)
    katalog.abschliessen(reservierung, kosten() - vorher)
    return response


def bewertung_inhalt(beschreibung: str, items: list[dict]) -> list[dict]:
    """Same text as before, split in two blocks: the customer part (identical for every batch of one profile) is cached,
    so batches 2, 3, … of a run read system prompt and customer description at a tenth of the price."""
    return [{"type": "text", "text": f"Kunde:\n{beschreibung}\n\n", "cache_control": {"type": "ephemeral"}},
            {"type": "text", "text": "Ausschreibungen:\n" + json.dumps(items, ensure_ascii=False)}]


def score(beschreibung: str, items: list[dict], sprache: str = "de") -> dict[int, dict]:
    """items: [{nr, titel, auftraggeber, ort, beschreibung, cpv}] -> {nr: {punkte, kurz, grund}}"""
    if not items or _bremse():
        return {}
    vorab: dict[int, dict] = {}
    if VORFILTER_SCHWELLE:
        vorab = _bewerten(MODEL_VORFILTER, beschreibung, items, sprache) or {}
        if not vorab and _bremse():
            return {}
    weiter = [x for x in items if vorab.get(x["nr"], {}).get("punkte", 10) >= VORFILTER_SCHWELLE]
    ergebnis = {nr: dict(b, vorfilter=True) for nr, b in vorab.items() if b.get("punkte", 10) < VORFILTER_SCHWELLE}
    if weiter:
        # Sonnet sees the remaining notices numbered 0..n like before, the numbers are mapped back afterwards.
        neu = _bewerten(MODEL_BEWERTEN, beschreibung, [dict(x, nr=i) for i, x in enumerate(weiter)], sprache)
        if neu is None:
            return ergebnis  # the clear misfits are rated; the rest is retried in the next run
        ergebnis.update({weiter[i]["nr"]: dict(b, nr=weiter[i]["nr"]) for i, b in neu.items() if 0 <= i < len(weiter)})
    return ergebnis


def _bewerten(model: str, beschreibung: str, items: list[dict], sprache: str) -> dict[int, dict] | None:
    response = _create(
        model=model,
        max_tokens=min(16000, max(1024, len(items) * 280 + 256)),
        system=score_system(sprache),
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCORE_SCHEMA}},
        messages=[{"role": "user", "content": bewertung_inhalt(beschreibung, items)}],
    )
    if response is None or response.stop_reason == "refusal":
        return None
    text = next(b.text for b in response.content if b.type == "text")
    return {b["nr"]: b for b in json.loads(text)["bewertungen"]}


def _anfrage(model: str, beschreibung: str, items: list[dict], sprache: str) -> dict:
    return {"model": model, "max_tokens": min(16000, max(1024, len(items) * 280 + 256)), "system": score_system(sprache),
            "output_config": {"effort": "low", "format": {"type": "json_schema", "schema": SCORE_SCHEMA}},
            "messages": [{"role": "user", "content": bewertung_inhalt(beschreibung, items)}]}


def _batch(model: str, beschreibung: str, pakete: list[list[dict]], sprache: str) -> list[dict[int, dict] | None] | None:
    """One Message Batch for several packages of the same profile; per package the ratings (None = declined/failed).
    None for the whole call when the budget, the batch or the waiting time fails (the caller then rates directly)."""
    anfragen = [_anfrage(model, beschreibung, items, sprache) for items in pakete]
    reservierung = _reservieren({"max_tokens": sum(a["max_tokens"] for a in anfragen), "messages": [a["messages"] for a in anfragen],
                                 "system": anfragen[0]["system"] if anfragen else ""})
    if not reservierung:
        return None
    vorher = kosten()
    try:
        b = client.messages.batches.create(requests=[{"custom_id": f"p{i}", "params": a} for i, a in enumerate(anfragen)])
        ende = time.monotonic() + BATCH_MINUTEN * 60
        while b.processing_status != "ended":
            if time.monotonic() > ende:
                client.messages.batches.cancel(b.id)
                print(f"Batch {b.id} nach {BATCH_MINUTEN} Minuten nicht fertig: abgebrochen, direkte Bewertung.")
                katalog.abschliessen(reservierung, kosten() - vorher)
                return None
            time.sleep(30)
            b = client.messages.batches.retrieve(b.id)
        ergebnis: list[dict[int, dict] | None] = [None] * len(anfragen)
        for r in client.messages.batches.results(b.id):
            if r.result.type != "succeeded":
                continue
            m = r.result.message
            _zaehlen(m.usage, model, BATCH_RABATT)
            if m.stop_reason == "refusal":
                continue
            text = next((x.text for x in m.content if x.type == "text"), "")
            ergebnis[int(r.custom_id[1:])] = {x["nr"]: x for x in json.loads(text)["bewertungen"]}
    except Exception as e:  # noqa: BLE001 – the direct path still works
        print(f"Batch nicht möglich ({type(e).__name__}), direkte Bewertung.")
        katalog.abschliessen(reservierung, kosten() - vorher)
        return None
    katalog.abschliessen(reservierung, kosten() - vorher)
    return ergebnis


def score_viele(beschreibung: str, pakete: list[list[dict]], sprache: str = "de") -> list[dict[int, dict]]:
    """Like score() for many packages at once via the Batch API (pre-filter batch, then Sonnet batch). Packages whose
    batch result is missing are rated directly, so the outcome equals score() per package."""
    if not pakete or _bremse():
        return [{} for _ in pakete]
    vorab = _batch(MODEL_VORFILTER, beschreibung, pakete, sprache) if VORFILTER_SCHWELLE else [{} for _ in pakete]
    if vorab is None:
        return [score(beschreibung, items, sprache) for items in pakete]
    weiter = [[x for x in items if (v or {}).get(x["nr"], {}).get("punkte", 10) >= VORFILTER_SCHWELLE] for items, v in zip(pakete, vorab)]
    nummern = [i for i, w in enumerate(weiter) if w]
    neu = _batch(MODEL_BEWERTEN, beschreibung, [[dict(x, nr=j) for j, x in enumerate(weiter[i])] for i in nummern], sprache) if nummern else []
    ergebnisse = []
    for i, items in enumerate(pakete):
        e = {nr: dict(b, vorfilter=True) for nr, b in (vorab[i] or {}).items() if b.get("punkte", 10) < VORFILTER_SCHWELLE}
        if weiter[i]:
            antwort = neu[nummern.index(i)] if neu is not None else None
            if antwort is None:  # no batch result: rate the remaining notices directly (renumbered back inside score)
                antwort = _bewerten(MODEL_BEWERTEN, beschreibung, [dict(x, nr=j) for j, x in enumerate(weiter[i])], sprache) or {}
            e.update({weiter[i][j]["nr"]: dict(b, nr=weiter[i][j]["nr"]) for j, b in antwort.items() if 0 <= j < len(weiter[i])})
        ergebnisse.append(e)
    return ergebnisse


def score_system(sprache: str = "de") -> str:
    return (
        "Du bewertest öffentliche Ausschreibungen für einen Kunden. Antworte auf Deutsch. "
        "punkte: 1–10, wie gut die Ausschreibung zum Kunden passt (10 = Kerngeschäft, realistisch gewinnbar; "
        "1 = passt nicht). Entscheidend ist die tatsächlich ausgeschriebene Hauptleistung bzw. das Los, "
        "nicht ein beiläufig genanntes Wort, der Gebäudetyp oder ein Ortsname. "
        "Die gesuchten Arbeiten begrenzen den Bedarf des Kunden; Partnerleistungen sind keine eigenen Leistungen. "
        "Ein Fliesenbetrieb passt nicht zu Heizung, Lüftung oder Innenputz, nur weil ein Bad saniert wird. "
        "Unter 6 Punkten bei lediglich entferntem oder unklarem Leistungsbezug. "
        "kurz: ein Satz, was gesucht wird. grund: ein Satz, warum es passt oder nicht."
    ) + BEWERTUNG.get(sprache, "")


def foerder_score(beschreibung: str, items: list[dict]) -> dict[int, dict]:
    """items: [{nr, titel, beschreibung}] -> {nr: {punkte, kurz, grund}}"""
    if not items or _bremse():
        return {}
    system = (
        "Du prüfst neue Förderprogramme für eine Firma. Antworte auf Deutsch. "
        "punkte: 1–10, wie gut die Firma das Programm nutzen kann (10 = antragsberechtigt und klarer Nutzen; "
        "1 = nicht antragsberechtigt oder kein Nutzen). Achte auf Region, Firmengröße und Branche. "
        "kurz: ein Satz, was gefördert wird. grund: ein Satz in eigenen Worten, warum es passt oder nicht."
    )
    user = f"Firma:\n{beschreibung}\n\nFörderprogramme:\n" + json.dumps(items, ensure_ascii=False)
    response = _create(
        max_tokens=16000,
        system=system,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCORE_SCHEMA}},
        messages=[{"role": "user", "content": user}],
    )
    if response is None or response.stop_reason == "refusal":
        return {}
    text = next(b.text for b in response.content if b.type == "text")
    return {b["nr"]: b for b in json.loads(text)["bewertungen"] if 0 <= b["nr"] < len(items)}


# Shared with the upload worker (web/), so both write the same Steckbrief.
STECKBRIEF_ANLEITUNG = (Path(__file__).parent / "steckbrief-anleitung.txt").read_text(encoding="utf-8")
# Customers in another language (profile "sprache"): content in that language, the German markers the app parses
# stay (alarm/sprache-<code>.txt). A new language = one file here plus one line in BEWERTUNG.
BEWERTUNG_EN = " Write kurz and grund in English (US)."
BEWERTUNG = {"en": BEWERTUNG_EN, "fr": " Rédige kurz et grund en français.", "pl": " Napisz kurz i grund po polsku.",
             "es": " Escribe kurz y grund en español.", "it": " Scrivi kurz e grund in italiano."}
SPRACHE_ZUSATZ = {s: (Path(__file__).parent / f"sprache-{s}.txt").read_text(encoding="utf-8") for s in BEWERTUNG}
SPRACHE_EN = SPRACHE_ZUSATZ["en"]


def anleitung(sprache: str = "de") -> str:
    return STECKBRIEF_ANLEITUNG + ("\n" + SPRACHE_ZUSATZ[sprache] if sprache in SPRACHE_ZUSATZ else "")


def steckbrief(beschreibung: str, kopf: str, dokumente: str, sprache: str = "de") -> str:
    system = anleitung(sprache)
    if _bremse():
        return ""
    reservierung = _reservieren({"max_tokens": 32000, "messages": [beschreibung, kopf, dokumente], "system": system})
    if not reservierung:
        return ""
    vorher = kosten()
    with client.beta.messages.stream(
        model=MODEL,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        max_tokens=32000,
        output_config={"effort": "medium"},
        system=system,
        messages=[{"role": "user", "content": f"Kunde:\n{beschreibung}\n\nAusschreibung:\n{kopf}\n\nVergabeunterlagen:\n{dokumente}"}],
    ) as stream:
        message = stream.get_final_message()
    _zaehlen(message.usage)
    katalog.abschliessen(reservierung, kosten() - vorher)
    if message.stop_reason == "refusal":
        return ""
    return "\n".join(b.text for b in message.content if b.type == "text").strip()
