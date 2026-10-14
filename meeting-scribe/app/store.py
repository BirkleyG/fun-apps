"""Session storage: one folder per recording under data/sessions/<id>/."""
import json
import os
import re
import shutil
import threading
import uuid
from datetime import datetime
from pathlib import Path

DATA = Path(os.environ.get("SCRIBE_DATA") or Path(__file__).resolve().parent.parent / "data")
SESSIONS = DATA / "sessions"
_lock = threading.RLock()
ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,64}$")
LABELS = {"mic": "Me", "system": "Them"}


def init():
    SESSIONS.mkdir(parents=True, exist_ok=True)


def session_dir(sid: str) -> Path:
    if not ID_RE.match(sid or ""):
        raise KeyError(sid)
    return SESSIONS / sid


def _meta_path(sid):
    return session_dir(sid) / "meta.json"


def _write_json(path: Path, obj):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)


def create(tracks, **opts) -> dict:
    now = datetime.now()
    sid = now.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:4]
    meta = {
        "id": sid,
        "title": opts.pop("title", None) or now.strftime("Meeting %Y-%m-%d %H:%M"),
        "created": now.isoformat(timespec="seconds"),
        "kind": "live",
        "status": "recording",
        "stage": "",
        "progress": 0.0,
        "duration": 0.0,
        "language": "auto",
        "target": "",
        "live_model": "base",
        "final_model": "large-v3-turbo",
        "auto_final": True,
        "tracks": tracks,  # {"mic": "mic.wav", ...}
        "error": None,
    }
    meta.update({k: v for k, v in opts.items() if v is not None})
    session_dir(sid).mkdir(parents=True, exist_ok=True)
    _write_json(_meta_path(sid), meta)
    return meta


def load(sid: str) -> dict:
    p = _meta_path(sid)
    if not p.exists():
        raise KeyError(sid)
    return json.loads(p.read_text(encoding="utf-8"))


def update(sid: str, **fields) -> dict:
    with _lock:
        meta = load(sid)
        meta.update(fields)
        _write_json(_meta_path(sid), meta)
        return meta


def list_all():
    out = []
    for d in SESSIONS.iterdir() if SESSIONS.exists() else []:
        try:
            out.append(load(d.name))
        except Exception:
            continue
    out.sort(key=lambda m: m["created"], reverse=True)
    return out


def delete(sid: str):
    shutil.rmtree(session_dir(sid), ignore_errors=True)


# ---- live segments (append-only, crash safe) -------------------------------

def append_live(sid, seg: dict):
    with _lock:
        with open(session_dir(sid) / "live.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(seg, ensure_ascii=False) + "\n")


def read_live(sid):
    p = session_dir(sid) / "live.jsonl"
    if not p.exists():
        return []
    with _lock:
        lines = p.read_text(encoding="utf-8").splitlines()
    out = []
    for ln in lines:
        try:
            out.append(json.loads(ln))
        except ValueError:
            pass
    return out


# ---- final transcript ------------------------------------------------------

def write_transcript(sid, obj):
    _write_json(session_dir(sid) / "transcript.json", obj)


def read_transcript(sid):
    p = session_dir(sid) / "transcript.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def get_segments(sid, which="original"):
    t = read_transcript(sid)
    if t:
        return t["original"] if which == "original" else (t.get("translation") or [])
    live = sorted(read_live(sid), key=lambda s: s["start"])
    if which == "original":
        return live
    return [dict(s, text=s["translation"]) for s in live if s.get("translation")]


# ---- text formatting -------------------------------------------------------

def fmt_time(t):
    t = int(t)
    h, m, s = t // 3600, t % 3600 // 60, t % 60
    return f"{h:d}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def format_text(segs, timestamps=False, speakers=True) -> str:
    segs = sorted(segs, key=lambda s: (s["start"], s["track"]))
    show = speakers and len({s["track"] for s in segs}) > 1
    lines = []
    if timestamps:
        for s in segs:
            who = f"{LABELS.get(s['track'], s['track'])}: " if show else ""
            lines.append(f"[{fmt_time(s['start'])}] {who}{s['text']}")
        return "\n".join(lines)
    para, last_track, last_end = [], None, 0.0
    for s in segs:
        new = para and (s["track"] != last_track or s["start"] - last_end > 2.5)
        if new:
            lines.append(_para(para, last_track, show))
            para = []
        para.append(s["text"])
        last_track, last_end = s["track"], s["end"]
    if para:
        lines.append(_para(para, last_track, show))
    return "\n\n".join(lines)


def _para(parts, track, show):
    who = f"{LABELS.get(track, track)}: " if show else ""
    return who + " ".join(parts)
