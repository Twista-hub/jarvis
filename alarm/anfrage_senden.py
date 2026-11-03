"""Send one approved request from docs/anfragen/*.md via kontakt@wpdigitalranger.com (Crewtender' own mailbox).

The file names the recipient in the line "**An:** <address> …", the subject in "**Betreff:** …"; the mail text is the
part between the first two lines that consist only of "---". A copy goes to kontakt@ (Bcc) as a record.
Only for requests Benjamin approved (CLAUDE.md: mails to third parties only after his OK).
Usage: SMTP_PASSWORD=... python3 alarm/anfrage_senden.py docs/anfragen/x.md [--probe]
"""
import os
import re
import smtplib
import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid

ABSENDER = ("Benjamin Schiffer – WP Digital Ranger", "kontakt@wpdigitalranger.com")


def lesen(text: str) -> tuple[str, str, str]:
    an = re.search(r"^\*\*An:\*\*\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)", text, re.M)
    betreff = re.search(r"^\*\*Betreff:\*\*\s*(.+)$", text, re.M)
    teile = re.split(r"^---\s*$", text, flags=re.M)
    if not an or not betreff or len(teile) < 3:
        raise SystemExit("Empfänger, Betreff oder Text fehlt")
    return an.group(1), betreff.group(1).strip(), teile[1].strip() + "\n"


def nachricht(an: str, betreff: str, text: str) -> EmailMessage:
    m = EmailMessage()
    m["From"] = f"{ABSENDER[0]} <{ABSENDER[1]}>"
    m["To"] = an
    m["Bcc"] = ABSENDER[1]
    m["Reply-To"] = ABSENDER[1]
    m["Subject"] = betreff
    m["Date"] = formatdate(localtime=True)
    m["Message-ID"] = make_msgid(domain="wpdigitalranger.com")
    m.set_content(text)
    return m


def main() -> None:
    datei = sys.argv[1]
    if not re.fullmatch(r"docs/anfragen/[\w-]+\.md", datei):
        raise SystemExit("nur Dateien aus docs/anfragen/")
    an, betreff, text = lesen(open(datei, encoding="utf-8").read())
    m = nachricht(an, betreff, text)
    print(f"An: {an}\nBetreff: {betreff}\nZeichen: {len(text)}\n---\n{text[:400]}…")
    if "--probe" in sys.argv:
        return
    with smtplib.SMTP_SSL("mail.privateemail.com", 465, timeout=30) as smtp:
        smtp.login(ABSENDER[1], os.environ["SMTP_PASSWORD"].strip())
        smtp.send_message(m)
    print("GESENDET")


if __name__ == "__main__":
    main()
