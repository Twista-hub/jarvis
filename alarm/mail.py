"""Daily mail: new hits and deadline reminders, at the hour each person chose (table benachrichtigungen).

Runs every hour (.github/workflows/mail.yml). Each person only gets what they may see in the app: the
queries run as that person (role authenticated with their user id), so the row level security applies.
Also phone notifications (alarm/push.py) for people who chose "Handy".
Usage: SUPABASE_DB_PASSWORD=... SMTP_PASSWORD=... python3 alarm/mail.py [--test <email> | --sofort <firma_id>]
"""
import html
import json
import os
import re
import smtplib
import sys
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from urllib.parse import quote, urlencode
from zoneinfo import ZoneInfo

import push
from profile_db import sprache as profil_sprache, verbinden

APP = "https://crewtender.eu"
ABSENDER = ("Crewtender", "kontakt@wpdigitalranger.com")
# Search subscriptions: the sender name of the confirmation mail (web/src/mail.ts), which the subscriber has already seen.
ABO_ABSENDER = "Crewtender · WP Digital Ranger"
ABO_ZEILEN = 8
BERLIN = ZoneInfo("Europe/Berlin")
ERINNERN = (7, 2)  # days before the deadline
MORGENS = 7  # hour of the phone notification on the deadline day
NEW_YORK = ZoneInfo("America/New_York")
PARIS = ZoneInfo("Europe/Paris")
WARSCHAU = ZoneInfo("Europe/Warsaw")
MADRID = ZoneInfo("Europe/Madrid")
ROM = ZoneInfo("Europe/Rome")
ZONEN = {"fr": PARIS, "pl": WARSCHAU, "es": MADRID, "it": ROM}
_firmen: dict[str, tuple[str, ZoneInfo]] = {}

# Texts of mail and phone messages in the language of the firm's AI texts (profile_db.sprache).
T = {
    "de": {"top1": "⭐ Top-Treffer {p}/10", "topn": "⭐ {n} Top-Treffer für {f}", "weitere": " · und {n} weitere", "frist": "⏰ Frist {d}",
           "neu1": "Neue Ausschreibung", "neun": "{n} neue Ausschreibungen für {f}", "fristen_bald": " · und {n} Fristen bald",
           "heute": "⏰ Heute {was} · {art} {z}", "heute1": "Frist", "heuten": "{n} Fristen", "Abgabe": "Abgabe", "Fragen": "Fragen", "Termin": "Termin",
           "uhr": "%d.%m.%Y, %H:%M Uhr", "zeit": "%H:%M Uhr", "unbekannt": "unbekannt", "tag": "%d.%m.%Y",
           "h_fristen": "⏰ Fristen bald", "abgabe": "Abgabe", "h_neu": "🔎 {n} neue Ausschreibungen", "frist_kl": "Frist",
           "h_nachweise": "📄 Firmen-Nachweise laufen bald ab", "gueltig": "gültig bis", "in_tagen": "in {n} Tagen",
           "fuss": "Uhrzeit ändern oder Mails abschalten: {app}/konto#mail", "b_neu": "{n} neue Ausschreibungen", "b_fristen": "Fristen-Erinnerung",
           "b_nachweise": "Nachweise laufen bald ab", "fuer": " für {f}", "oeffnen": "Alle Treffer in Crewtender öffnen", "impressum": "Impressum"},
    "en": {"top1": "⭐ Top match {p}/10", "topn": "⭐ {n} top match{es} for {f}", "weitere": " · and {n} more", "frist": "⏰ Deadline {d}",
           "neu1": "New tender", "neun": "{n} new tender{s} for {f}", "fristen_bald": " · and {n} deadline{s} soon",
           "heute": "⏰ Today: {was} · {art} {z}", "heute1": "deadline", "heuten": "{n} deadlines", "Abgabe": "Bid due", "Fragen": "Questions due", "Termin": "Appointment",
           "uhr": "%b %d, %Y, %I:%M %p {tz}", "zeit": "%I:%M %p {tz}", "unbekannt": "unknown", "tag": "%b %d, %Y",
           "h_fristen": "⏰ Deadlines coming up", "abgabe": "due", "h_neu": "🔎 {n} new tender{s}", "frist_kl": "deadline",
           "h_nachweise": "📄 Company documents expiring soon", "gueltig": "valid until", "in_tagen": "in {n} day{s}",
           "fuss": "Change the time or turn off emails: {app}/konto#mail", "b_neu": "{n} new tender{s}", "b_fristen": "Deadline reminder",
           "b_nachweise": "Documents expiring soon", "fuer": " for {f}", "oeffnen": "Open all matches in Crewtender", "impressum": "Legal notice"},
    # French: plural only where a plain "s" is enough ({s}); "Nouveau :" as a label avoids nouvel/nouveaux agreement.
    "fr": {"dp": "\u00a0:", "top1": "⭐ Meilleur résultat {p}/10", "topn": "⭐ {n} meilleurs résultats pour {f}", "weitere": " · et {n} de plus", "frist": "⏰ Date limite {d}",
           "neu1": "Nouvel appel d'offres", "neun": "Nouveau : {n} appel{s} d'offres pour {f}", "fristen_bald": " · et {n} échéance{s} proche{s}",
           "heute": "⏰ Aujourd'hui : {was} · {art} {z}", "heute1": "échéance", "heuten": "{n} échéances", "Abgabe": "remise des offres", "Fragen": "questions", "Termin": "rendez-vous",
           "uhr": "%d/%m/%Y à %Hh%M", "zeit": "%Hh%M", "unbekannt": "inconnue", "tag": "%d/%m/%Y",
           "h_fristen": "⏰ Échéances proches", "abgabe": "remise", "h_neu": "🔎 Nouveau : {n} appel{s} d'offres", "frist_kl": "date limite",
           "h_nachweise": "📄 Justificatifs de l'entreprise bientôt expirés", "gueltig": "valable jusqu'au", "in_tagen": "dans {n} jour{s}",
           "fuss": "Changer l'heure ou désactiver les e-mails : {app}/konto#mail", "b_neu": "Nouveau : {n} appel{s} d'offres", "b_fristen": "Rappel d'échéance",
           "b_nachweise": "Justificatifs bientôt expirés", "fuer": " pour {f}", "oeffnen": "Ouvrir tous les résultats dans Crewtender", "impressum": "Mentions légales"},
    # Polish: "Nowe: # …" as a label avoids case agreement with numbers; {s} is not used.
    "pl": {"top1": "⭐ Najlepsze dopasowanie {p}/10", "topn": "⭐ Najlepsze dopasowania ({n}) dla {f}", "weitere": " · i jeszcze {n}", "frist": "⏰ Termin {d}",
           "neu1": "Nowy przetarg", "neun": "Nowe przetargi dla {f}: {n}", "fristen_bald": " · terminy wkrótce: {n}",
           "heute": "⏰ Dziś: {was} · {art} {z}", "heute1": "termin", "heuten": "terminy: {n}", "Abgabe": "składanie ofert", "Fragen": "pytania", "Termin": "spotkanie",
           "uhr": "%d.%m.%Y, godz. %H:%M", "zeit": "godz. %H:%M", "unbekannt": "nieznany", "tag": "%d.%m.%Y",
           "h_fristen": "⏰ Zbliżające się terminy", "abgabe": "oferty do", "h_neu": "🔎 Nowe przetargi: {n}", "frist_kl": "termin",
           "h_nachweise": "📄 Dokumenty firmy wkrótce tracą ważność", "gueltig": "ważne do", "in_tagen": "za {n} dni",
           "fuss": "Zmień godzinę lub wyłącz e-maile: {app}/konto#mail", "b_neu": "Nowe przetargi: {n}", "b_fristen": "Przypomnienie o terminie",
           "b_nachweise": "Dokumenty wkrótce tracą ważność", "fuer": " – {f}", "oeffnen": "Otwórz wszystkie wyniki w Crewtender", "impressum": "Nota prawna"},
    # Spanish: "Nuevas licitaciones: #" as a label avoids singular/plural agreement.
    "es": {"top1": "⭐ Mejor resultado {p}/10", "topn": "⭐ Mejores resultados ({n}) para {f}", "weitere": " · y {n} más", "frist": "⏰ Plazo {d}",
           "neu1": "Nueva licitación", "neun": "Nuevas licitaciones para {f}: {n}", "fristen_bald": " · plazos próximos: {n}",
           "heute": "⏰ Hoy: {was} · {art} {z}", "heute1": "plazo", "heuten": "plazos: {n}", "Abgabe": "presentación de ofertas", "Fragen": "preguntas", "Termin": "cita",
           "uhr": "%d/%m/%Y, %H:%M h", "zeit": "%H:%M h", "unbekannt": "desconocido", "tag": "%d/%m/%Y",
           "h_fristen": "⏰ Plazos próximos", "abgabe": "ofertas hasta", "h_neu": "🔎 Nuevas licitaciones: {n}", "frist_kl": "plazo",
           "h_nachweise": "📄 Documentos de la empresa que caducan pronto", "gueltig": "válido hasta", "in_tagen": "en {n} días",
           "fuss": "Cambiar la hora o desactivar los correos: {app}/konto#mail", "b_neu": "Nuevas licitaciones: {n}", "b_fristen": "Recordatorio de plazo",
           "b_nachweise": "Documentos que caducan pronto", "fuer": " – {f}", "oeffnen": "Abrir todos los resultados en Crewtender", "impressum": "Aviso legal"},
    # Italian: "Nuove gare: #" as a label avoids singular/plural agreement.
    "it": {"top1": "⭐ Miglior risultato {p}/10", "topn": "⭐ Migliori risultati ({n}) per {f}", "weitere": " · e altre {n}", "frist": "⏰ Scadenza {d}",
           "neu1": "Nuova gara", "neun": "Nuove gare per {f}: {n}", "fristen_bald": " · scadenze vicine: {n}",
           "heute": "⏰ Oggi: {was} · {art} {z}", "heute1": "scadenza", "heuten": "scadenze: {n}", "Abgabe": "presentazione delle offerte", "Fragen": "chiarimenti", "Termin": "appuntamento",
           "uhr": "%d/%m/%Y, ore %H:%M", "zeit": "ore %H:%M", "unbekannt": "non indicata", "tag": "%d/%m/%Y",
           "h_fristen": "⏰ Scadenze vicine", "abgabe": "offerte entro", "h_neu": "🔎 Nuove gare: {n}", "frist_kl": "scadenza",
           "h_nachweise": "📄 Documenti aziendali in scadenza", "gueltig": "valido fino al", "in_tagen": "tra {n} giorni",
           "fuss": "Cambia l'orario o disattiva le e-mail: {app}/konto#mail", "b_neu": "Nuove gare: {n}", "b_fristen": "Promemoria scadenza",
           "b_nachweise": "Documenti in scadenza", "fuer": " – {f}", "oeffnen": "Apri tutti i risultati in Crewtender", "impressum": "Note legali"},
}


def pl(n: int) -> str:
    """Plural ending (English, and French where a plain "s" is enough)."""
    return "" if n == 1 else "s"


def firma_sprache(con, firma_id: str) -> tuple[str, ZoneInfo]:
    """(language, time zone) of a firm: English firms that search the USA get US Eastern time, French firms Paris
    (same hours as Berlin, French zone names), everyone else Berlin."""
    if firma_id not in _firmen:
        zeile = con.execute("select einstellungen from public.suchprofile where firma_id = %s limit 1", (firma_id,)).fetchone()
        e = zeile[0] if zeile and isinstance(zeile[0], dict) else {}
        sprache = profil_sprache(e) if e else "de"
        zone = NEW_YORK if sprache == "en" and "USA" in (e.get("laender") or []) else ZONEN.get(sprache, BERLIN)
        _firmen[firma_id] = (sprache, zone)
    return _firmen[firma_id]


_plaene: dict = {}


def plan_der_firma(con, firma_id: str) -> str | None:
    """Effective plan (SQL jarvis_intern.plan_von); None while the function does not exist yet."""
    if firma_id not in _plaene:
        try:
            _plaene[firma_id] = con.execute("select jarvis_intern.plan_von(%s)", (firma_id,)).fetchone()[0]
        except Exception:  # noqa: BLE001 - without plans everyone keeps the daily message
            _plaene[firma_id] = None
    return _plaene[firma_id]


def woechentlich_faellig(plan: str | None, letzte, jetzt: datetime) -> bool:
    """Free plan: one summary a week on Monday (docs/abos.md); every other plan daily."""
    if plan != "kostenlos":
        return True
    return jetzt.weekday() == 0 and (letzte is None or letzte < jetzt - timedelta(days=6))


def ortsstunde(zone: ZoneInfo) -> int:
    return datetime.now(zone).hour


def stunde_erreicht(gewaehlt: int, jetzt: int) -> bool:
    """The chosen hour has come today (catch-up for skipped runs; the 20-hour rule prevents a second mail)."""
    return gewaehlt <= jetzt


def faellig(con, stunde: int, test: str | None, sofort: str | None) -> list[tuple]:
    """(firma_id, user_id, email, firm name, last sent, channel, deadline reminders) for everyone due now."""
    if test:  # test: all firms of this person, hits of the last 24 hours, mail and phone
        return con.execute("""select m.firma_id::text, m.user_id::text, u.email, f.name, null::timestamptz, 'beides', true
            from public.mitglieder m join public.firmen f on f.id = m.firma_id join auth.users u on u.id = m.user_id
            where m.aktiv and u.email = %s""", (test,)).fetchall()
    basis = """select b.firma_id::text, b.user_id::text, u.email, f.name, b.letzte_mail, b.kanal, b.fristen
        from public.benachrichtigungen b
        join public.mitglieder m on m.firma_id = b.firma_id and m.user_id = b.user_id and m.aktiv
        join public.firmen f on f.id = b.firma_id
        join auth.users u on u.id = b.user_id
        where b.stunde is not null and """
    if sofort:  # first hit list right after the setup assistant: everyone of this firm who wants news
        return con.execute(basis + "b.firma_id = %s", (sofort,)).fetchall()
    # The chosen hour counts in the firm's time zone (US firms: Eastern time). GitHub skips or delays many hourly runs
    # (only 3 of 16 ran on 07.11.2026), so a run sends every mail whose hour has come today and that has not gone out
    # in the last 20 hours: a missed hour is caught up by the next run instead of being lost.
    zeilen = con.execute(basis.replace("b.fristen\n", "b.fristen, b.stunde\n") + "(b.letzte_mail is null or b.letzte_mail < now() - interval '20 hours')").fetchall()
    return [z[:7] for z in zeilen if stunde_erreicht(z[7], stunde if firma_sprache(con, z[0])[1] == BERLIN else ortsstunde(firma_sprache(con, z[0])[1]))
            and woechentlich_faellig(plan_der_firma(con, z[0]), z[4], datetime.now(firma_sprache(con, z[0])[1]))]


def vertretung_heute(con, firma_id: str, user_id: str) -> tuple[bool, bool]:
    """(absent today, covers for someone today) from the cover arrangements (T12)."""
    heute = datetime.now(BERLIN).date()
    abwesend, vertritt = con.execute("""select
          exists(select 1 from public.vertretungen where firma_id = %s and user_id = %s and %s between von and bis),
          exists(select 1 from public.vertretungen where firma_id = %s and vertreter_id = %s and %s between von and bis)""",
        (firma_id, user_id, heute, firma_id, user_id, heute)).fetchone()
    return bool(abwesend), bool(vertritt)


def regel(abwesend: bool, vertritt: bool, fristen_an: bool) -> tuple[bool, bool]:
    """(send at all, with deadlines): absent people get nothing; whoever covers always gets the deadlines."""
    if abwesend:
        return False, False
    return True, fristen_an or vertritt


def handy(con, schl, user_id: str, firma_id: str, firma: str, neu: list, fristen: list, sofort: bool = False, sprache: str = "de", zone: ZoneInfo = BERLIN) -> int:
    """Phone notification: one tap opens the hit (one new) or the list (several)."""
    t = T[sprache]
    if sofort and neu:
        vid, titel, punkte, _ = neu[0]
        kopf = t["top1"].format(p=punkte) if len(neu) == 1 else t["topn"].format(n=len(neu), f=firma, es="es")
        text = titel + (t["weitere"].format(n=len(neu) - 1) if len(neu) > 1 else "")
        url = f"/konto/vorgang/{vid}" if len(neu) == 1 else f"/konto/treffer?firma={firma_id}"
    elif fristen and not neu:
        vid, titel, frist = fristen[0]
        kopf, text, url = t["frist"].format(d=datum(frist, sprache, zone)), titel, f"/konto/vorgang/{vid}"
    elif len(neu) == 1:
        vid, titel, punkte, _ = neu[0]
        kopf, text, url = f"{t['neu1']}{f' · {punkte}/10' if punkte else ''}", titel, f"/konto/vorgang/{vid}"
    else:
        kopf = t["neun"].format(n=len(neu), s=pl(len(neu)), f=firma)
        text = neu[0][1] + (t["fristen_bald"].format(n=len(fristen), s=pl(len(fristen))) if fristen else "")
        url = f"/konto/treffer?firma={firma_id}"
    return senden_an_geraete(con, schl, user_id, kopf, text, url)


def senden_an_geraete(con, schl, user_id: str, kopf: str, text: str, url: str) -> int:
    geraete = con.execute("select id, endpoint from public.push_abos where user_id = %s", (user_id,)).fetchall()
    if not geraete:
        return 0
    con.execute("insert into public.push_nachrichten (user_id, titel, text, url) values (%s, %s, %s, %s)", (user_id, kopf[:200], text[:300], url))
    ok = 0
    for abo_id, endpoint in geraete:
        status = push.senden(*schl, endpoint)
        if status in (404, 410):  # device unsubscribed or app removed
            con.execute("delete from public.push_abos where id = %s", (abo_id,))
        ok += 200 <= status < 300
    return ok


def warteschlange(con, schl) -> int:
    """Phone notifications queued by the app (new shift, cancelled shift, notice board, T18/T19): one per person and run,
    several are combined. Older than two days is dropped unsent."""
    zeilen = con.execute("""select id, user_id::text, titel, text, url from public.push_warteschlange
        where gesendet is null and erstellt > now() - interval '2 days' order by erstellt""").fetchall()
    pro_person: dict[str, list[tuple]] = {}
    for zeile in zeilen:
        pro_person.setdefault(zeile[1], []).append(zeile)
    gesendet = 0
    for user_id, liste in pro_person.items():
        _, _, titel, text, url = liste[-1]
        if len(liste) > 1:
            titel, text, url = f"{len(liste)} neue Nachrichten", liste[-1][2], "/konto"
        gesendet += senden_an_geraete(con, schl, user_id, titel, text, url)
    if zeilen:
        con.execute("update public.push_warteschlange set gesendet = now() where id = any(%s)", ([z[0] for z in zeilen],))
    con.execute("delete from public.push_warteschlange where erstellt < now() - interval '30 days'")
    con.execute("delete from public.push_nachrichten where erstellt < now() - interval '30 days'")  # promised in the privacy policy
    con.execute("delete from public.chat_nachrichten where erstellt < now() - interval '180 days'")  # team chat retention
    return gesendet


def als_person(con, user_id: str, sql: str, args: tuple) -> list[tuple]:
    """Query with the person's rights (like PostgREST does), inside its own transaction."""
    with con.transaction():
        con.execute("select set_config('request.jwt.claims', %s, true)", (json.dumps({"sub": user_id, "role": "authenticated"}),))
        con.execute("set local role authenticated")
        return con.execute(sql, args).fetchall()


def inhalt(con, firma_id: str, user_id: str, seit: datetime) -> tuple[list, list]:
    neu = als_person(con, user_id, """select id::text, titel, punkte, frist from public.vorgaenge
        where firma_id = %s and erstellt > %s and status not in ('verworfen', 'verloren')
          and (frist is null or frist>now())
          and not exists(select 1 from public.vergabekatalog k where k.id=vorgaenge.katalog_id and k.status in ('aufgehoben','vergeben','abgeschlossen'))
        order by punkte desc nulls last, erstellt desc limit 30""", (firma_id, seit))
    heute = datetime.now(BERLIN).date()
    tage = [heute + timedelta(days=d) for d in ERINNERN]
    fristen = als_person(con, user_id, """select id::text, titel, frist from public.vorgaenge
        where firma_id = %s and status in ('neu', 'pruefen', 'angebot')
          and not exists(select 1 from public.vergabekatalog k where k.id=vorgaenge.katalog_id and k.status in ('aufgehoben','vergeben','abgeschlossen'))
          and (frist at time zone 'Europe/Berlin')::date = any(%s) order by frist""", (firma_id, tage))
    return neu, fristen


def in_ruhezeit(stunde: int, von, bis) -> bool:
    """Quiet hours (I2), e.g. 20 to 7: no phone messages from 20:00 until 6:59."""
    if von is None or bis is None or von == bis:
        return False
    return von <= stunde < bis if von < bis else stunde >= von or stunde < bis


def morgen_stunde(von, bis) -> int:
    """Hour of the deadline-day message: 7, or the end of the quiet hours when 7 falls into them."""
    return bis if in_ruhezeit(MORGENS, von, bis) else MORGENS


def sofort_nach_speichern(neue: dict) -> int:
    """After the hits are committed: immediate phone messages per firm (own connection in autocommit, because
    als_person() switches the role until the end of the transaction). Never stops the search."""
    neue = {f: ids for f, ids in neue.items() if ids}
    if not neue or not os.environ.get("SUPABASE_DB_PASSWORD"):
        return 0
    try:
        with verbinden() as con:
            con.autocommit = True
            return sum(sofort_melden(con, f, ids) for f, ids in neue.items())
    except (Exception, SystemExit) as e:  # noqa: BLE001
        print(f"Sofort-Nachrichten nicht gesendet ({type(e).__name__})")
        return 0


def sofort_melden(con, firma_id: str, vorgang_ids: list[str]) -> int:
    """I1: phone message right away for new hits from the score each person chose, outside their quiet hours.
    Each person only hears about hits they may see (query with their rights); the daily message stays as it is.
    con must be in autocommit (see sofort_nach_speichern)."""
    if not vorgang_ids or plan_der_firma(con, firma_id) == "kostenlos":  # Free: no phone messages
        return 0
    stunde = datetime.now(BERLIN).hour
    leute = con.execute("""select b.user_id::text, b.sofort_ab, b.ruhe_von, b.ruhe_bis, f.name from public.benachrichtigungen b
        join public.mitglieder m on m.firma_id = b.firma_id and m.user_id = b.user_id and m.aktiv
        join public.firmen f on f.id = b.firma_id
        where b.firma_id = %s and b.sofort_ab is not null and b.kanal in ('push', 'beides')""", (firma_id,)).fetchall()
    sprache, zone = firma_sprache(con, firma_id)
    if zone != BERLIN:
        stunde = ortsstunde(zone)
    leute = [p for p in leute if not in_ruhezeit(stunde, p[2], p[3])]
    if not leute:
        return 0
    schl = push.schluessel(con)
    gesendet = 0
    for user_id, ab, _von, _bis, firma in leute:
        treffer = als_person(con, user_id, """select id::text, titel, punkte, frist from public.vorgaenge
            where firma_id = %s and id::text = any(%s) and punkte >= %s order by punkte desc""", (firma_id, vorgang_ids, ab))
        if treffer:
            gesendet += handy(con, schl, user_id, firma_id, firma, treffer, [], sofort=True, sprache=sprache, zone=zone)
    return gesendet


def heute_faellig(con, firma_id: str, user_id: str) -> list[tuple]:
    """(id or None, title, time, kind) of every deadline today: submission, question deadline and own entries."""
    heute = datetime.now(BERLIN).date()
    return als_person(con, user_id, """select * from (
          select id::text, titel, frist as zeit, 'Abgabe' as art from public.vorgaenge
          where firma_id = %s and status in ('neu', 'pruefen', 'angebot') and (frist at time zone 'Europe/Berlin')::date = %s
          union all
          select id::text, titel, fragefrist, 'Fragen' from public.vorgaenge
          where firma_id = %s and status in ('neu', 'pruefen', 'angebot') and (fragefrist at time zone 'Europe/Berlin')::date = %s
          union all
          select vorgang_id::text, titel, zeit, 'Termin' from public.eigene_termine
          where firma_id = %s and (zeit at time zone 'Europe/Berlin')::date = %s) t
        order by zeit limit 20""", (firma_id, heute, firma_id, heute, firma_id, heute))


def morgen_push(con, schl, user_id: str, firma_id: str, termine: list, sprache: str = "de", zone: ZoneInfo = BERLIN) -> int:
    """One phone notification in the morning of a deadline day; at most once a day per person."""
    if not termine or con.execute("""select 1 from public.push_nachrichten where user_id = %s and (titel like '⏰ Heute%%' or titel like '⏰ Today%%' or titel like '⏰ Aujourd%%' or titel like '⏰ Dziś%%' or titel like '⏰ Hoy%%' or titel like '⏰ Oggi%%')
            and erstellt > now() - interval '20 hours'""", (user_id,)).fetchone():
        return 0
    t = T[sprache]
    vid, titel, zeit, art = termine[0]
    was = t["heute1"] if len(termine) == 1 else t["heuten"].format(n=len(termine))
    kopf = t["heute"].format(was=was, art=t.get(art, art), z=uhrzeit(zeit, sprache, zone))
    text = titel + (t["weitere"].format(n=len(termine) - 1) if len(termine) > 1 else "")
    url = f"/konto/vorgang/{vid}" if vid and len(termine) == 1 else f"/konto/fristen?firma={firma_id}"
    return senden_an_geraete(con, schl, user_id, kopf, text, url)


def ablaufende_nachweise(con, firma_id: str, user_id: str) -> list[tuple]:
    """One reminder on 30/14/7/2 days, only for people with enabled firm email and finance access."""
    heute = datetime.now(BERLIN).date()
    faellig = [heute + timedelta(days=d) for d in (30, 14, 7, 2)]
    return con.execute("""select d.id::text, d.name, d.gueltig_bis, (d.gueltig_bis-%s)::int
        from public.firmenunterlagen d
        join public.mitglieder m on m.firma_id=d.firma_id and m.user_id=%s and m.aktiv
        join public.benachrichtigungen b on b.firma_id=m.firma_id and b.user_id=m.user_id and b.stunde is not null and b.kanal in ('mail','beides')
        where d.firma_id=%s and d.art='nachweis' and d.gueltig_bis=any(%s)
          and (m.rolle in ('inhaber','admin') or (m.rolle in ('bearbeiter','leser') and m.finanzen))
          and not exists(select 1 from public.nachweis_erinnerungen e where e.dokument_id=d.id and e.user_id=m.user_id and e.tage=(d.gueltig_bis-%s)::int)
        order by d.gueltig_bis,d.name""", (heute, user_id, firma_id, faellig, heute)).fetchall()


def zonen_kuerzel(zone: ZoneInfo, t: datetime) -> str:
    return "ET" if zone == NEW_YORK else t.astimezone(zone).tzname() or ""


def datum(t, sprache: str = "de", zone: ZoneInfo = BERLIN) -> str:
    if not t:
        return T[sprache]["unbekannt"]
    return t.astimezone(zone).strftime(T[sprache]["uhr"].replace("{tz}", zonen_kuerzel(zone, t)))


def uhrzeit(t, sprache: str = "de", zone: ZoneInfo = BERLIN) -> str:
    return t.astimezone(zone).strftime(T[sprache]["zeit"].replace("{tz}", zonen_kuerzel(zone, t)))


def nachricht(an: str, firma: str, neu: list, fristen: list, nachweise: list = (), sprache: str = "de", zone: ZoneInfo = BERLIN) -> EmailMessage:
    t = T[sprache]
    d = lambda x: datum(x, sprache, zone)  # noqa: E731
    zeilen, html_teile = [], []
    if fristen:
        zeilen.append(f"{t['h_fristen']}{t.get('dp', ':')}")
        html_teile.append(f"<h2>{t['h_fristen']}</h2><ul>")
        for vid, titel, frist in fristen:
            zeilen.append(f"- {titel} – {t['abgabe']} {d(frist)}\n  {APP}/konto/vorgang/{vid}")
            html_teile.append(f'<li><a href="{APP}/konto/vorgang/{vid}">{html.escape(titel)}</a> – {t["abgabe"]} <strong>{d(frist)}</strong></li>')
        html_teile.append("</ul>")
    if neu:
        kopf = t["h_neu"].format(n=len(neu), s=pl(len(neu)))
        zeilen.append(f"\n{kopf}{t.get('dp', ':')}")
        html_teile.append(f"<h2>{kopf}</h2><ul>")
        for vid, titel, punkte, frist in neu:
            p = f"{punkte}/10 · " if punkte else ""
            zeilen.append(f"- {p}{titel} ({t['frist_kl']} {d(frist)})\n  {APP}/konto/vorgang/{vid}")
            html_teile.append(f'<li>{p}<a href="{APP}/konto/vorgang/{vid}">{html.escape(titel)}</a> <small>({t["frist_kl"]} {d(frist)})</small></li>')
        html_teile.append("</ul>")
    if nachweise:
        zeilen.append(f"\n{t['h_nachweise']}{t.get('dp', ':')}")
        html_teile.append(f"<h2>{t['h_nachweise']}</h2><ul>")
        for _id, name, gueltig_bis, tage in nachweise:
            bis = gueltig_bis.strftime(t["tag"])
            zeilen.append(f"- {name} – {t['gueltig']} {bis} ({t['in_tagen'].format(n=tage, s=pl(tage))})\n  {APP}/konto/firmenunterlagen")
            html_teile.append(f'<li><a href="{APP}/konto/firmenunterlagen">{html.escape(name)}</a> – {t["gueltig"]} <strong>{bis}</strong> ({t["in_tagen"].format(n=tage, s=pl(tage))})</li>')
        html_teile.append("</ul>")
    fuss = t["fuss"].format(app=APP)
    m = EmailMessage()
    m["From"] = formataddr(ABSENDER)
    m["To"] = an
    betreff = t["b_neu"].format(n=len(neu), s=pl(len(neu))) if neu else t["b_fristen"] if fristen else t["b_nachweise"]
    m["Subject"] = betreff + t["fuer"].format(f=firma)[:150]
    m["Message-ID"] = make_msgid(domain="wpdigitalranger.com")
    # Lets mail programs show an "unsubscribe" button; both lead to switching the mail off.
    m["List-Unsubscribe"] = f"<mailto:{ABSENDER[1]}?subject=Crewtender-Mail%20abbestellen>, <{APP}/konto#mail>"
    m.set_content("\n".join(zeilen) + f"\n\n{fuss}\n")
    m.add_alternative(f"""<div style="font-family:system-ui,sans-serif;max-width:640px">{''.join(html_teile)}
<p><a href="{APP}/konto">{t['oeffnen']}</a></p>
<p style="color:#666;font-size:13px">{html.escape(fuss)}<br>Crewtender · WP Digital Ranger · <a href="{APP}/impressum">{t['impressum']}</a></p></div>""", subtype="html")
    return m


# Trial reminders (migration 20261107030000): 7 days and 2 days before the 30 days of Pro run out (day 23 and 28).
PT = {
    "de": {"b23": "Deine Crewtender-Probezeit endet am {d}", "b28": "Noch 2 Tage: Deine Crewtender-Probezeit endet am {d}",
           "hallo": "Hallo,", "ende": "die 30 Tage Pro für {f} laufen am {d} aus. Danach wechselt Crewtender von selbst auf Free, ohne Kosten und ohne Kündigung.",
           "bleibt": "Das bleibt in Free: passende Ausschreibungen (1 Suchprofil, 1 Land), der Kurzüberblick zu jeder Ausschreibung und eine Zusammenfassung pro Woche. Es wird nichts gelöscht; Personal, Schichten, Stunden und Rechnungen bleiben lesbar.",
           "fehlt": "Das fehlt dann: die tägliche Nachricht per Mail und Handy, Steckbriefe aus Unterlagen, Personal, Einsatzplanung, Zeiterfassung, Abrechnung und Angebote.",
           "knopf": "Plan wählen", "preise": "Pläne und Preise", "fragen": "Fragen? Einfach auf diese Mail antworten."},
    "en": {"b23": "Your Crewtender trial ends on {d}", "b28": "2 days left: your Crewtender trial ends on {d}",
           "hallo": "Hello,", "ende": "the 30 days of Pro for {f} end on {d}. After that Crewtender switches to Free by itself, at no cost and without cancelling.",
           "bleibt": "What stays in Free: matching tenders (1 search profile, 1 country), the short overview of every tender and a weekly summary. Nothing is deleted; staff, shifts, hours and invoices stay readable.",
           "fehlt": "What you lose: the daily message by email and phone, fact sheets from documents, staff, scheduling, time recording, billing and offers.",
           "knopf": "Choose a plan", "preise": "Plans and prices", "fragen": "Questions? Just reply to this email."},
    "fr": {"b23": "Votre essai Crewtender se termine le {d}", "b28": "Plus que 2 jours : votre essai Crewtender se termine le {d}",
           "hallo": "Bonjour,", "ende": "les 30 jours de Pro pour {f} se terminent le {d}. Ensuite, Crewtender passe automatiquement à Free, sans frais et sans résiliation.",
           "bleibt": "Ce qui reste en Free : les appels d'offres pertinents (1 profil de recherche, 1 pays), l'aperçu de chaque appel d'offres et un récapitulatif par semaine. Rien n'est supprimé ; personnel, plannings, heures et factures restent consultables.",
           "fehlt": "Ce qui manque ensuite : le message quotidien par e-mail et sur le téléphone, les fiches synthèse à partir de documents, le personnel, la planification, la saisie des temps, la facturation et les offres.",
           "knopf": "Choisir un plan", "preise": "Plans et tarifs", "fragen": "Des questions ? Répondez simplement à cet e-mail."},
    "pl": {"b23": "Twój okres próbny Crewtender kończy się {d}", "b28": "Zostały 2 dni: Twój okres próbny Crewtender kończy się {d}",
           "hallo": "Dzień dobry,", "ende": "30 dni planu Pro dla {f} kończy się {d}. Potem Crewtender sam przejdzie na Free, bez kosztów i bez wypowiedzenia.",
           "bleibt": "W Free zostaje: pasujące przetargi (1 profil wyszukiwania, 1 kraj), krótki przegląd każdego przetargu i podsumowanie raz w tygodniu. Nic nie zostanie usunięte; personel, grafiki, godziny i faktury można dalej przeglądać.",
           "fehlt": "Czego zabraknie: codziennej wiadomości e-mailem i na telefon, kart przetargu z dokumentów, personelu, planowania, ewidencji czasu, rozliczeń i ofert.",
           "knopf": "Wybierz plan", "preise": "Plany i ceny", "fragen": "Pytania? Po prostu odpowiedz na tego e-maila."},
    "es": {"b23": "Tu prueba de Crewtender termina el {d}", "b28": "Quedan 2 días: tu prueba de Crewtender termina el {d}",
           "hallo": "Hola:", "ende": "los 30 días de Pro para {f} terminan el {d}. Después, Crewtender pasa solo a Free, sin coste y sin cancelar nada.",
           "bleibt": "Lo que sigue en Free: licitaciones adecuadas (1 perfil de búsqueda, 1 país), el resumen de cada licitación y un resumen semanal. No se borra nada; personal, turnos, horas y facturas siguen siendo legibles.",
           "fehlt": "Lo que deja de estar: el mensaje diario por correo y en el móvil, las fichas a partir de documentos, personal, planificación, registro de horas, facturación y ofertas.",
           "knopf": "Elegir un plan", "preise": "Planes y precios", "fragen": "¿Preguntas? Responde a este correo."},
    "it": {"b23": "La tua prova di Crewtender termina il {d}", "b28": "Mancano 2 giorni: la tua prova di Crewtender termina il {d}",
           "hallo": "Buongiorno,", "ende": "i 30 giorni di Pro per {f} terminano il {d}. Dopo, Crewtender passa da solo a Free, senza costi e senza disdetta.",
           "bleibt": "Cosa resta in Free: le gare adatte (1 profilo di ricerca, 1 paese), la sintesi di ogni gara e un riepilogo settimanale. Non viene eliminato nulla; personale, turni, ore e fatture restano consultabili.",
           "fehlt": "Cosa manca poi: il messaggio quotidiano via e-mail e sul telefono, le schede da documenti, personale, pianificazione, rilevazione presenze, fatturazione e offerte.",
           "knopf": "Scegli un piano", "preise": "Piani e prezzi", "fragen": "Domande? Rispondi semplicemente a questa e-mail."},
}


def probe_stufe(bis: datetime, jetzt: datetime) -> str | None:
    """Which reminder is due: 'tag23' from 7 days before the end, 'tag28' from 2 days before; None outside."""
    rest = bis - jetzt
    if rest <= timedelta(0) or rest > timedelta(days=7):
        return None
    return "tag28" if rest <= timedelta(days=2) else "tag23"


def probe_mail(an: str, firma: str, bis: datetime, stufe: str, sprache: str = "de", zone: ZoneInfo = BERLIN) -> EmailMessage:
    t, tt = PT.get(sprache, PT["en"]), T.get(sprache, T["en"])
    d = bis.astimezone(zone).strftime(tt["tag"])
    absaetze = [t["hallo"], t["ende"].format(f=firma, d=d), t["bleibt"], t["fehlt"]]
    m = EmailMessage()
    m["From"] = formataddr(ABSENDER)
    m["To"] = an
    m["Subject"] = t["b23" if stufe == "tag23" else "b28"].format(d=d)
    m["Message-ID"] = make_msgid(domain="wpdigitalranger.com")
    m.set_content("\n\n".join(absaetze) + f"\n\n{t['knopf']}: {APP}/konto/plan\n{t['preise']}: {APP}/preise\n\n{t['fragen']}\n\nCrewtender · WP Digital Ranger · {APP}/impressum\n")
    m.add_alternative(f"""<div style="font-family:system-ui,sans-serif;max-width:640px">{''.join(f'<p>{html.escape(a)}</p>' for a in absaetze)}
<p><a href="{APP}/konto/plan" style="display:inline-block;padding:10px 16px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none">{t['knopf']}</a> &nbsp; <a href="{APP}/preise">{t['preise']}</a></p>
<p>{html.escape(t['fragen'])}</p>
<p style="color:#666;font-size:13px">Crewtender · WP Digital Ranger · <a href="{APP}/impressum">{tt['impressum']}</a></p></div>""", subtype="html")
    return m


def probe_erinnerungen(con, smtp, jetzt: datetime | None = None) -> int:
    """Sends due trial reminders to owners and admins (each stage once per firm, from 8 o'clock local time)."""
    try:
        firmen = con.execute("""select f.id::text, f.name, f.probe_bis from public.firmen f
            where f.paket = 'kostenlos' and f.probe_bis > now() and f.probe_bis < now() + interval '7 days'""").fetchall()
    except Exception as e:  # noqa: BLE001 - before the migration: no reminders, the rest runs
        print(f"Probe-Erinnerungen übersprungen: {e}", file=sys.stderr)
        return 0
    gesendet = 0
    for firma_id, name, bis in firmen:
        sprache, zone = firma_sprache(con, firma_id)
        jetzt_ort = (jetzt or datetime.now(zone)).astimezone(zone)
        stufe = probe_stufe(bis, jetzt_ort)
        if not stufe or jetzt_ort.hour < 8:
            continue
        try:
            # Claim first: better one reminder too few than the same one twice.
            if not con.execute("""insert into jarvis_intern.probe_erinnerungen (firma_id, stufe) values (%s, %s)
                    on conflict do nothing returning firma_id""", (firma_id, stufe)).fetchone():
                continue
        except Exception as e:  # noqa: BLE001
            print(f"Probe-Erinnerung nicht vermerkt: {e}", file=sys.stderr)
            return gesendet
        for (email,) in con.execute("""select u.email from public.mitglieder m join auth.users u on u.id = m.user_id
                where m.firma_id = %s and m.aktiv and m.rolle in ('inhaber', 'admin') and coalesce(u.email, '') <> ''""", (firma_id,)).fetchall():
            smtp.send_message(probe_mail(email, name, bis, stufe, sprache, zone))
            gesendet += 1
    return gesendet


# Welcome mails (migration 20261108050000): day 1, 3 and 10 after a firm was created (texts approved 08.11.2026).
WILLKOMMEN_AKTIV = True  # Benjamin 08.11.2026: Texte freigegeben
WILLKOMMEN_STUFEN = (("tag1", 1), ("tag3", 3), ("tag10", 10))
WT = {
    "de": {
        "tag1": ("Willkommen bei Crewtender – so geht's los",
                 ["Hallo,", "schön, dass {f} dabei ist! Drei Dinge lohnen sich am ersten Tag:",
                  "1. Suchprofil prüfen: Stimmen die Arbeiten und Orte, nach denen Crewtender sucht? Jeder 👍 oder 👎 bei einem Treffer macht die Suche genauer.",
                  "2. Uhrzeit wählen: Wann soll die tägliche Nachricht mit neuen Ausschreibungen kommen, per Mail oder aufs Handy?",
                  "3. Crewtender aufs Handy: Seite im Browser öffnen und „Zum Startbildschirm hinzufügen“ antippen."],
                 [("Suchprofil öffnen", "/konto/suchprofil"), ("Uhrzeit wählen", "/konto#mail")]),
        "tag3": ("Lade deine erste Ausschreibung hoch",
                 ["Hallo,", "der größte Zeitgewinn mit Crewtender: Lade die Vergabeunterlagen einer Ausschreibung hoch. Crewtender liest alles und schreibt einen Steckbrief mit Losen, Mengen, Fristen und geforderten Nachweisen. Daraus rechnest du mit deinen Löhnen den Preis.",
                  "In der Probezeit sind 10 Steckbriefe aus Unterlagen enthalten."],
                 [("Unterlagen hochladen", "/konto/unterlagen")]),
        "tag10": ("Personal und Einsatzplanung in Crewtender",
                  ["Hallo,", "wenn der Auftrag da ist, hilft Crewtender weiter: Personal mit Qualifikationen und Nachweisen, Schichtplan mit Prüfung des Arbeitszeitgesetzes, Stunden per Handy und die Lohnliste für das Lohnbüro.",
                   "Am schnellsten geht's mit dem Import aus Excel. Danach kannst du dein Team einladen."],
                  [("Personal importieren", "/konto/personal/import"), ("Team einladen", "/konto/team")]),
        "fuss": "Fragen? Einfach auf diese Mail antworten.", "probe": "Deine Probezeit mit allen Pro-Funktionen läuft bis {d}.",
    },
    "en": {
        "tag1": ("Welcome to Crewtender – getting started",
                 ["Hello,", "great to have {f} on board! Three things are worth doing on day one:",
                  "1. Check your search profile: are the services and places Crewtender searches for right? Every 👍 or 👎 on a match makes the search more precise.",
                  "2. Choose a time: when should the daily message with new tenders arrive, by email or on your phone?",
                  "3. Crewtender on your phone: open the page in your browser and tap “Add to Home screen”."],
                 [("Open search profile", "/konto/suchprofil"), ("Choose time", "/konto#mail")]),
        "tag3": ("Upload your first tender",
                 ["Hello,", "the biggest time saver in Crewtender: upload the documents of a tender. Crewtender reads everything and writes a fact sheet with lots, quantities, deadlines and required evidence. From it you calculate the price with your own wages.",
                  "The trial includes 10 fact sheets from documents."],
                 [("Upload documents", "/konto/unterlagen")]),
        "tag10": ("Staff and scheduling in Crewtender",
                  ["Hello,", "once you win the contract, Crewtender keeps helping: staff with qualifications and certificates, shift plans checked against working-time rules, hours by phone and the payroll list.",
                   "The quickest start is the import from Excel. Then you can invite your team."],
                  [("Import staff", "/konto/personal/import"), ("Invite team", "/konto/team")]),
        "fuss": "Questions? Just reply to this email.", "probe": "Your trial with all Pro features runs until {d}.",
    },
    "fr": {
        "tag1": ("Bienvenue sur Crewtender – pour bien démarrer",
                 ["Bonjour,", "ravis que {f} nous rejoigne ! Trois choses valent la peine dès le premier jour :",
                  "1. Vérifier le profil de recherche : les prestations et les lieux recherchés par Crewtender sont-ils justes ? Chaque 👍 ou 👎 sur un résultat affine la recherche.",
                  "2. Choisir l'heure : quand le message quotidien avec les nouveaux appels d'offres doit-il arriver, par e-mail ou sur le téléphone ?",
                  "3. Crewtender sur le téléphone : ouvrez la page dans le navigateur et touchez « Ajouter à l'écran d'accueil »."],
                 [("Ouvrir le profil de recherche", "/konto/suchprofil"), ("Choisir l'heure", "/konto#mail")]),
        "tag3": ("Téléversez votre premier appel d'offres",
                 ["Bonjour,", "le plus grand gain de temps avec Crewtender : téléversez les documents d'un appel d'offres. Crewtender lit tout et rédige une fiche synthèse avec lots, quantités, délais et justificatifs demandés. Vous en déduisez le prix avec vos propres salaires.",
                  "L'essai comprend 10 fiches synthèse à partir de documents."],
                 [("Téléverser des documents", "/konto/unterlagen")]),
        "tag10": ("Personnel et planification dans Crewtender",
                  ["Bonjour,", "une fois le marché obtenu, Crewtender continue de vous aider : personnel avec qualifications et justificatifs, planning vérifié selon les règles du temps de travail, heures par téléphone et liste de paie.",
                   "Le plus rapide : l'import depuis Excel. Ensuite, vous pouvez inviter votre équipe."],
                  [("Importer le personnel", "/konto/personal/import"), ("Inviter l'équipe", "/konto/team")]),
        "fuss": "Des questions ? Répondez simplement à cet e-mail.", "probe": "Votre essai avec toutes les fonctions Pro dure jusqu'au {d}.",
    },
    "pl": {
        "tag1": ("Witamy w Crewtender – jak zacząć",
                 ["Dzień dobry,", "cieszymy się, że {f} jest z nami! W pierwszym dniu warto zrobić trzy rzeczy:",
                  "1. Sprawdzić profil wyszukiwania: czy usługi i miejsca, których szuka Crewtender, się zgadzają? Każde 👍 lub 👎 przy wyniku zwiększa trafność.",
                  "2. Wybrać godzinę: kiedy ma przychodzić codzienna wiadomość z nowymi przetargami, e-mailem czy na telefon?",
                  "3. Crewtender na telefonie: otwórz stronę w przeglądarce i dotknij „Dodaj do ekranu głównego”."],
                 [("Otwórz profil wyszukiwania", "/konto/suchprofil"), ("Wybierz godzinę", "/konto#mail")]),
        "tag3": ("Prześlij swój pierwszy przetarg",
                 ["Dzień dobry,", "największa oszczędność czasu z Crewtender: prześlij dokumenty przetargu. Crewtender czyta wszystko i tworzy kartę przetargu z częściami, ilościami, terminami i wymaganymi dokumentami. Na tej podstawie obliczysz cenę z własnymi stawkami.",
                  "Okres próbny obejmuje 10 kart przetargu z dokumentów."],
                 [("Prześlij dokumenty", "/konto/unterlagen")]),
        "tag10": ("Personel i planowanie w Crewtender",
                  ["Dzień dobry,", "gdy zlecenie jest już Twoje, Crewtender pomaga dalej: personel z kwalifikacjami i zaświadczeniami, grafik sprawdzany pod kątem czasu pracy, godziny przez telefon i lista płac.",
                   "Najszybciej zaczniesz od importu z Excela. Potem możesz zaprosić zespół."],
                  [("Importuj personel", "/konto/personal/import"), ("Zaproś zespół", "/konto/team")]),
        "fuss": "Pytania? Po prostu odpowiedz na tego e-maila.", "probe": "Twój okres próbny ze wszystkimi funkcjami Pro trwa do {d}.",
    },
    "es": {
        "tag1": ("Bienvenido a Crewtender: primeros pasos",
                 ["Hola:", "¡qué bien que {f} esté con nosotros! El primer día merece la pena hacer tres cosas:",
                  "1. Revisar el perfil de búsqueda: ¿son correctos los servicios y lugares que busca Crewtender? Cada 👍 o 👎 en un resultado afina la búsqueda.",
                  "2. Elegir la hora: ¿cuándo debe llegar el mensaje diario con nuevas licitaciones, por correo o al móvil?",
                  "3. Crewtender en el móvil: abre la página en el navegador y toca «Añadir a pantalla de inicio»."],
                 [("Abrir perfil de búsqueda", "/konto/suchprofil"), ("Elegir hora", "/konto#mail")]),
        "tag3": ("Sube tu primera licitación",
                 ["Hola:", "el mayor ahorro de tiempo con Crewtender: sube los documentos de una licitación. Crewtender lo lee todo y redacta una ficha con lotes, cantidades, plazos y documentación exigida. Con ella calculas el precio con tus propios salarios.",
                  "La prueba incluye 10 fichas a partir de documentos."],
                 [("Subir documentos", "/konto/unterlagen")]),
        "tag10": ("Personal y planificación en Crewtender",
                  ["Hola:", "cuando consigues el contrato, Crewtender sigue ayudando: personal con cualificaciones y certificados, cuadrante revisado según las normas de jornada, horas desde el móvil y lista de nóminas.",
                   "Lo más rápido es importar desde Excel. Después puedes invitar a tu equipo."],
                  [("Importar personal", "/konto/personal/import"), ("Invitar al equipo", "/konto/team")]),
        "fuss": "¿Preguntas? Responde a este correo.", "probe": "Tu prueba con todas las funciones Pro dura hasta el {d}.",
    },
    "it": {
        "tag1": ("Benvenuto in Crewtender – per iniziare",
                 ["Buongiorno,", "che bello avere {f} con noi! Il primo giorno vale la pena fare tre cose:",
                  "1. Controllare il profilo di ricerca: i servizi e i luoghi che Crewtender cerca sono giusti? Ogni 👍 o 👎 su un risultato rende la ricerca più precisa.",
                  "2. Scegliere l'orario: quando deve arrivare il messaggio quotidiano con le nuove gare, via e-mail o sul telefono?",
                  "3. Crewtender sul telefono: apri la pagina nel browser e tocca «Aggiungi a schermata Home»."],
                 [("Apri profilo di ricerca", "/konto/suchprofil"), ("Scegli orario", "/konto#mail")]),
        "tag3": ("Carica la tua prima gara",
                 ["Buongiorno,", "il maggior risparmio di tempo con Crewtender: carica i documenti di una gara. Crewtender legge tutto e scrive una scheda con lotti, quantità, scadenze e documenti richiesti. Da lì calcoli il prezzo con i tuoi salari.",
                  "La prova include 10 schede da documenti."],
                 [("Carica documenti", "/konto/unterlagen")]),
        "tag10": ("Personale e pianificazione in Crewtender",
                  ["Buongiorno,", "quando ottieni l'appalto, Crewtender continua ad aiutarti: personale con qualifiche e attestati, turni verificati secondo le regole sull'orario di lavoro, ore dal telefono e lista paghe.",
                   "Il modo più rapido è l'import da Excel. Poi puoi invitare il tuo team."],
                  [("Importa personale", "/konto/personal/import"), ("Invita il team", "/konto/team")]),
        "fuss": "Domande? Rispondi semplicemente a questa e-mail.", "probe": "La tua prova con tutte le funzioni Pro dura fino al {d}.",
    },
}


def willkommen_stufe(erstellt: datetime, jetzt: datetime) -> str | None:
    """Due welcome stage: from day N for one day (a stage that was missed is not sent days later)."""
    alter = jetzt - erstellt
    for stufe, tage in WILLKOMMEN_STUFEN:
        if timedelta(days=tage) <= alter < timedelta(days=tage + 1):
            return stufe
    return None


def willkommen_mail(an: str, firma: str, stufe: str, probe_bis, sprache: str = "de", zone: ZoneInfo = BERLIN) -> EmailMessage:
    t, tt = WT.get(sprache, WT["en"]), T.get(sprache, T["en"])
    betreff, absaetze, knoepfe = t[stufe]
    absaetze = [a.format(f=firma) for a in absaetze]
    if probe_bis and probe_bis > datetime.now(zone):
        absaetze.append(t["probe"].format(d=probe_bis.astimezone(zone).strftime(tt["tag"])))
    m = EmailMessage()
    m["From"] = formataddr(ABSENDER)
    m["To"] = an
    m["Subject"] = betreff
    m["Message-ID"] = make_msgid(domain="wpdigitalranger.com")
    m.set_content("\n\n".join(absaetze) + "\n\n" + "\n".join(f"{k}: {APP}{u}" for k, u in knoepfe) + f"\n\n{t['fuss']}\n\nCrewtender · WP Digital Ranger · {APP}/impressum\n")
    knopf = lambda k, u, erst: f'<a href="{APP}{u}" style="display:inline-block;padding:10px 16px;border-radius:8px;text-decoration:none;{"background:#1d4ed8;color:#fff" if erst else "color:#1d4ed8"}">{html.escape(k)}</a>'  # noqa: E731
    m.add_alternative(f"""<div style="font-family:system-ui,sans-serif;max-width:640px">{''.join(f'<p>{html.escape(a)}</p>' for a in absaetze)}
<p>{' '.join(knopf(k, u, i == 0) for i, (k, u) in enumerate(knoepfe))}</p>
<p>{html.escape(t['fuss'])}</p>
<p style="color:#666;font-size:13px">Crewtender · WP Digital Ranger · <a href="{APP}/impressum">{tt['impressum']}</a></p></div>""", subtype="html")
    return m


def willkommen(con, smtp, jetzt: datetime | None = None) -> int:
    """Sends due welcome mails to owners and admins (each stage once per firm, from 9 o'clock local time).
    Not for the operator's own firms or the full preview access (example firms)."""
    if not WILLKOMMEN_AKTIV:
        return 0
    try:
        firmen = con.execute("""select f.id::text, f.name, f.erstellt, f.probe_bis from public.firmen f
            where f.erstellt > now() - interval '11 days' and f.paket <> 'test'
              and not exists (select 1 from public.mitglieder m join auth.users u on u.id = m.user_id
                              join jarvis_intern.betreiber b on b.email = lower(u.email) where m.firma_id = f.id)""").fetchall()
    except Exception as e:  # noqa: BLE001
        print(f"Willkommens-Mails übersprungen: {e}", file=sys.stderr)
        return 0
    gesendet = 0
    for firma_id, name, erstellt, probe_bis in firmen:
        sprache, zone = firma_sprache(con, firma_id)
        jetzt_ort = (jetzt or datetime.now(zone)).astimezone(zone)
        stufe = willkommen_stufe(erstellt, jetzt_ort)
        if not stufe or jetzt_ort.hour < 9:
            continue
        try:
            if not con.execute("""insert into jarvis_intern.willkommen_mails (firma_id, stufe) values (%s, %s)
                    on conflict do nothing returning firma_id""", (firma_id, stufe)).fetchone():
                continue
        except Exception as e:  # noqa: BLE001
            print(f"Willkommens-Mail nicht vermerkt: {e}", file=sys.stderr)
            return gesendet
        for (email,) in con.execute("""select u.email from public.mitglieder m join auth.users u on u.id = m.user_id
                where m.firma_id = %s and m.aktiv and m.rolle in ('inhaber', 'admin') and coalesce(u.email, '') <> ''""", (firma_id,)).fetchall():
            smtp.send_message(willkommen_mail(email, name, stufe, probe_bis, sprache, zone))
            gesendet += 1
    return gesendet


def abo_name(suche: str, gebiet: str) -> str:
    """How a subscribed search is named in the mail, e.g. „Gebäudereinigung“ in 52."""
    return " ".join(x for x in (f"„{suche}“" if suche else "", f"in {gebiet}" if gebiet else "") if x) or "alle Ausschreibungen"


def abo_mail(an: str, suche: str, gebiet: str, treffer: list, token: str) -> EmailMessage:
    """Weekly mail of a search subscription (web/src/suchabo.ts): the new public notices, how to get more out of them, and
    the unsubscribe link (also as List-Unsubscribe header for the mail program's own button).

    Plain text only, the same sender name as the confirmation mail and at most ABO_ZEILEN notices with their own link
    (11.11.2026): the first version (HTML with a button and 15 links) went to Gmail's spam folder, while the plain-text
    confirmation mail of the same subscription reached the inbox."""
    name = abo_name(suche, gebiet)
    ab = f"{APP}/abo/abmelden/{token}"
    such_link = f"{APP}/demo/suche?" + urlencode({k: v for k, v in (("q", suche), ("ort", gebiet)) if v})
    zeile = lambda t: " · ".join(x for x in (t[2], t[3], f"Frist {t[4].astimezone(BERLIN).strftime('%d.%m.%Y')}" if t[4] else "") if x)  # noqa: E731
    link = lambda t: f"{APP}/ausschreibung/{quote(t[0], safe='')}"  # noqa: E731
    n = len(treffer)
    rest = n - ABO_ZEILEN
    m = EmailMessage()
    m["From"] = formataddr((ABO_ABSENDER, ABSENDER[1]))
    m["To"] = an
    m["Subject"] = f"{n} neue {'Ausschreibung' if n == 1 else 'Ausschreibungen'} für {name}"[:160]
    m["Message-ID"] = make_msgid(domain="wpdigitalranger.com")
    m["List-Unsubscribe"] = f"<{ab}>"
    m["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    m.set_content(f"Hallo,\n\nneue öffentliche Ausschreibungen für {name}:\n\n"
                  + "\n\n".join(f"{t[1]}\n{zeile(t)}\n{link(t)}" for t in treffer[:ABO_ZEILEN])
                  + (f"\n\nUnd {rest} weitere." if rest > 0 else "")
                  + f"\n\nAlle Treffer: {such_link}\n\n"
                  + "Crewtender bewertet jede Ausschreibung mit 1 bis 10 Punkten für deine Firma, schreibt den Steckbrief und rechnet "
                  + f"mit deinen Löhnen den Preis. 30 Tage Pro gratis testen: {APP}/registrieren\n\n"
                  + f"Du bekommst diese Mail, weil du auf crewtender.eu die Suche {name} abonniert hast.\nAbmelden: {ab}\n\n"
                  + "Crewtender · WP Digital Ranger · Rochusstraße 19, 52531 Übach-Palenberg\n")
    return m


def such_abos_senden(con, smtp, jetzt: datetime | None = None, grenze: int = 40) -> int:
    """Weekly mails of confirmed search subscriptions: between 8 and 18 o'clock, at most `grenze` per hourly run, no AI.
    A subscription is checked once a week; a mail goes out only when there are new notices since the last check."""
    if not 8 <= (jetzt or datetime.now(BERLIN)).astimezone(BERLIN).hour <= 18:
        return 0
    try:
        faellige = con.execute("""select id::text, email, suche, gebiet, token, coalesce(geprueft, bestaetigt - interval '7 days'), geprueft
            from jarvis_intern.such_abos where bestaetigt is not null and (geprueft is null or geprueft < now() - interval '6 days 20 hours')
            order by geprueft nulls first, bestaetigt limit %s""", (grenze,)).fetchall()
    except Exception as e:  # noqa: BLE001 - before the migration: no subscription mails, the rest runs
        print(f"Such-Abos übersprungen: {e}", file=sys.stderr)
        return 0
    gesendet = 0
    for abo_id, email, suche, gebiet, token, seit, vorher in faellige:
        # Claim first: better one mail too few than the same one twice.
        if not con.execute("update jarvis_intern.such_abos set geprueft = now() where id = %s and geprueft is not distinct from %s returning id", (abo_id, vorher)).fetchone():
            continue
        treffer = con.execute("select id, titel, auftraggeber, ort, frist from jarvis_intern.such_abo_treffer(%s, %s, %s)", (suche, gebiet, seit)).fetchall()
        if not treffer:
            continue
        try:
            smtp.send_message(abo_mail(email, suche, gebiet, treffer, token))
        except Exception as e:  # noqa: BLE001 - try again in the next hour, the others still get theirs
            print(f"Such-Abo-Mail nicht verschickt: {type(e).__name__}", file=sys.stderr)
            con.execute("update jarvis_intern.such_abos set geprueft = %s where id = %s", (vorher, abo_id))
            continue
        con.execute("update jarvis_intern.such_abos set letzte_mail = now(), mails = mails + 1 where id = %s", (abo_id,))
        gesendet += 1
    return gesendet


def main() -> None:
    args = sys.argv[1:]
    test = args[1] if args[:1] == ["--test"] and len(args) > 1 else None
    sofort = args[1] if args[:1] == ["--sofort"] and len(args) > 1 and re.fullmatch(r"[0-9a-f-]{36}", args[1]) else None
    stunde = datetime.now(BERLIN).hour
    mails = pushs = 0
    with verbinden() as con, smtplib.SMTP_SSL("mail.privateemail.com", 465, timeout=30) as smtp:
        con.autocommit = True  # each als_person() runs in its own transaction, SET LOCAL ends with it
        smtp.login(ABSENDER[1], os.environ["SMTP_PASSWORD"].strip())
        schl = push.schluessel(con)
        for firma_id, user_id, email, firma, letzte, kanal, fristen_an in faellig(con, stunde, test, sofort):
            seit = datetime.now(BERLIN) - timedelta(days=8) if sofort else letzte or datetime.now(BERLIN) - timedelta(days=1)
            if not (test or sofort):
                senden, fristen_an = regel(*vertretung_heute(con, firma_id, user_id), fristen_an)
                if not senden:  # absent today, the cover gets the deadlines (T12)
                    continue
            neu, fristen = inhalt(con, firma_id, user_id, seit)
            if not fristen_an:  # deadline reminders switched off in the settings (I1)
                fristen = []
            nachweise = [] if test or sofort or kanal not in ("mail", "beides") else ablaufende_nachweise(con, firma_id, user_id)
            if not (neu or fristen or nachweise):
                continue
            sprache, zone = firma_sprache(con, firma_id)
            if plan_der_firma(con, firma_id) == "kostenlos" and not test:
                kanal = "mail"  # Free: weekly summary by mail, phone messages from Basis
            if kanal in ("mail", "beides"):
                smtp.send_message(nachricht(email, firma, neu, fristen, nachweise, sprache, zone))
                mails += 1
            if kanal in ("push", "beides"):
                pushs += handy(con, schl, user_id, firma_id, firma, neu, fristen, sprache=sprache, zone=zone)
            if not test:
                con.execute("update public.benachrichtigungen set letzte_mail = now() where firma_id = %s and user_id = %s", (firma_id, user_id))
                for dokument_id, _name, _gueltig_bis, tage in nachweise:
                    con.execute("insert into public.nachweis_erinnerungen (firma_id,dokument_id,user_id,tage) values (%s,%s,%s,%s) on conflict do nothing", (firma_id, dokument_id, user_id, tage))
        if not (test or sofort):
            mails += probe_erinnerungen(con, smtp)
            mails += willkommen(con, smtp)
            mails += such_abos_senden(con, smtp)
            pushs += warteschlange(con, schl)
            # Deadline-day message at 7, or at the end of the person's quiet hours when 7 falls into them (I2).
            for firma_id, user_id, von, bis in con.execute("""select b.firma_id::text, b.user_id::text, b.ruhe_von, b.ruhe_bis from public.benachrichtigungen b
                    join public.mitglieder m on m.firma_id = b.firma_id and m.user_id = b.user_id and m.aktiv
                    where b.stunde is not null and b.kanal in ('push', 'beides')
                      and (b.fristen or exists(select 1 from public.vertretungen v where v.firma_id = b.firma_id and v.vertreter_id = b.user_id
                                                 and (now() at time zone 'Europe/Berlin')::date between v.von and v.bis))
                      and not exists(select 1 from public.vertretungen v where v.firma_id = b.firma_id and v.user_id = b.user_id
                                       and (now() at time zone 'Europe/Berlin')::date between v.von and v.bis)""").fetchall():
                sprache, zone = firma_sprache(con, firma_id)
                if plan_der_firma(con, firma_id) == "kostenlos":
                    continue
                if (stunde if zone == BERLIN else ortsstunde(zone)) == morgen_stunde(von, bis):
                    pushs += morgen_push(con, schl, user_id, firma_id, heute_faellig(con, firma_id, user_id), sprache, zone)
    print(f"{stunde} Uhr: {mails} Mails, {pushs} Handy-Benachrichtigungen")


if __name__ == "__main__":
    main()
