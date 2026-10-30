"""Daily mail: new hits and deadline reminders, at the hour each person chose (table benachrichtigungen).

Runs every hour (.github/workflows/mail.yml). Each person only gets what they may see in the app: the
queries run as that person (role authenticated with their user id), so the row level security applies.
Usage: SUPABASE_DB_PASSWORD=... SMTP_PASSWORD=... python3 alarm/mail.py [--test <email>]
"""
import html
import json
import os
import smtplib
import sys
from datetime import datetime, timedelta
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from zoneinfo import ZoneInfo

from profile_db import verbinden

APP = "https://jarvis-alarm.benschiffer79.workers.dev"
ABSENDER = ("Jarvis", "kontakt@wpdigitalranger.com")
BERLIN = ZoneInfo("Europe/Berlin")
ERINNERN = (7, 2)  # days before the deadline


def faellig(con, stunde: int, test: str | None) -> list[tuple]:
    if test:  # test mail: all firms of this person, hits of the last 24 hours, whatever the setting
        return con.execute("""select m.firma_id::text, m.user_id::text, u.email, f.name, null::timestamptz
            from public.mitglieder m join public.firmen f on f.id = m.firma_id join auth.users u on u.id = m.user_id
            where m.aktiv and u.email = %s""", (test,)).fetchall()
    return con.execute("""select b.firma_id::text, b.user_id::text, u.email, f.name, b.letzte_mail
        from public.benachrichtigungen b
        join public.mitglieder m on m.firma_id = b.firma_id and m.user_id = b.user_id and m.aktiv
        join public.firmen f on f.id = b.firma_id
        join auth.users u on u.id = b.user_id
        where b.stunde = %s and (b.letzte_mail is null or b.letzte_mail < now() - interval '20 hours')""", (stunde,)).fetchall()


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


def datum(t) -> str:
    return t.astimezone(BERLIN).strftime("%d.%m.%Y, %H:%M Uhr") if t else "unbekannt"


def nachricht(an: str, firma: str, neu: list, fristen: list) -> EmailMessage:
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
    fuss = f"Uhrzeit ändern oder Mails abschalten: {APP}/konto#mail"
    m = EmailMessage()
    m["From"] = formataddr(ABSENDER)
    m["To"] = an
    m["Subject"] = (f"{len(neu)} neue Ausschreibungen" if neu else "Fristen-Erinnerung") + f" für {firma}"[:150]
    m["Message-ID"] = make_msgid(domain="wpdigitalranger.com")
    # Lets mail programs show an "unsubscribe" button; both lead to switching the mail off.
    m["List-Unsubscribe"] = f"<mailto:{ABSENDER[1]}?subject=Jarvis-Mail%20abbestellen>, <{APP}/konto#mail>"
    m.set_content("\n".join(zeilen) + f"\n\n{fuss}\n")
    m.add_alternative(f"""<div style="font-family:system-ui,sans-serif;max-width:640px">{''.join(html_teile)}
<p><a href="{APP}/konto">Alle Treffer in Jarvis öffnen</a></p>
<p style="color:#666;font-size:13px">{html.escape(fuss)}<br>Jarvis · WP Digital Ranger · <a href="{APP}/impressum">Impressum</a></p></div>""", subtype="html")
    return m


def main() -> None:
    test = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--test" else None
    stunde = datetime.now(BERLIN).hour
    gesendet = 0
    with verbinden() as con, smtplib.SMTP_SSL("mail.privateemail.com", 465, timeout=30) as smtp:
        con.autocommit = True  # each als_person() runs in its own transaction, SET LOCAL ends with it
        smtp.login(ABSENDER[1], os.environ["SMTP_PASSWORD"].strip())
        for firma_id, user_id, email, firma, letzte in faellig(con, stunde, test):
            seit = letzte or datetime.now(BERLIN) - timedelta(days=1)
            neu, fristen = inhalt(con, firma_id, user_id, seit)
            if neu or fristen:
                smtp.send_message(nachricht(email, firma, neu, fristen))
                gesendet += 1
            if not test:
                con.execute("update public.benachrichtigungen set letzte_mail = now() where firma_id = %s and user_id = %s", (firma_id, user_id))
    print(f"{stunde} Uhr: {gesendet} Mails verschickt")


if __name__ == "__main__":
    main()
