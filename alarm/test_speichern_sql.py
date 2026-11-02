"""SQL integration checks against an isolated, local CI Postgres only."""
import os
import sys
import unittest
from pathlib import Path
from urllib.parse import urlparse

import psycopg

sys.path.insert(0, str(Path(__file__).parent))
from alarm.speichern import foerder_speichern, speichern, unpassende_verwerfen

URL = os.environ.get("JARVIS_TEST_DATABASE_URL", "")
FIRMA = "11111111-1111-4111-8111-111111111111"
ANDERE = "22222222-2222-4222-8222-222222222222"


@unittest.skipUnless(URL, "nur mit isolierter Testdatenbank")
class SpeicherSqlTest(unittest.TestCase):
    def setUp(self):
        if urlparse(URL).hostname not in {"localhost", "127.0.0.1", "::1"}:
            self.fail("Testdatenbank muss lokal sein; kein Zugriff auf Kundendaten")
        self.con = psycopg.connect(URL)
        self.addCleanup(self.con.close)
        self.addCleanup(self.con.rollback)
        # CREATE without IF NOT EXISTS deliberately refuses an existing application table.
        self.con.execute("""create table public.vorgaenge (
            id uuid default gen_random_uuid(), firma_id uuid not null, quelle_id text not null,
            titel text, link text, frist timestamptz, punkte int, steckbrief text,
            bereich_id uuid, katalog_id text, katalog_version text, status text default 'neu',
            entfernung_km numeric(6,1), fragefrist timestamptz, us jsonb,
            unique(firma_id,quelle_id))""")

    def treffer(self, **werte):
        return {"quelle_id": "a", "titel": "Fliesenarbeiten", "link": "https://example.test",
                "steckbrief": "## Kurzüberblick\n\nBekanntmachung", "steckbrief_kurz": True, **werte}

    def test_upsert_preserves_detailed_brief_and_clears_stale_score(self):
        self.assertEqual(speichern(self.con, FIRMA, [self.treffer(punkte=9, steckbrief="## Analyse\n\nVorhandene Unterlagen", steckbrief_kurz=False)], {}), 1)
        self.assertEqual(speichern(self.con, FIRMA, [self.treffer()], {}), 0)
        punkte, brief = self.con.execute("select punkte,steckbrief from public.vorgaenge").fetchone()
        self.assertIsNone(punkte)
        self.assertIn("Vorhandene Unterlagen", brief)

    def test_us_felder_und_geaenderte_frist_als_amendment(self):
        us = {"notice_id": "n1", "set_aside": "SBA", "frist": "2026-11-20T14:00:00-05:00", "naics": "561720"}
        speichern(self.con, FIRMA, [self.treffer(us=us)], {})
        speichern(self.con, FIRMA, [self.treffer(us=us | {"frist": "2026-11-25T14:00:00-05:00"})], {})
        gespeichert = self.con.execute("select us from public.vorgaenge").fetchone()[0]
        self.assertEqual(gespeichert["frist"], "2026-11-25T14:00:00-05:00")
        self.assertEqual([(a["feld"], a["alt"], a["neu"]) for a in gespeichert["aenderungen"]], [("frist", "2026-11-20T14:00:00-05:00", "2026-11-25T14:00:00-05:00")])
        speichern(self.con, FIRMA, [self.treffer()], {})
        self.assertEqual(self.con.execute("select us->>'naics' from public.vorgaenge").fetchone()[0], "561720", "ohne neue US-Daten bleiben die alten")

    def test_sql_guard_preserves_a_brief_created_between_select_and_insert(self):
        con, treffer = self.con, self.treffer()

        class ZwischenzeitlicherUpload:
            def execute(self, sql, parameter):
                if sql.startswith("select steckbrief"):
                    con.execute("insert into public.vorgaenge(firma_id,quelle_id,steckbrief) values(%s,%s,%s)", (FIRMA, "a", "Ausführlich geprüft"))
                    return type("VorherLeer", (), {"fetchone": lambda _: None})()
                return con.execute(sql, parameter)

        self.assertEqual(speichern(ZwischenzeitlicherUpload(), FIRMA, [treffer], {}), 0)
        self.assertEqual(self.con.execute("select steckbrief from public.vorgaenge").fetchone()[0], "Ausführlich geprüft")

    def test_archiving_preserves_other_firms_and_started_work(self):
        for firma, key, status in [(FIRMA, "a", "neu"), (FIRMA, "b", "pruefen"), (FIRMA, "c", "angebot"), (ANDERE, "a", "neu")]:
            self.con.execute("insert into public.vorgaenge(firma_id,quelle_id,status) values(%s,%s,%s)", (firma, key, status))
        self.assertEqual(unpassende_verwerfen(self.con, FIRMA, ["a", "b", "c"]), 1)
        rows = self.con.execute("select firma_id::text,quelle_id,status from public.vorgaenge order by firma_id,quelle_id").fetchall()
        self.assertEqual(rows, [(FIRMA, "a", "verworfen"), (FIRMA, "b", "pruefen"), (FIRMA, "c", "angebot"), (ANDERE, "a", "neu")])

    def test_funding_scores_keep_the_firms_mark_and_skip_foreign_links(self):
        self.con.execute("""create table public.foerderprogramme (id text primary key, titel text, link text, veroeffentlicht date)""")
        self.con.execute("""create table public.foerder_bewertungen (firma_id uuid, programm_id text, punkte int, grund text,
            bewertet timestamptz default now(), stand text default 'neu', primary key(firma_id, programm_id))""")
        link = "https://www.foerderdatenbank.de/FDB/Content/DE/Foerderprogramm/digital-jetzt.html"
        foerder = {"programme": [{"id": link, "titel": "Digital Jetzt", "link": link, "tag": "2026-10-31"},
                                 {"id": "https://example.org/x", "titel": "Fremd", "link": "https://example.org/x", "tag": None}],
                   "bewertungen": {"Firma": [{"id": link, "punkte": 8, "grund": "Passt"}, {"id": "https://example.org/x", "punkte": 9, "grund": "x"}]}}
        self.assertEqual(foerder_speichern(self.con, FIRMA, foerder, "Firma"), 1)
        self.con.execute("update public.foerder_bewertungen set stand='gemerkt'")
        foerder["bewertungen"]["Firma"][0].update(punkte=12, grund="Neu bewertet")
        self.assertEqual(foerder_speichern(self.con, FIRMA, foerder, "Firma"), 1)
        self.assertEqual(self.con.execute("select punkte, grund, stand from public.foerder_bewertungen").fetchone(), (10, "Neu bewertet", "gemerkt"))
        self.assertEqual(foerder_speichern(self.con, ANDERE, foerder, "Andere"), 0)
        self.assertEqual(self.con.execute("select count(*) from public.foerderprogramme").fetchone()[0], 1)
