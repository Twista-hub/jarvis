"""Sets up Cloudflare Hyperdrive for the Jarvis database and prints its id (used by web.yml and katalog.yml).

Workers cannot verify the Supabase pooler certificate (own root "Supabase Root 2021 CA"), so they connect through
Hyperdrive, which checks the pooler against that CA with sslmode verify-full. Idempotent: reuses the uploaded CA and
updates the existing config. Needs CLOUDFLARE_API_TOKEN (Hyperdrive and mTLS certificates: edit),
CLOUDFLARE_ACCOUNT_ID and SUPABASE_DB_PASSWORD.
"""
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

REF = "juuuifrcxmitkqudqngq"
HOSTS = ("aws-1-eu-central-1.pooler.supabase.com", "aws-0-eu-central-1.pooler.supabase.com")
CA_NAME = "supabase-root-2021"
NAME = "jarvis-db"
ACCOUNT = os.environ["CLOUDFLARE_ACCOUNT_ID"]


def api(method, path, body=None):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}{path}", method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"authorization": f"Bearer {os.environ['CLOUDFLARE_API_TOKEN']}", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)["result"]
    except urllib.error.HTTPError as e:
        fehler = json.loads(e.read() or b"{}").get("errors", [])
        sys.exit(f"Cloudflare {method} {path}: HTTP {e.code} {[f.get('message') for f in fehler]}")


def root_ca(host):
    """The pooler sends its full chain; the last certificate must be the self-signed Supabase root."""
    out = subprocess.run(["openssl", "s_client", "-connect", f"{host}:5432", "-starttls", "postgres", "-showcerts"],
                         input="", capture_output=True, text=True, timeout=30).stdout
    pem = re.findall(r"-----BEGIN CERTIFICATE-----.+?-----END CERTIFICATE-----", out, re.S)[-1] + "\n"
    info = subprocess.run(["openssl", "x509", "-noout", "-subject", "-issuer"], input=pem, capture_output=True, text=True).stdout
    subject, issuer = (l.split("=", 1)[1].strip() for l in info.strip().splitlines())
    if "Supabase Root 2021 CA" not in subject or subject != issuer:
        sys.exit(f"Unerwartetes Wurzelzertifikat: {subject} / {issuer}")
    return pem


# Hyperdrive pools connections itself. Unlimited, it held all 15 slots of Supabase's session pooler, so GitHub jobs
# could no longer connect; the transaction pooler (6543) hangs behind Hyperdrive. Hence session pooler, capped at 5.


def main():
    pw = os.environ["SUPABASE_DB_PASSWORD"]
    host = HOSTS[0]
    ca = next((c for c in api("GET", "/mtls_certificates") or [] if c.get("name") == CA_NAME and c.get("ca")), None)
    if not ca:
        ca = api("POST", "/mtls_certificates", {"name": CA_NAME, "certificates": root_ca(host), "ca": True})
    body = {
        "name": NAME,
        "origin": {"host": host, "port": 5432, "database": "postgres", "user": f"postgres.{REF}", "password": pw, "scheme": "postgres"},
        "caching": {"disabled": True},
        "origin_connection_limit": 5,
        "mtls": {"ca_certificate_id": ca["id"], "sslmode": "verify-full"},
    }
    vorhanden = next((c for c in api("GET", "/hyperdrive/configs") or [] if c.get("name") == NAME), None)
    config = api("PUT", f"/hyperdrive/configs/{vorhanden['id']}", body) if vorhanden else api("POST", "/hyperdrive/configs", body)
    print(config["id"])


if __name__ == "__main__":
    main()
