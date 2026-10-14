"""Offline translation via Argos Translate (optional install).

Translation INTO English is done by Whisper itself (see engine.py); this module covers
every other target language.
"""
import threading

_lock = threading.Lock()
_ready = set()


def available():
    try:
        import argostranslate.translate  # noqa: F401
        return True
    except Exception:
        return False


def _has_direct(a, b):
    import argostranslate.translate as t
    langs = {l.code: l for l in t.get_installed_languages()}
    return a in langs and b in langs and langs[a].get_translation(langs[b]) is not None


def _install_direct(a, b):
    import argostranslate.package as p
    if _has_direct(a, b):
        return
    p.update_package_index()  # needs internet once; offline afterwards
    for pkg in p.get_available_packages():
        if pkg.from_code == a and pkg.to_code == b:
            p.install_from_path(pkg.download())
            return
    raise RuntimeError(f"No offline translation package for {a} -> {b}")


def ensure(src, tgt):
    """Make sure src->tgt works (pivoting through English). Raises on failure."""
    if not available():
        raise RuntimeError("Install translation support: pip install -r requirements-translate.txt")
    key = (src, tgt)
    with _lock:
        if key in _ready:
            return
        if src != "en":
            _install_direct(src, "en")
        if tgt != "en":
            _install_direct("en", tgt)
        _ready.add(key)


def translate(text, src, tgt):
    import argostranslate.translate as t
    return t.translate(text, src, tgt)
