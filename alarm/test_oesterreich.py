import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import oesterreich  # noqa: E402

KDQ = b"""<kdq xmlns="http://www.brz.gv.at/eproc/kdq/20180626"><header><publisher>X</publisher></header>
<item id="a" lastmod="2026-11-03T09:00:00"><url>https://x.at/kd/a</url></item>
<item id="b" lastmod="2026-11-02T23:00:00+01:00"><url>https://x.at/kd/b</url></item>
<item id="c" lastmod="2026-10-01T09:00:00"><url>https://x.at/kd/c</url></item></kdq>"""

EFORMS = """<?xml version="1.0" encoding="utf-8"?>
<ContractNotice xmlns="urn:oasis:names:specification:ubl:schema:xsd:ContractNotice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:efac="http://data.europa.eu/p27/eforms-ubl-extension-aggregate-components/1">
 <efac:Organizations><efac:Organization><efac:Company><cac:PartyName><cbc:Name>Stadt Graz</cbc:Name></cac:PartyName><cac:PostalAddress><cbc:CityName>Graz</cbc:CityName><cbc:PostalZone>8010</cbc:PostalZone></cac:PostalAddress></efac:Company></efac:Organization></efac:Organizations>
 <cac:TenderingProcess><cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2099-12-01+01:00</cbc:EndDate><cbc:EndTime>10:00:00+01:00</cbc:EndTime></cac:TenderSubmissionDeadlinePeriod></cac:TenderingProcess>
 <cac:ProcurementProject><cbc:Name>Unterhaltsreinigung Amtsgebäude</cbc:Name><cbc:Description>Reinigung von 3 Gebäuden</cbc:Description>
  <cac:MainCommodityClassification><cbc:ItemClassificationCode listName="cpv">90911200</cbc:ItemClassificationCode></cac:MainCommodityClassification>
  <cac:RealizedLocation><cac:Address><cbc:CityName>Graz</cbc:CityName><cbc:PostalZone>8020</cbc:PostalZone><cbc:CountrySubentityCode listName="nuts">AT221</cbc:CountrySubentityCode></cac:Address></cac:RealizedLocation></cac:ProcurementProject>
</ContractNotice>""".encode()

KD81 = """<KD_8_1_Z1 xmlns="http://www.brz.gv.at/eproc/kd/v1_7_4"><CONTRACTING_BODY><ADDRESS_CONTRACTING_BODY><OFFICIALNAME>Gemeinde Lech</OFFICIALNAME></ADDRESS_CONTRACTING_BODY></CONTRACTING_BODY>
<OBJECT_CONTRACT><TITLE><P>Winterdienst Gemeindestraßen</P></TITLE><CPV_MAIN><CPV_CODE CODE="90620000"/></CPV_MAIN><SHORT_DESCR><P>Schneeräumung</P></SHORT_DESCR>
<OBJECT_DESCR><NUTS CODE="AT341"/><MAIN_SITE><P>6764 Lech</P></MAIN_SITE></OBJECT_DESCR></OBJECT_CONTRACT><PROCEDURE><DATE_RECEIPT_TENDERS>2099-11-20</DATE_RECEIPT_TENDERS></PROCEDURE></KD_8_1_Z1>""".encode()

ZUSCHLAG = b"""<KD_8_2_Z1 xmlns="http://www.brz.gv.at/eproc/kd/v1_7_4"><OBJECT_CONTRACT><TITLE><P>Bestellung</P></TITLE></OBJECT_CONTRACT></KD_8_2_Z1>"""


class Oesterreich(unittest.TestCase):
    def test_quellen_aus_piveau_listen(self):
        daten = {"result": {"results": [
            {"title": {"de": "Metadatensatz zur Kerndaten-Sammlung von X"}, "distributions": [{"access_url": ["https://x.at/kdq.xml"]}]},
            {"title": {"de": "Metadatensatz zur Kerndaten-Sammlung von Y"}, "distributions": [{"access_url": "https://y.at/kdq.xml", "download_url": ["https://y.at/info.pdf"]}]},
            {"title": {"de": "GetStat – Vergabeanalysen"}, "distributions": [{"access_url": ["https://z.at/kdq.xml"]}]}]}}
        self.assertEqual(oesterreich.quellen(daten), ["https://x.at/kdq.xml", "https://y.at/kdq.xml"])

    def test_kdq_nur_geaenderte_eintraege(self):
        self.assertEqual(oesterreich.eintraege(KDQ, "2026-11-03"), ["https://x.at/kd/a", "https://x.at/kd/b"])
        self.assertEqual(oesterreich.eintraege(b"kaputt", "2026-11-03"), [])

    def test_eforms_bekanntmachung(self):
        a = oesterreich.lesen(EFORMS, "https://x.at/kd/a")
        self.assertEqual(a["titel"], "Unterhaltsreinigung Amtsgebäude")
        self.assertEqual(a["cpv"], ["90911200"])
        self.assertEqual((a["plz"], a["ort"], a["nuts"], a["auftraggeber"]), ("8020", "Graz", "AT221", "Stadt Graz"))
        self.assertTrue(a["frist"].startswith("2099-12-01T10:00"))
        r = oesterreich.als_release(a, "2026-11-03")
        self.assertEqual((r["_land"], r["tender"]["title"]), ("AUT", "Unterhaltsreinigung Amtsgebäude"))
        self.assertIn("8020 Graz", r["tender"]["items"][-1]["deliveryLocation"]["description"])

    def test_altes_format_und_zuschlag(self):
        a = oesterreich.lesen(KD81, "https://x.at/kd/b")
        self.assertEqual((a["titel"], a["cpv"], a["nuts"], a["plz"], a["frist"]), ("Winterdienst Gemeindestraßen", ["90620000"], "AT341", "6764", "2099-11-20"))
        self.assertIsNone(oesterreich.lesen(ZUSCHLAG, "https://x.at/kd/c"), "Zuschläge werden übersprungen")

    def test_robots_und_ki_signal(self):
        alt = oesterreich.holen
        try:
            oesterreich._robots.clear()
            oesterreich.holen = lambda url, *a, **k: b"User-agent: *\nContent-Signal: ai-train=no, search=yes, ai-input=no\nDisallow:\nCrawl-delay: 5\n"
            self.assertEqual(oesterreich.erlaubt("http://ogd.ankoe.at/api/v1/notices"), (False, 0.0), "ai-input=no → nicht verwenden")
            oesterreich._robots.clear()
            oesterreich.holen = lambda url, *a, **k: b"User-agent: *\nDisallow: /privat\nCrawl-delay: 3\n"
            self.assertEqual(oesterreich.erlaubt("https://y.at/kd/1"), (True, 3.0))
            self.assertFalse(oesterreich.erlaubt("https://y.at/privat/1")[0])
        finally:
            oesterreich.holen = alt
            oesterreich._robots.clear()


if __name__ == "__main__":
    unittest.main()
