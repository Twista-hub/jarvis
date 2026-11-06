"""eForms lookup for the Kurz-Steckbrief (alarm.eforms_text) with stored samples, no network."""
import io
import sys
import unittest
import urllib.error
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import alarm.alarm as alarm_modul
from alarm.alarm import eforms_ids, eforms_tage, eforms_text

DATEN = Path(__file__).parent / "testdaten" / "eforms"
NOTICE = "7115ab0c-47ab-4401-91bc-76b316afaadd"
VERFAHREN = "5c545fc0-7a49-47c7-8a55-74de14e14ccf"
XML = (DATEN / f"{NOTICE}-01.xml").read_bytes()
ROH = __import__("json").loads((DATEN / "katalog-roh.json").read_text(encoding="utf-8"))


def export(*dateien: tuple[str, bytes]) -> bytes:
    puffer = io.BytesIO()
    with zipfile.ZipFile(puffer, "w") as z:
        for name, inhalt in dateien:
            z.writestr(name, inhalt)
    return puffer.getvalue()


class Quelle:
    """Answers like oeffentlichevergabe.de: the notice API knows only notice ids, the export holds the day's XML."""
    def __init__(self, tage: dict[str, bytes]):
        self.tage, self.urls = tage, []

    def __call__(self, url: str) -> bytes:
        self.urls.append(url)
        if f"/api/notices/{NOTICE}?" in url:
            return XML
        for tag, blob in self.tage.items():
            if f"pubDay={tag}&format=eforms.zip" in url:
                return blob
        raise urllib.error.HTTPError(url, 404, "Not Found", {}, None)


class EformsTest(unittest.TestCase):
    def setUp(self):
        alarm_modul._EFORMS_TAGE.clear()

    def test_release_id_is_the_notice_ocid_the_procedure(self):
        self.assertEqual(eforms_ids(ROH | {"id": NOTICE}), (NOTICE, VERFAHREN))
        self.assertEqual(eforms_ids({"ocid": "ohne-uuid"}), (None, None))
        self.assertEqual(eforms_ids({"id": "25999052", "ocid": "ocds-mnwr74-25999052"}), ("25999052", "25999052"), "vereinfachte Bekanntmachung mit Nummer")
        self.assertEqual(eforms_ids({"ocid": "ocds-mnwr74-123"}), (None, None), "zu kurze Nummer ist keine Kennung")

    def test_publication_day_in_german_time(self):
        # The catalog stores 2026-11-02T00:00+01:00 as UTC; the export day is the German date.
        self.assertEqual(eforms_tage(ROH)[0], "2026-11-02")
        self.assertEqual(eforms_tage({"date": "2026-11-02T00:00:00+01:00"}), ["2026-11-02"])

    def test_notice_api_with_release_id(self):
        quelle = Quelle({})
        text = eforms_text(ROH | {"id": NOTICE}, laden=quelle)
        self.assertEqual(len(quelle.urls), 1)
        self.assertIn(f"/api/notices/{NOTICE}?format=eforms", quelle.urls[0])
        self.assertIn("Drei Referenzen", text)

    def test_catalog_row_without_release_id_uses_daily_export(self):
        andere = XML.replace(VERFAHREN.encode(), b"11111111-2222-3333-4444-555555555555").replace(b"Drei Referenzen", b"Falsch")
        quelle = Quelle({"2026-11-02": export(("99999999-0000-0000-0000-000000000000-01.xml", andere),
                                              (f"{NOTICE}-01.xml", XML))})
        text = eforms_text(ROH, laden=quelle)
        self.assertTrue(any("pubDay=2026-11-02&format=eforms.zip" in u for u in quelle.urls))
        self.assertFalse(any(f"/api/notices/{VERFAHREN}" in u for u in quelle.urls))  # export found it first
        for fakt in ["Drei Referenzen", "Preis 60 %", "Konzept Barrierefreiheit 40 %", "TenderSubmissionDeadlinePeriod/EndDate: 2026-11-30+01:00",
                     f"ContractNotice/ContractFolderID: {VERFAHREN}"]:
            self.assertIn(fakt, text)
        self.assertNotIn("Falsch", text)
        self.assertNotIn("UBLExtension", text)

    def test_export_downloaded_once_per_day(self):
        quelle = Quelle({"2026-11-02": export((f"{NOTICE}-01.xml", XML))})
        eforms_text(ROH, laden=quelle)
        eforms_text(ROH, laden=quelle)
        self.assertEqual(sum("eforms.zip" in u for u in quelle.urls), 1)

    def test_nothing_found_returns_empty_text(self):
        quelle = Quelle({"2026-11-02": export(("andere-01.xml", b"<ContractNotice/>"))})
        self.assertEqual(eforms_text(ROH | {"ocid": "ocds-mnwr74-00000000-0000-0000-0000-000000000000"}, laden=quelle), "")
        self.assertEqual(eforms_text({"ocid": "ohne-uuid", "date": "2026-11-02"}, laden=quelle), "")


if __name__ == "__main__":
    unittest.main()
