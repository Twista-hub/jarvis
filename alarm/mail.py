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

APP = "https://jarvis-alarm.benschiffer79.workers.dev"
ABSENDER = ("Jarvis", "kontakt@wpdigitalranger.com")
BERLIN = ZoneInfo("Europe/Berlin")
ERINNERN = (7, 2)  # days before the deadline


def faellig(con, stunde: int, test: str | None, sofort: str | None) -> list[tuple]:
    """(firma_id, user_id, email, firm name, last sent, channel) for everyone due now."""
    if test:  # test: all firms of this person, hits of the last 24 hours, mail and phone
        return con.execute("""select m.firma_id::text, m.user_id::text, u.email, f.name, null::timestamptz, 'beides'
            from public.mitglieder m join public.firmen f on f.id = m.firma_id join auth.users u on u.id = m.user_id
            where m.aktiv and u.email = %s""", (test,)).fetchall()
    basis = """select b.firma_id::text, b.user_id::text, u.email, f.name, b.letzte_mail, b.kanal
        from public.benachrichtigungen b
        join public.mitglieder m on m.firma_id = b.firma_id and m.user_id = b.user_id and m.aktiv
        join public.firmen f on f.id = b.firma_id
        join auth.users u on u.id = b.user_id
        where b.stunde is not null and """
    if sofort:  # first hit list right after the setup assistant: everyone of this firm who wants news
        return con.execute(basis + "b.firma_id = %s", (sofort,)).fetchall()
    return con.execute(basis + "b.stunde = %s and (b.letzte_mail is null or b.letzte_mail < now() - interval '20 hours')", (stunde,)).fetchall()


def handy(con, schl, user_id: str, firma_id: str, firma: str, neu: list, fristen: list) -> int:
    """Phone notification: one tap opens the hit (one new) or the list (several)."""
    if fristen and not neu:
        vid, titel, frist = fristen[0]
        kopf, text, url = f"⏰ Frist {datum(frist)}", titel, f"/konto/vorgang/{vid}"
    elif len(neu) == 1:
        vid, titel, punkte, _ = neu[0]
        kopf, text, url = f"Neue Ausschreibung{f' · {punkte}/10' if punkte else ''}", titel, f"/konto/vorgang/{vid}"
    else:
        kopf = f"{len(neu)} neue Ausschreibungen für {firma}"
        text = neu[0][1] + (f" · und {len(fristen)} Fristen bald" if fristen else "")
        url = f"/konto/treffer?firma={firma_id}"
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
        order by punkte desc nulls last, erstellt desc limit 30""", (firma_id, seit))
    heute = datetime.now(BERLIN).date()
    tage = [heute + timedelta(days=d) for d in ERINNERN]
    fristen = als_person(con, user_id, """select id::text, titel, frist from public.vorgaenge
        where firma_id = %s and status in ('neu', 'pruefen', 'angebot')
          and (frist at time zone 'Europe/Berlin')::date = any(%s) order by frist""", (firma_id, tage))
    return neu, fristen


def ablaufende_nachweise(con, firma_id: str, user_id: str) -> list[tuple]:
    """One reminder on 30/14/7/2 days, only for people with enabled firm email and finance access."""
    heute = datetime.now(BERLIN).date()
    faellig = [heute + timedelta(days=d) for d in (30, 14, 7, 2)]
    return con.execute("""select d.id::text, d.name, d.gueltig_bis, (d.gueltig_bis-current_date)::int
        from public.firmenunterlagen d
        join public.mitglieder m on m.firma_id=d.firma_id and m.user_id=%s and m.aktiv
        join public.benachrichtigungen b on b.firma_id=m.firma_id and b.user_id=m.user_id and b.stunde is not null and b.kanal in ('mail','beides')
        where d.firma_id=%s and d.art='nachweis' and d.gueltig_bis=any(%s)
          and (m.rolle in ('inhaber','admin') or (m.rolle in ('bearbeiter','leser') and m.finanzen))
          and not exists(select 1 from public.nachweis_erinnerungen e where e.dokument_id=d.id and e.user_id=m.user_id and e.tage=(d.gueltig_bis-%s)::int)
        order by d.gueltig_bis,d.name""", (user_id, firma_id, faellig, heute)).fetchall()


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
        for firma_id, user_id, email, firma, letzte, kanal in faellig(con, stunde, test, sofort):
            seit = datetime.now(BERLIN) - timedelta(days=8) if sofort else letzte or datetime.now(BERLIN) - timedelta(days=1)
            neu, fristen = inhalt(con, firma_id, user_id, seit)
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
    print(f"{stunde} Uhr: {mails} Mails, {pushs} Handy-Benachrichtigungen")


if __name__ == "__main__":
    main()
