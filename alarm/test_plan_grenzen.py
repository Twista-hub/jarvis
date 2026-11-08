"""Plan limits in the daily search and the notifications (migration 20261107020000)."""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).parent))
import mail  # noqa: E402
import profile_db  # noqa: E402

BERLIN = ZoneInfo("Europe/Berlin")


class PlanGrenzenTest(unittest.TestCase):
    def test_free_nur_montags_einmal_pro_woche(self):
        montag = datetime(2026, 11, 9, 7, tzinfo=BERLIN)
        self.assertTrue(mail.woechentlich_faellig("kostenlos", None, montag))
        self.assertTrue(mail.woechentlich_faellig("kostenlos", montag - timedelta(days=7), montag))
        self.assertFalse(mail.woechentlich_faellig("kostenlos", montag - timedelta(days=2), montag))
        self.assertFalse(mail.woechentlich_faellig("kostenlos", None, montag + timedelta(days=1)))

    def test_andere_plaene_taeglich(self):
        dienstag = datetime(2026, 11, 10, 7, tzinfo=BERLIN)
        for plan in ("basis", "pro", "probe", "business", "test", None):
            self.assertTrue(mail.woechentlich_faellig(plan, dienstag - timedelta(days=1), dienstag), plan)

    def test_suche_nach_plan_gekuerzt(self):
        e = {"laender": ["DEU", "AUT", "FRA"], "zusatzprofile": [{"id": "a"}, {"id": "b"}, {"id": "c"}]}
        frei = profile_db.nach_plan(e, "kostenlos")
        self.assertEqual((frei["laender"], frei["zusatzprofile"]), (["DEU"], []))
        basis = profile_db.nach_plan(e, "basis")
        self.assertEqual((basis["laender"], len(basis["zusatzprofile"])), (["DEU", "AUT"], 2))
        for plan in ("pro", "probe", "business", "test", None):
            self.assertIs(profile_db.nach_plan(e, plan), e)
        self.assertEqual(len(e["zusatzprofile"]), 3, "gespeicherte Einstellungen bleiben unverändert")

    def test_probe_stufen(self):
        ende = datetime(2026, 12, 4, 15, tzinfo=BERLIN)
        self.assertIsNone(mail.probe_stufe(ende, ende - timedelta(days=8)))
        self.assertEqual(mail.probe_stufe(ende, ende - timedelta(days=7)), "tag23")
        self.assertEqual(mail.probe_stufe(ende, ende - timedelta(days=3)), "tag23")
        self.assertEqual(mail.probe_stufe(ende, ende - timedelta(days=2)), "tag28")
        self.assertIsNone(mail.probe_stufe(ende, ende + timedelta(minutes=1)))

    def test_probe_mail_in_allen_sprachen(self):
        ende = datetime(2026, 12, 4, 15, tzinfo=BERLIN)
        for sprache in mail.PT:
            m = mail.probe_mail("chef@firma.example", "Malerbetrieb <Test>", ende, "tag28", sprache)
            text = m.get_body(("plain",)).get_content()
            self.assertIn("2026", m["Subject"], sprache)
            self.assertIn("Malerbetrieb <Test>", text)
            self.assertIn("https://crewtender.eu/konto/plan", text)
            self.assertIn("Malerbetrieb &lt;Test&gt;", m.get_body(("html",)).get_content(), "HTML maskiert den Firmennamen")
        self.assertEqual(mail.probe_mail("a@b.example", "X", ende, "tag23")["Subject"], "Deine Crewtender-Probezeit endet am 04.12.2026")
        self.assertTrue(mail.probe_mail("a@b.example", "X", ende, "tag23", "en")["Subject"].startswith("Your Crewtender trial ends on Dec 04"))

    def test_probe_erinnerung_nur_einmal_und_nur_an_leitung(self):
        ende = datetime.now(BERLIN).replace(hour=12) + timedelta(days=6)

        class Ergebnis:
            def __init__(self, zeilen):
                self.zeilen = zeilen

            def fetchall(self):
                return self.zeilen

            def fetchone(self):
                return self.zeilen[0] if self.zeilen else None

        class Con:
            empfaenger_sql = ""

            def __init__(self):
                self.vermerkt = set()

            def execute(self, sql, args=()):
                if "from public.firmen f" in sql:
                    return Ergebnis([("f1", "Firma", ende)])
                if "insert into jarvis_intern.probe_erinnerungen" in sql:
                    neu = args not in self.vermerkt
                    self.vermerkt.add(args)
                    return Ergebnis([("f1",)] if neu else [])
                if "from public.mitglieder" in sql:
                    Con.empfaenger_sql = sql
                    return Ergebnis([("chef@firma.example",)])
                raise AssertionError(sql)

        class Smtp:
            gesendet: list = []

            def send_message(self, m):
                self.gesendet.append(m)

        mail._firmen["f1"] = ("de", BERLIN)
        con, smtp, mittag = Con(), Smtp(), datetime.now(BERLIN).replace(hour=12)
        self.assertEqual(mail.probe_erinnerungen(con, smtp, mittag.replace(hour=6)), 0, "nicht vor 8 Uhr")
        self.assertEqual(con.vermerkt, set(), "vor 8 Uhr wird auch nichts vermerkt")
        self.assertEqual(mail.probe_erinnerungen(con, smtp, mittag), 1)
        self.assertEqual(mail.probe_erinnerungen(con, smtp, mittag), 0, "gleiche Stufe nur einmal")
        self.assertIn("'inhaber', 'admin'", Con.empfaenger_sql)

    def test_willkommen_stufen_und_texte(self):
        erstellt = datetime(2026, 11, 8, 10, tzinfo=BERLIN)
        self.assertIsNone(mail.willkommen_stufe(erstellt, erstellt + timedelta(hours=20)))
        self.assertEqual(mail.willkommen_stufe(erstellt, erstellt + timedelta(days=1, hours=1)), "tag1")
        self.assertEqual(mail.willkommen_stufe(erstellt, erstellt + timedelta(days=3)), "tag3")
        self.assertEqual(mail.willkommen_stufe(erstellt, erstellt + timedelta(days=10, hours=5)), "tag10")
        self.assertIsNone(mail.willkommen_stufe(erstellt, erstellt + timedelta(days=5)), "verpasste Stufe kommt nicht später")
        for sprache in mail.WT:
            for stufe, _ in mail.WILLKOMMEN_STUFEN:
                m = mail.willkommen_mail("chef@firma.example", "Maler <Test>", stufe, datetime.now(BERLIN) + timedelta(days=20), sprache)
                text = m.get_body(("plain",)).get_content()
                self.assertIn("https://crewtender.eu/konto/", text, (sprache, stufe))
                self.assertNotIn("Maler <Test>", m.get_body(("html",)).get_content(), "HTML maskiert")
        self.assertIn("Maler <Test> dabei", mail.willkommen_mail("a@b.example", "Maler <Test>", "tag1", None).get_body(("plain",)).get_content())
        self.assertFalse(mail.WILLKOMMEN_AKTIV, "erst nach Benjamins OK einschalten")


if __name__ == "__main__":
    unittest.main()
