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


class Franzoesisch(unittest.TestCase):
    def test_mail_auf_franzoesisch(self):
        from datetime import datetime, timezone
        frist = datetime(2026, 11, 20, 13, 0, tzinfo=timezone.utc)  # 14h00 Paris
        m = mail.nachricht("chef@example.test", "Nettoyage Dupont SARL", [("v1", "Nettoyage des locaux", 8, frist), ("v3", "Vitrerie", 7, None)], [("v2", "Espaces verts", frist)],
                           [("d1", "Attestation URSSAF.pdf", date(2026, 12, 1), 1)], "fr", mail.PARIS)
        self.assertEqual(m["Subject"], "Nouveau : 2 appels d'offres pour Nettoyage Dupont SARL")
        text = m.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("Échéances proches\u00a0:", text)
        self.assertIn("remise 20/11/2026 à 14h00", text)
        self.assertIn("date limite inconnue", text)
        self.assertIn("valable jusqu'au 01/12/2026 (dans 1 jour)", text)
        self.assertNotIn("Ausschreibung", text)
        self.assertIn("Ouvrir tous les résultats dans Jarvis", m.get_body(preferencelist=("html",)).get_content())

    def test_handy_auf_franzoesisch(self):
        from unittest.mock import MagicMock, patch
        from datetime import datetime, timezone
        with patch.object(mail, "senden_an_geraete", return_value=1) as senden:
            mail.handy(MagicMock(), ("a", "b"), "u1", "f1", "Dupont", [("v1", "A", 7, None), ("v2", "B", 6, None)], [("v3", "C", None), ("v4", "D", None)], sprache="fr")
            self.assertEqual(senden.call_args.args[3], "Nouveau : 2 appels d'offres pour Dupont")
            self.assertEqual(senden.call_args.args[4], "A · et 2 échéances proches")
            con = MagicMock()
            con.execute.return_value.fetchone.return_value = None
            mail.morgen_push(con, ("a", "b"), "u1", "f1", [("v1", "X", datetime(2026, 11, 2, 13, 0, tzinfo=timezone.utc), "Abgabe")], "fr", mail.PARIS)
            self.assertEqual(senden.call_args.args[3], "⏰ Aujourd'hui : échéance · remise des offres 14h00")

    def test_gleiche_schluessel(self):
        self.assertEqual(set(mail.T["fr"]) - {"dp"}, set(mail.T["de"]))
        self.assertEqual(set(mail.T["en"]), set(mail.T["de"]))


class Polnisch(unittest.TestCase):
    def test_mail_auf_polnisch(self):
        from datetime import datetime, timezone
        frist = datetime(2026, 11, 20, 13, 0, tzinfo=timezone.utc)  # 14:00 Warschau
        m = mail.nachricht("szef@example.test", "Sprzątanie Kowalski Sp. z o.o.", [("v1", "Sprzątanie urzędu", 8, frist)], [("v2", "Utrzymanie zieleni", frist)], [], "pl", mail.WARSCHAU)
        self.assertEqual(m["Subject"], "Nowe przetargi: 1 – Sprzątanie Kowalski Sp. z o.o.")
        text = m.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("oferty do 20.11.2026, godz. 14:00", text)
        self.assertNotIn("Ausschreibung", text)
        self.assertEqual(set(mail.T["pl"]), set(mail.T["de"]))

    def test_zeitzone_polen(self):
        from unittest.mock import MagicMock
        mail._firmen.clear()
        con = MagicMock()
        con.execute.return_value.fetchone.side_effect = [({"laender": ["POL"]},)]
        self.assertEqual(mail.firma_sprache(con, "pl"), ("pl", mail.WARSCHAU))
        mail._firmen.clear()


class Englisch(unittest.TestCase):
    def test_mail_auf_englisch_mit_ostkuestenzeit(self):
        from datetime import datetime, timezone
        frist = datetime(2026, 11, 20, 19, 0, tzinfo=timezone.utc)  # 2 PM Eastern
        m = mail.nachricht("boss@example.test", "Acme Cleaning LLC", [("v1", "Janitorial Services VA Clinic", 9, frist)], [("v2", "Grounds Maintenance", frist)],
                           [("d1", "General Liability.pdf", date(2026, 12, 1), 30)], "en", mail.NEW_YORK)
        self.assertEqual(m["Subject"], "1 new tender for Acme Cleaning LLC")
        text = m.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("Deadlines coming up", text)
        self.assertIn("due Nov 20, 2026, 02:00 PM ET", text)
        self.assertIn("valid until Dec 01, 2026 (in 30 days)", text)
        self.assertIn("Change the time or turn off emails", text)
        self.assertNotIn("Ausschreibung", text)
        self.assertIn("Open all matches in Jarvis", m.get_body(preferencelist=("html",)).get_content())

    def test_handy_auf_englisch(self):
        from unittest.mock import MagicMock, patch
        from datetime import datetime, timezone
        with patch.object(mail, "senden_an_geraete", return_value=1) as senden:
            mail.handy(MagicMock(), ("a", "b"), "u1", "f1", "Acme", [("v1", "Janitorial", 9, None)], [], sofort=True, sprache="en")
            self.assertEqual(senden.call_args.args[3], "⭐ Top match 9/10")
            mail.handy(MagicMock(), ("a", "b"), "u1", "f1", "Acme", [("v1", "A", 7, None), ("v2", "B", 6, None)], [("v3", "C", None)], sprache="en")
            self.assertEqual(senden.call_args.args[3], "2 new tenders for Acme")
            self.assertEqual(senden.call_args.args[4], "A · and 1 deadline soon")
            con = MagicMock()
            con.execute.return_value.fetchone.return_value = None
            mail.morgen_push(con, ("a", "b"), "u1", "f1", [("v1", "Janitorial", datetime(2026, 11, 2, 19, 0, tzinfo=timezone.utc), "Abgabe")], "en", mail.NEW_YORK)
            self.assertEqual(senden.call_args.args[3], "⏰ Today: deadline · Bid due 02:00 PM ET")

    def test_firmensprache_und_zeitzone(self):
        from unittest.mock import MagicMock
        mail._firmen.clear()
        con = MagicMock()
        con.execute.return_value.fetchone.side_effect = [({"laender": ["USA"]},), ({"laender": ["DEU"]},), None, ({"sprache": "en", "laender": ["IRL"]},)]
        self.assertEqual(mail.firma_sprache(con, "us"), ("en", mail.NEW_YORK))
        self.assertEqual(mail.firma_sprache(con, "de"), ("de", mail.BERLIN))
        self.assertEqual(mail.firma_sprache(con, "ohne"), ("de", mail.BERLIN))
        self.assertEqual(mail.firma_sprache(con, "ie"), ("en", mail.BERLIN))
        self.assertEqual(mail.firma_sprache(con, "us"), ("en", mail.NEW_YORK), "zwischengespeichert")
        mail._firmen.clear()
        con.execute.return_value.fetchone.side_effect = [({"laender": ["FRA"]},), ({"laender": ["FRA", "DEU"]},)]
        self.assertEqual(mail.firma_sprache(con, "fr"), ("fr", mail.PARIS))
        self.assertEqual(mail.firma_sprache(con, "fr-de"), ("de", mail.BERLIN))
        mail._firmen.clear()
