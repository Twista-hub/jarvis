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


if __name__ == "__main__":
    unittest.main()
