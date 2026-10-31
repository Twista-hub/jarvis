import contextlib
import copy
import importlib.util
import io
import os
from pathlib import Path
import unittest
from unittest.mock import patch


class HyperdriveTest(unittest.TestCase):
    def test_pool_exhaustion_reuses_only_identical_existing_configuration(self):
        with patch.dict(os.environ, {"CLOUDFLARE_ACCOUNT_ID": "test", "SUPABASE_DB_PASSWORD": "test"}):
            spec = importlib.util.spec_from_file_location("hyperdrive", Path(__file__).with_name("hyperdrive.py"))
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            existing = {}

            def api(method, path, body=None):
                if path == "/mtls_certificates":
                    return [{"name": module.CA_NAME, "ca": True, "id": "ca"}]
                if path == "/hyperdrive/configs":
                    return [{"name": module.NAME, "id": "origin"}]
                if method == "PUT":
                    existing.update(copy.deepcopy(body))
                    existing.pop("password", None)
                    existing["origin"].pop("password", None)
                    existing["id"] = "origin"
                    raise RuntimeError("EMAXCONNSESSION")
                return existing

            with patch.object(module, "api", side_effect=api), contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()):
                module.main()
            self.assertEqual(out.getvalue().strip(), "origin")
            expected = copy.deepcopy(existing)
            expected["origin"]["password"] = "unused"
            self.assertTrue(module.unveraendert(existing, expected))
            for field, value in [("origin_connection_limit", 20), ("mtls", {}), ("caching", {"disabled": False})]:
                changed = {**existing, field: value}
                self.assertFalse(module.unveraendert(changed, expected))
            changed = {**existing, "origin": {**existing["origin"], "host": "other.test"}}
            self.assertFalse(module.unveraendert(changed, expected))


if __name__ == "__main__":
    unittest.main()
