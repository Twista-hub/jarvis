"""Regression tests with local fixtures only: no API calls or customer database."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent))
from alarm import alarm, speichern
import katalog
from alarm.profile_db import aus_db, muster


def profil():
    return aus_db("firma-a", "Fliesenbetrieb", "Fliesen und Naturstein", {
        "leistungen": [{"name": "Fliesenarbeiten", "woerter": ["fliesen", "mosaik", "bad"], "cpv": ["45431", "45410000"]}],
    })


def bekanntmachung(key, titel, text="", cpv=""):
    return {"ocid": key, "tender": {"title": titel, "description": text,
        "items": [{"classification": {"scheme": "CPV", "id": cpv}}]}}


class SuchqualitaetTest(unittest.TestCase):
    def test_word_boundaries_and_umlauts(self):
        import re
        m = muster(["fliesen", "büro", "IT"])
        for text in ["fliesenarbeiten", "bueropersonal", "it-support"]:
            self.assertRegex(text, m)
        self.assertIsNone(re.search(m, "sanitär, befliesen"))

    def test_bad_and_wrong_cpv_do_not_establish_trade_match(self):
        p = profil()
        self.assertFalse(alarm.ohne_ki_passend(p, bekanntmachung("1", "Entwässerung Bad Breisig")))
        self.assertFalse(alarm.ohne_ki_passend(p, bekanntmachung("2", "Innenputzarbeiten im Bad", cpv="45410000")))
        self.assertFalse(alarm.ohne_ki_passend(p, bekanntmachung("3", "Heizung und Sanitär", "Freibadsanierung")))
        self.assertTrue(alarm.ohne_ki_passend(p, bekanntmachung("4", "Fliesenarbeiten an Kita")))
        self.assertTrue(alarm.ohne_ki_passend(p, bekanntmachung("5", "Neubau Kita", "Wandfliesen und Fliesen verlegen", "45431000")))

    def test_budget_fallback_rejects_weak_candidates_and_records_scope(self):
        p = profil()
        rels = [bekanntmachung("gut", "Fliesenarbeiten"), bekanntmachung("schlecht", "Innenputzarbeiten Bad Breisig", cpv="45410000"), bekanntmachung("fremd", "Heizungsanlage")]
        with tempfile.TemporaryDirectory() as tmp, patch.object(alarm, "ROOT", Path(tmp)), \
             patch.object(alarm, "FIRMA", "firma-a"), patch("profile_db.laden", return_value={"a": p, "b": dict(p, firma_id="firma-b")}), \
             patch.object(katalog, "bestand", return_value=[("2026-10-31", r) for r in rels]), \
             patch.object(katalog, "bewertungen", return_value={}), patch("foerder.abschnitt", return_value=[]), \
             patch.dict("os.environ", {}, clear=True):
            alarm.run(["2026-10-31"])
            data = json.loads((Path(tmp) / "treffer.json").read_text())
        self.assertEqual([t["quelle_id"] for t in data["treffer"]], ["gut"])
        self.assertIsNone(data["treffer"][0]["punkte"], "no invented AI score")
        self.assertEqual(set(data["profile"]), {"a"})
        self.assertEqual(data["profile"]["a"]["abgelehnt"], ["fremd", "schlecht"])

    def test_rejection_update_cannot_touch_started_work_or_other_firms(self):
        con = MagicMock()
        con.execute.return_value.rowcount = 2
        self.assertEqual(speichern.unpassende_verwerfen(con, "firma-a", ["alt"]), 2)
        sql, params = con.execute.call_args.args
        self.assertIn("firma_id=%s and status='neu'", sql)
        self.assertEqual(params, ("firma-a", ["alt"]))
        con.reset_mock()
        self.assertEqual(speichern.unpassende_verwerfen(con, "firma-a", []), 0)
        con.execute.assert_not_called()

    def test_low_ai_scores_are_hidden_and_uncached_notices_are_batched(self):
        p = profil()
        rels = [bekanntmachung(str(i), "Fliesenarbeiten") for i in range(10)]
        ki = MagicMock()
        ki.kosten.return_value = 0.0
        ki.score.side_effect = lambda beschreibung, items: {i: {"punkte": 5, "kurz": "Falsches Los", "grund": "Nur beiläufig erwähnt"} for i in range(len(items))}
        with tempfile.TemporaryDirectory() as tmp, patch.object(alarm, "ROOT", Path(tmp)), \
             patch.object(alarm, "FIRMA", "firma-a"), patch("profile_db.laden", return_value={"a": p}), \
             patch.object(katalog, "bestand", return_value=[("2026-10-31", r) for r in rels]), \
             patch.object(katalog, "bewertungen", return_value={}), patch.object(katalog, "bewertung_speichern"), \
             patch("foerder.abschnitt", return_value=[]), patch.dict("os.environ", {"ANTHROPIC_API_KEY": "vorhanden"}), \
             patch.dict(sys.modules, {"ki": ki}):
            alarm.run(["2026-10-31"])
            data = json.loads((Path(tmp) / "treffer.json").read_text())
        self.assertEqual([len(c.args[1]) for c in ki.score.call_args_list], [8, 2])
        self.assertEqual(data["treffer"], [])
        self.assertEqual(len(data["profile"]["a"]["abgelehnt"]), 10)

    def test_search_location_is_not_a_strong_service_word(self):
        p = aus_db("a", "Fliesen", "Fliesen in Baesweiler", {"standorte": [{"name": "Baesweiler"}],
            "leistungen": [{"name": "Fliesen", "woerter": ["fliesen", "baesweiler"], "cpv": []}]})
        self.assertFalse(alarm.ohne_ki_passend(p, bekanntmachung("x", "Elektroarbeiten in Baesweiler")))

    def test_new_rating_replaces_old_reason_but_preserves_uploaded_analysis(self):
        alt = alarm.bewertungsabschnitt({"kurz": "Alt", "grund": "Veraltet"}) + "## Analyse aus Unterlagen\n\nWichtige Kundendaten."
        neu = alarm.bewertungsabschnitt({"kurz": "Fliesenarbeiten", "grund": "Genau passend"}) + "## Kurzüberblick\n\nBekanntmachung"
        text = speichern.brief_aktualisieren(alt, {"steckbrief": neu, "steckbrief_kurz": True})
        self.assertIn("Genau passend", text)
        self.assertIn("Wichtige Kundendaten", text)
        self.assertNotIn("Veraltet", text)
        self.assertNotIn("Bekanntmachung", text)
        unbewertet = speichern.brief_aktualisieren(alt, {"steckbrief": "## Kurzüberblick", "steckbrief_kurz": True})
        self.assertNotIn("Jarvis-Bewertung", unbewertet)
        self.assertIn("Wichtige Kundendaten", unbewertet)
        aus_bekanntmachung = speichern.brief_aktualisieren(alt, {"steckbrief": neu, "steckbrief_kurz": False})
        self.assertIn("Wichtige Kundendaten", aus_bekanntmachung)
        self.assertNotIn("Veraltet", aus_bekanntmachung)
        upgrade = speichern.brief_aktualisieren("## Kurzüberblick\n\nAlt", {"steckbrief": "## Ausführliche Analyse\n\nNeu", "steckbrief_kurz": False})
        self.assertIn("Ausführliche Analyse", upgrade)

    def test_concurrent_upload_brief_is_preserved_by_upsert(self):
        con = MagicMock()
        con.execute.return_value.fetchone.side_effect = [None, (False,)]
        speichern.speichern(con, "a", [{"quelle_id": "q", "titel": "Fliesen", "link": "https://example.test", "steckbrief": "## Kurzüberblick", "steckbrief_kurz": True}], {})
        sql, params = con.execute.call_args.args
        self.assertIn("vorgaenge.steckbrief is distinct from %s", sql)
        self.assertIsNone(params[-1], "ein zwischenzeitlich angelegter Brief darf nicht überschrieben werden")

    def test_saver_limits_cleanup_to_evaluated_profile_even_with_partial_catalog(self):
        p = profil()
        data = {"katalog_vollstaendig": False, "treffer": [], "profile": {"a": {"version": katalog.profil_version(p), "abgelehnt": ["schlecht"]}}}
        con = MagicMock()
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "treffer.json").write_text(json.dumps(data))
            with patch.object(speichern, "ROOT", Path(tmp)), patch.object(speichern, "laden", return_value={"a": p, "b": dict(p, firma_id="firma-b")}), \
                 patch.object(speichern, "verbinden") as verbinden, patch.object(speichern, "unpassende_verwerfen", return_value=1) as archiv, \
                 patch.object(speichern, "ausserhalb_gebiet_verwerfen", return_value=0), patch.object(speichern, "speichern", return_value=0):
                verbinden.return_value.__enter__.return_value = con
                speichern.main()
        archiv.assert_called_once_with(con, "firma-a", ["schlecht"])
        sql, params = con.execute.call_args.args
        self.assertIn("suchlauf_ergebnis", sql)
        self.assertEqual(params[1], "firma-a")
        self.assertEqual(json.loads(params[0]), {"treffer": 0, "neu": 0, "ungeprueft": 0, "archiviert": 1})

    def test_changed_profile_cannot_archive_from_obsolete_results(self):
        data = {"treffer": [], "profile": {"a": {"version": "veraltet", "abgelehnt": ["gut"]}}}
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "treffer.json").write_text(json.dumps(data))
            with patch.object(speichern, "ROOT", Path(tmp)), patch.object(speichern, "laden", return_value={"a": profil()}), \
                 patch.object(speichern, "verbinden"), patch.object(speichern, "unpassende_verwerfen") as archiv, \
                 patch.object(speichern, "speichern") as schreiben:
                speichern.main()
        archiv.assert_not_called()
        schreiben.assert_not_called()


if __name__ == "__main__":
    unittest.main()
