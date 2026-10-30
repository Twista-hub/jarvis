"""Web Push without payload: a VAPID-signed empty push wakes the phone, which then fetches the text
(push_nachrichten) from the app with its own login. No payload means no message encryption is needed.
The VAPID key pair is created once and kept in the table app_schluessel (readable only by the owner)."""
import base64
import json
import time
import urllib.error
import urllib.parse
import urllib.request

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

KONTAKT = "mailto:kontakt@wpdigitalranger.com"


def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def schluessel(con) -> tuple[ec.EllipticCurvePrivateKey, str]:
    """The VAPID key pair; created on the first call."""
    row = con.execute("select wert from public.app_schluessel where name = 'vapid_private'").fetchone()
    if row:
        privat = serialization.load_pem_private_key(row[0].encode(), password=None)
    else:
        privat = ec.generate_private_key(ec.SECP256R1())
        pem = privat.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
        oeffentlich = b64(privat.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
        con.execute("insert into public.app_schluessel values ('vapid_private', %s), ('vapid_public', %s) on conflict do nothing", (pem, oeffentlich))
        privat = serialization.load_pem_private_key(
            con.execute("select wert from public.app_schluessel where name = 'vapid_private'").fetchone()[0].encode(), password=None)
    oeffentlich = b64(privat.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    return privat, oeffentlich


def jwt(privat: ec.EllipticCurvePrivateKey, endpoint: str) -> str:
    teile = urllib.parse.urlparse(endpoint)
    kopf = b64(json.dumps({"typ": "JWT", "alg": "ES256"}).encode())
    daten = b64(json.dumps({"aud": f"{teile.scheme}://{teile.netloc}", "exp": int(time.time()) + 12 * 3600, "sub": KONTAKT}).encode())
    r, s = decode_dss_signature(privat.sign(f"{kopf}.{daten}".encode(), ec.ECDSA(hashes.SHA256())))
    return f"{kopf}.{daten}.{b64(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))}"


def senden(privat: ec.EllipticCurvePrivateKey, oeffentlich: str, endpoint: str) -> int:
    """Sends one empty push; returns the HTTP status (404/410 = device gone, delete the subscription)."""
    req = urllib.request.Request(endpoint, data=b"", method="POST", headers={
        "Authorization": f"vapid t={jwt(privat, endpoint)}, k={oeffentlich}",
        "TTL": str(24 * 3600),
        "Urgency": "normal",
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
