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


if __name__ == "__main__":
    unittest.main()
