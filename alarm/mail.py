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
from zoneinfo import ZoneInfo

import push
from profile_db import verbinden

APP = "https://app.wpdigitalranger.com"
ABSENDER = ("Jarvis", "kontakt@wpdigitalranger.com")
BERLIN = ZoneInfo("Europe/Berlin")
ERINNERN = (7, 2)  # days before the deadline
MORGENS = 7  # hour of the phone notification on the deadline day


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
    return con.execute(basis + "b.stunde = %s and (b.letzte_mail is null or b.letzte_mail < now() - interval '20 hours')", (stunde,)).fetchall()


def handy(con, schl, user_id: str, firma_id: str, firma: str, neu: list, fristen: list, sofort: bool = False) -> int:
    """Phone notification: one tap opens the hit (one new) or the list (several)."""
    if sofort and neu:
        vid, titel, punkte, _ = neu[0]
        kopf = f"⭐ Top-Treffer {punkte}/10" if len(neu) == 1 else f"⭐ {len(neu)} Top-Treffer für {firma}"
        text = titel + (f" · und {len(neu) - 1} weitere" if len(neu) > 1 else "")
        url = f"/konto/vorgang/{vid}" if len(neu) == 1 else f"/konto/treffer?firma={firma_id}"
    elif fristen and not neu:
        vid, titel, frist = fristen[0]
        kopf, text, url = f"⏰ Frist {datum(frist)}", titel, f"/konto/vorgang/{vid}"
    elif len(neu) == 1:
        vid, titel, punkte, _ = neu[0]
        kopf, text, url = f"Neue Ausschreibung{f' · {punkte}/10' if punkte else ''}", titel, f"/konto/vorgang/{vid}"
    else:
        kopf = f"{len(neu)} neue Ausschreibungen für {firma}"
        text = neu[0][1] + (f" · und {len(fristen)} Fristen bald" if fristen else "")
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
    if not vorgang_ids:
        return 0
    stunde = datetime.now(BERLIN).hour
    leute = con.execute("""select b.user_id::text, b.sofort_ab, b.ruhe_von, b.ruhe_bis, f.name from public.benachrichtigungen b
        join public.mitglieder m on m.firma_id = b.firma_id and m.user_id = b.user_id and m.aktiv
        join public.firmen f on f.id = b.firma_id
        where b.firma_id = %s and b.sofort_ab is not null and b.kanal in ('push', 'beides')""", (firma_id,)).fetchall()
    leute = [p for p in leute if not in_ruhezeit(stunde, p[2], p[3])]
    if not leute:
        return 0
    schl = push.schluessel(con)
    gesendet = 0
    for user_id, ab, _von, _bis, firma in leute:
        treffer = als_person(con, user_id, """select id::text, titel, punkte, frist from public.vorgaenge
            where firma_id = %s and id::text = any(%s) and punkte >= %s order by punkte desc""", (firma_id, vorgang_ids, ab))
        if treffer:
            gesendet += handy(con, schl, user_id, firma_id, firma, treffer, [], sofort=True)
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


def morgen_push(con, schl, user_id: str, firma_id: str, termine: list) -> int:
    """One phone notification in the morning of a deadline day; at most once a day per person."""
    if not termine or con.execute("""select 1 from public.push_nachrichten where user_id = %s and titel like '⏰ Heute%%'
            and erstellt > now() - interval '20 hours'""", (user_id,)).fetchone():
        return 0
    vid, titel, zeit, art = termine[0]
    kopf = f"⏰ Heute {'Frist' if len(termine) == 1 else f'{len(termine)} Fristen'} · {art} {zeit.astimezone(BERLIN):%H:%M} Uhr"
    text = titel + (f" · und {len(termine) - 1} weitere" if len(termine) > 1 else "")
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


def datum(t) -> str:
    return t.astimezone(BERLIN).strftime("%d.%m.%Y, %H:%M Uhr") if t else "unbekannt"


def nachricht(an: str, firma: str, neu: list, fristen: list, nachweise: list = ()) -> EmailMessage:
    zeilen, html_teile = [], []
    if fristen:
        zeilen.append("⏰ Fristen bald:")
        html_teile.append("<h2>⏰ Fristen bald</h2><ul>")
        for vid, titel, frist in fristen:
            zeilen.append(f"- {titel} – Abgabe {datum(frist)}\n  {APP}/konto/vorgang/{vid}")
            html_teile.append(f'<li><a href="{APP}/konto/vorgang/{vid}">{html.escape(titel)}</a> – Abgabe <strong>{datum(frist)}</strong></li>')
        html_teile.append("</ul>")
    if neu:
        zeilen.append(f"\n🔎 {len(neu)} neue Ausschreibungen:")
        html_teile.append(f"<h2>🔎 {len(neu)} neue Ausschreibungen</h2><ul>")
        for vid, titel, punkte, frist in neu:
            p = f"{punkte}/10 · " if punkte else ""
            zeilen.append(f"- {p}{titel} (Frist {datum(frist)})\n  {APP}/konto/vorgang/{vid}")
            html_teile.append(f'<li>{p}<a href="{APP}/konto/vorgang/{vid}">{html.escape(titel)}</a> <small>(Frist {datum(frist)})</small></li>')
        html_teile.append("</ul>")
    if nachweise:
        zeilen.append("\n📄 Firmen-Nachweise laufen bald ab:")
        html_teile.append("<h2>📄 Firmen-Nachweise laufen bald ab</h2><ul>")
        for _id, name, gueltig_bis, tage in nachweise:
            zeilen.append(f"- {name} – gültig bis {gueltig_bis:%d.%m.%Y} (in {tage} Tagen)\n  {APP}/konto/firmenunterlagen")
            html_teile.append(f'<li><a href="{APP}/konto/firmenunterlagen">{html.escape(name)}</a> – gültig bis <strong>{gueltig_bis:%d.%m.%Y}</strong> (in {tage} Tagen)</li>')
        html_teile.append("</ul>")
    fuss = f"Uhrzeit ändern oder Mails abschalten: {APP}/konto#mail"
    m = EmailMessage()
    m["From"] = formataddr(ABSENDER)
    m["To"] = an
    betreff = f"{len(neu)} neue Ausschreibungen" if neu else "Fristen-Erinnerung" if fristen else "Nachweise laufen bald ab"
    m["Subject"] = betreff + f" für {firma}"[:150]
    m["Message-ID"] = make_msgid(domain="wpdigitalranger.com")
    # Lets mail programs show an "unsubscribe" button; both lead to switching the mail off.
    m["List-Unsubscribe"] = f"<mailto:{ABSENDER[1]}?subject=Jarvis-Mail%20abbestellen>, <{APP}/konto#mail>"
    m.set_content("\n".join(zeilen) + f"\n\n{fuss}\n")
    m.add_alternative(f"""<div style="font-family:system-ui,sans-serif;max-width:640px">{''.join(html_teile)}
<p><a href="{APP}/konto">Alle Treffer in Jarvis öffnen</a></p>
<p style="color:#666;font-size:13px">{html.escape(fuss)}<br>Jarvis · WP Digital Ranger · <a href="{APP}/impressum">Impressum</a></p></div>""", subtype="html")
    return m


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
            neu, fristen = inhalt(con, firma_id, user_id, seit)
            if not fristen_an:  # deadline reminders switched off in the settings (I1)
                fristen = []
            nachweise = [] if test or sofort or kanal not in ("mail", "beides") else ablaufende_nachweise(con, firma_id, user_id)
            if not (neu or fristen or nachweise):
                continue
            if kanal in ("mail", "beides"):
                smtp.send_message(nachricht(email, firma, neu, fristen, nachweise))
                mails += 1
            if kanal in ("push", "beides"):
                pushs += handy(con, schl, user_id, firma_id, firma, neu, fristen)
            if not test:
                con.execute("update public.benachrichtigungen set letzte_mail = now() where firma_id = %s and user_id = %s", (firma_id, user_id))
                for dokument_id, _name, _gueltig_bis, tage in nachweise:
                    con.execute("insert into public.nachweis_erinnerungen (firma_id,dokument_id,user_id,tage) values (%s,%s,%s,%s) on conflict do nothing", (firma_id, dokument_id, user_id, tage))
        if not (test or sofort):
            # Deadline-day message at 7, or at the end of the person's quiet hours when 7 falls into them (I2).
            for firma_id, user_id, von, bis in con.execute("""select b.firma_id::text, b.user_id::text, b.ruhe_von, b.ruhe_bis from public.benachrichtigungen b
                    join public.mitglieder m on m.firma_id = b.firma_id and m.user_id = b.user_id and m.aktiv
                    where b.stunde is not null and b.fristen and b.kanal in ('push', 'beides')""").fetchall():
                if stunde == morgen_stunde(von, bis):
                    pushs += morgen_push(con, schl, user_id, firma_id, heute_faellig(con, firma_id, user_id))
    print(f"{stunde} Uhr: {mails} Mails, {pushs} Handy-Benachrichtigungen")


if __name__ == "__main__":
    main()
