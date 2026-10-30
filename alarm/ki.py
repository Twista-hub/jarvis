"""Claude: score tender hits for a customer profile and write tender profiles (Steckbriefe).

Uses the official Anthropic SDK; the key comes from ANTHROPIC_API_KEY.
"""
import json
import os
from pathlib import Path
import katalog

import anthropic

# Cost per task (30.10.2026, Benjamin): the daily scoring of hundreds of short tender texts runs on Sonnet 5.5
# (half the price of Opus); the Steckbrief reads long tender documents and stays on Opus 5.5.
MODEL = "claude-opus-5-5"
MODEL_BEWERTEN = "claude-sonnet-5-5"
PREISE = {"claude-opus-5-5": (4.0, 20.0), "claude-sonnet-5-5": (2.0, 10.0)}  # $ per million input / output tokens
LIMIT = float(os.environ.get("KI_LIMIT_DOLLAR", "3"))  # hard stop per run
client = anthropic.Anthropic(max_retries=0)
_kosten = [0.0]


def kosten() -> float:
    return _kosten[0]


def _zaehlen(usage, model: str = MODEL) -> None:
    preis = PREISE[model]
    eingabe = usage.input_tokens + (usage.cache_creation_input_tokens or 0) + (usage.cache_read_input_tokens or 0)
    _kosten[0] += (eingabe * preis[0] + usage.output_tokens * preis[1]) / 1e6


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
        return katalog.reservieren(round(worst + 0.0001, 4), "alarm")
    except Exception:
        print("Zentrales KI-Budget nicht prüfbar; API-Anfrage übersprungen.")
        return None


def _create(**kwargs):
    # fallbacks="default": a safety decline is retried server-side on Anthropic's recommended model.
    reservierung = _reservieren(kwargs)
    if not reservierung:
        return None
    vorher = kosten()
    response = client.beta.messages.create(model=MODEL_BEWERTEN, betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs)
    _zaehlen(response.usage, MODEL_BEWERTEN)
    katalog.abschliessen(reservierung, kosten() - vorher)
    return response


def score(beschreibung: str, items: list[dict]) -> dict[int, dict]:
    """items: [{nr, titel, auftraggeber, ort, beschreibung, cpv}] -> {nr: {punkte, kurz, grund}}"""
    if not items or _bremse():
        return {}
    system = (
        "Du bewertest öffentliche Ausschreibungen für einen Kunden. Antworte auf Deutsch. "
        "punkte: 1–10, wie gut die Ausschreibung zum Kunden passt (10 = Kerngeschäft, realistisch gewinnbar; "
        "1 = passt nicht). kurz: ein Satz, was gesucht wird. grund: ein Satz, warum es passt oder nicht."
    )
    user = f"Kunde:\n{beschreibung}\n\nAusschreibungen:\n" + json.dumps(items, ensure_ascii=False)
    response = _create(
        max_tokens=16000,
        system=system,
        output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCORE_SCHEMA}},
        messages=[{"role": "user", "content": user}],
    )
    if response is None or response.stop_reason == "refusal":
        return {}
    text = next(b.text for b in response.content if b.type == "text")
    return {b["nr"]: b for b in json.loads(text)["bewertungen"]}


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


def steckbrief(beschreibung: str, kopf: str, dokumente: str) -> str:
    if _bremse():
        return ""
    reservierung = _reservieren({"max_tokens": 32000, "messages": [beschreibung, kopf, dokumente], "system": STECKBRIEF_ANLEITUNG})
    if not reservierung:
        return ""
    vorher = kosten()
    with client.beta.messages.stream(
        model=MODEL,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        max_tokens=32000,
        output_config={"effort": "medium"},
        system=STECKBRIEF_ANLEITUNG,
        messages=[{"role": "user", "content": f"Kunde:\n{beschreibung}\n\nAusschreibung:\n{kopf}\n\nVergabeunterlagen:\n{dokumente}"}],
    ) as stream:
        message = stream.get_final_message()
    _zaehlen(message.usage)
    katalog.abschliessen(reservierung, kosten() - vorher)
    if message.stop_reason == "refusal":
        return ""
    return "\n".join(b.text for b in message.content if b.type == "text").strip()
