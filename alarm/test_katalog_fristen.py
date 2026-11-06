import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import katalog_fristen as k  # noqa: E402

XML = """<ContractNotice><cbc:ID schemeName="notice-id">aaaa-1111</cbc:ID><cbc:ContractFolderID>proc-2222</cbc:ContractFolderID>
<cac:ProcurementProjectLot><cbc:ID schemeName="Lot">LOT-0001</cbc:ID><cac:TenderingProcess><cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2026-12-09+01:00</cbc:EndDate>
<cbc:EndTime>10:30:00+01:00</cbc:EndTime></cac:TenderSubmissionDeadlinePeriod><cac:AdditionalInformationRequestPeriod><cbc:EndDate>2026-12-01+01:00</cbc:EndDate></cac:AdditionalInformationRequestPeriod></cac:TenderingProcess></cac:ProcurementProjectLot>
<cac:ProcurementProjectLot><cbc:ID schemeName="Lot">LOT-0002</cbc:ID><cac:TenderingProcess><cac:TenderSubmissionDeadlinePeriod><cbc:EndDate>2026-12-12+01:00</cbc:EndDate></cac:TenderSubmissionDeadlinePeriod></cac:TenderingProcess></cac:ProcurementProjectLot></ContractNotice>"""


class KatalogFristenTest(unittest.TestCase):
    def test_fristen_aus_eforms(self):
        ids, f = k.eforms_fristen(XML)
        self.assertEqual(ids, ["aaaa-1111", "proc-2222"])
        from datetime import datetime
        utc = lambda s: datetime.fromisoformat(s).astimezone().utctimetuple()[:5]  # noqa: E731
        self.assertEqual(utc(f["lose"]["LOT-0001"]), (2026, 12, 9, 9, 30))
        self.assertEqual(utc(f["frist"]), (2026, 12, 12, 22, 59), "ohne Uhrzeit: Tagesende, späteste Losfrist")
        self.assertEqual(utc(f["fragefrist"]), (2026, 12, 1, 22, 59))

    def test_ohne_frist(self):
        self.assertIsNone(k.eforms_fristen('<ContractAwardNotice><cbc:ID schemeName="notice-id">x</cbc:ID></ContractAwardNotice>'))
        self.assertIsNone(k.zeit("kein Datum", None))


if __name__ == "__main__":
    unittest.main()
