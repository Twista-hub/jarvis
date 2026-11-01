"""Tests for customer-facing daily reminder formatting."""
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import mail  # noqa: E402


class NachweisErinnerung(unittest.TestCase):
    def test_email_contains_expiry_and_escapes_file_name(self):
        name = '<script>alert("x")</script>.pdf'
        message = mail.nachricht(
            "chef@example.test",
            "Beispielfirma",
            [],
            [],
            [("doc-id", name, date(2026, 11, 6), 7)],
        )

        self.assertIn("Nachweise laufen bald ab", message["Subject"])
        self.assertIn("06.11.2026 (in 7 Tagen)", message.get_body(preferencelist=("plain",)).get_content())
        html = message.get_body(preferencelist=("html",)).get_content()
        self.assertIn("&lt;script&gt;", html)
        self.assertNotIn("<script>", html)


class MorgenPush(unittest.TestCase):
    def _con(self, schon_gesendet=False):
        from unittest.mock import MagicMock
        con = MagicMock()
        con.execute.return_value.fetchone.return_value = (1,) if schon_gesendet else None
        return con

    def test_one_deadline_opens_the_tender(self):
        from datetime import datetime, timezone
        from unittest.mock import patch
        con = self._con()
        with patch.object(mail, "senden_an_geraete", return_value=1) as senden:
            n = mail.morgen_push(con, ("a", "b"), "u1", "f1", [("v1", "Reinigung Rathaus", datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc), "Abgabe")])
        self.assertEqual(n, 1)
        _, _, _, kopf, text, url = senden.call_args.args
        self.assertEqual(kopf, "⏰ Heute Frist · Abgabe 10:00 Uhr")
        self.assertEqual(url, "/konto/vorgang/v1")

    def test_several_deadlines_open_the_list_and_only_once_a_day(self):
        from datetime import datetime, timezone
        from unittest.mock import patch
        zeit = datetime(2026, 11, 2, 8, 0, tzinfo=timezone.utc)
        liste = [(None, "Baustelle besichtigen", zeit, "Termin"), ("v2", "Bauhof", zeit, "Fragen")]
        with patch.object(mail, "senden_an_geraete", return_value=1) as senden:
            mail.morgen_push(self._con(), ("a", "b"), "u1", "f1", liste)
            self.assertIn("2 Fristen", senden.call_args.args[3])
            self.assertEqual(senden.call_args.args[5], "/konto/fristen?firma=f1")
            senden.reset_mock()
            self.assertEqual(mail.morgen_push(self._con(schon_gesendet=True), ("a", "b"), "u1", "f1", liste), 0)
            self.assertEqual(mail.morgen_push(self._con(), ("a", "b"), "u1", "f1", []), 0)
            senden.assert_not_called()


class Einstellungen(unittest.TestCase):
    def test_ruhezeit_auch_ueber_mitternacht(self):
        self.assertTrue(mail.in_ruhezeit(22, 20, 7))
        self.assertTrue(mail.in_ruhezeit(6, 20, 7))
        self.assertFalse(mail.in_ruhezeit(7, 20, 7))
        self.assertTrue(mail.in_ruhezeit(13, 12, 14))
        self.assertFalse(mail.in_ruhezeit(14, 12, 14))
        self.assertFalse(mail.in_ruhezeit(3, None, None))
        self.assertEqual(mail.morgen_stunde(None, None), 7)
        self.assertEqual(mail.morgen_stunde(21, 8), 8)  # 7 Uhr liegt in der Ruhezeit: Frist-Nachricht um 8
        self.assertEqual(mail.morgen_stunde(22, 6), 7)

    def test_sofortnachricht_nur_ab_punktzahl_ausserhalb_der_ruhezeit(self):
        from datetime import datetime
        from unittest.mock import MagicMock, patch
        con = MagicMock()
        con.execute.return_value.fetchall.return_value = [("u1", 8, None, None, "Perlease"), ("u2", 9, 0, 0, "Perlease"), ("u3", 8, 0, 23, "Perlease")]
        with patch.object(mail, "als_person", side_effect=lambda c, uid, sql, args: [("v1", "Kantine", 9, None)] if args[2] <= 9 else []) as person, \
             patch.object(mail, "senden_an_geraete", return_value=1) as senden, patch.object(mail.push, "schluessel", return_value=("a", "b")), \
             patch.object(mail, "datetime") as uhr:
            uhr.now.return_value = datetime(2026, 11, 1, 12, 0)
            self.assertEqual(mail.sofort_melden(con, "f1", ["v1"]), 2)  # u3 hat 0–23 Uhr Ruhe
        self.assertEqual([c.args[1] for c in person.call_args_list], ["u1", "u2"])
        self.assertEqual(senden.call_args.args[3], "⭐ Top-Treffer 9/10")
        self.assertEqual(senden.call_args.args[5], "/konto/vorgang/v1")
        self.assertEqual(mail.sofort_melden(con, "f1", []), 0)


if __name__ == "__main__":
    unittest.main()


class Vertretung(unittest.TestCase):
    def test_abwesende_bekommen_nichts_vertretung_immer_fristen(self):
        self.assertEqual(mail.regel(True, False, True), (False, False))
        self.assertEqual(mail.regel(True, True, True), (False, False))
        self.assertEqual(mail.regel(False, True, False), (True, True))
        self.assertEqual(mail.regel(False, False, False), (True, False))
        self.assertEqual(mail.regel(False, False, True), (True, True))

    def test_vertretung_heute_fragt_beide_richtungen(self):
        class Con:
            def execute(self, sql, args):
                self.sql, self.args = sql, args
                return self

            def fetchone(self):
                return (False, True)

        con = Con()
        self.assertEqual(mail.vertretung_heute(con, "f1", "u1"), (False, True))
        self.assertIn("vertreter_id", con.sql)
        self.assertEqual((con.args[0], con.args[1], con.args[3], con.args[4]), ("f1", "u1", "f1", "u1"))


class Warteschlange(unittest.TestCase):
    def test_mehrere_nachrichten_einer_person_werden_zusammengefasst(self):
        class Con:
            def __init__(self):
                self.sql = []

            def execute(self, sql, args=()):
                self.sql.append((sql, args))
                return self

            def fetchall(self):
                return [("1", "u1", "📅 Neue Schicht 03.11.", "Messe", "/konto/ich#schichten"),
                        ("2", "u1", "📅 Neue Schicht 04.11.", "Messe", "/konto/ich#schichten"),
                        ("3", "u2", "📌 Betriebsversammlung", "Freitag", "/konto/brett")]

        gesendet = []
        alt = mail.senden_an_geraete
        mail.senden_an_geraete = lambda con, schl, user, titel, text, url: gesendet.append((user, titel, url)) or 1
        try:
            con = Con()
            self.assertEqual(mail.warteschlange(con, None), 2)
        finally:
            mail.senden_an_geraete = alt
        self.assertEqual(gesendet, [("u1", "2 neue Nachrichten", "/konto"), ("u2", "📌 Betriebsversammlung", "/konto/brett")])
        self.assertTrue(any("set gesendet" in q and a == (["1", "2", "3"],) for q, a in con.sql))
