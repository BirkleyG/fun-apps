"""Self-signed HTTPS certificate so phone browsers allow microphone access on your LAN."""
import datetime
import ipaddress
import socket
from pathlib import Path


def ensure_cert(folder: Path, ip: str):
    """Return (cert_path, key_path); regenerated when your LAN IP changes."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID

    folder.mkdir(parents=True, exist_ok=True)
    cert_p, key_p, ip_p = folder / "cert.pem", folder / "key.pem", folder / "cert.ip"
    if cert_p.exists() and key_p.exists() and ip_p.exists() and ip_p.read_text() == ip:
        return cert_p, key_p
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Meeting Scribe")])
    now = datetime.datetime.now(datetime.timezone.utc)
    sans = [x509.DNSName("localhost"), x509.DNSName(socket.gethostname()),
            x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]
    try:
        sans.append(x509.IPAddress(ipaddress.ip_address(ip)))
    except ValueError:
        pass
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
            .public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(now + datetime.timedelta(days=397))
            .add_extension(x509.SubjectAlternativeName(sans), critical=False)
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .sign(key, hashes.SHA256()))
    cert_p.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_p.write_bytes(key.private_bytes(serialization.Encoding.PEM,
                                        serialization.PrivateFormat.PKCS8,
                                        serialization.NoEncryption()))
    ip_p.write_text(ip)
    return cert_p, key_p
