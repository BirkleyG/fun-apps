"""Meeting Scribe: local recorder + live transcription/translation + accurate final pass."""
import argparse
import asyncio
import hashlib
import http.cookies
import json
import secrets
import shutil
import socket
import subprocess
import threading
import time
import wave
import webbrowser
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse

from . import engine, store, translate

SR = 16000
SILENCE_RMS = 0.005       # below this = silence
MIN_CHUNK_S = 2.0         # flush on a pause once we have this much audio
MAX_CHUNK_S = 12.0        # ...or force a flush at this length
AUDIO_EXT = {".mp3", ".m4a", ".wav", ".aac", ".ogg", ".opus", ".flac", ".mp4", ".webm", ".amr", ".3gp", ".wma", ".mkv"}
STATIC = Path(__file__).resolve().parent.parent / "static"
LANGS = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German", "it": "Italian",
    "pt": "Portuguese", "nl": "Dutch", "ru": "Russian", "uk": "Ukrainian", "pl": "Polish",
    "tr": "Turkish", "ar": "Arabic", "he": "Hebrew", "hi": "Hindi", "zh": "Chinese",
    "ja": "Japanese", "ko": "Korean", "vi": "Vietnamese", "id": "Indonesian", "sv": "Swedish",
}

app = FastAPI(title="Meeting Scribe")
executor = ThreadPoolExecutor(max_workers=1)  # one accurate pass at a time


# --------------------------------------------------------------------------- security
class Gate:
    """Pure-ASGI middleware: blocks cross-site requests and (in --lan mode) requires a token."""

    def __init__(self, app, token=None):
        self.app, self.token = app, token

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        headers = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
        origin = headers.get("origin")
        if origin and urlparse(origin).netloc != headers.get("host", ""):
            return await self._deny(scope, send, 403)
        set_cookie = False
        client = (scope.get("client") or ("", 0))[0]
        if self.token and client not in ("127.0.0.1", "::1"):
            qs = parse_qs(scope.get("query_string", b"").decode())
            cookie = http.cookies.SimpleCookie(headers.get("cookie", ""))
            got = (cookie["ms_token"].value if "ms_token" in cookie else "")
            q = (qs.get("t") or [""])[0]
            if secrets.compare_digest(got, self.token):
                pass
            elif secrets.compare_digest(q, self.token):
                set_cookie = True
            else:
                return await self._deny(scope, send, 401)
        if set_cookie and scope["type"] == "http":
            async def send2(msg):
                if msg["type"] == "http.response.start":
                    msg["headers"] = list(msg.get("headers", [])) + [
                        (b"set-cookie", f"ms_token={self.token}; Path=/; HttpOnly; SameSite=Strict".encode())]
                await send(msg)
            return await self.app(scope, receive, send2)
        await self.app(scope, receive, send)

    async def _deny(self, scope, send, code):
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 4000 + code})
        else:
            await send({"type": "http.response.start", "status": code,
                        "headers": [(b"content-type", b"text/plain")]})
            await send({"type": "http.response.body", "body": b"Forbidden"})


# --------------------------------------------------------------------------- helpers
def _session(sid):
    try:
        return store.load(sid)
    except KeyError:
        raise HTTPException(404, "No such session")


def pcm_to_wav(pcm: Path, wav: Path):
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        with open(pcm, "rb") as f:
            while True:
                b = f.read(1 << 20)
                if not b:
                    break
                w.writeframes(b)
    pcm.unlink()


def seal_audio(sid):
    """Turn any raw .pcm recordings into .wav files and record the duration."""
    meta = store.load(sid)
    sdir = store.session_dir(sid)
    dur = 0.0
    for name, fname in meta["tracks"].items():
        pcm = sdir / (Path(fname).stem + ".pcm")
        if pcm.exists():
            pcm_to_wav(pcm, sdir / fname)
        wav = sdir / fname
        if wav.exists() and wav.suffix == ".wav":
            with wave.open(str(wav), "rb") as w:
                dur = max(dur, w.getnframes() / w.getframerate())
    store.update(sid, duration=round(dur, 1))


def make_mix(sid):
    """Optional: compressed mp3 for easy playback (needs ffmpeg on PATH)."""
    if not shutil.which("ffmpeg"):
        return
    meta = store.load(sid)
    sdir = store.session_dir(sid)
    files = [sdir / f for f in meta["tracks"].values() if (sdir / f).exists()]
    if not files or meta.get("kind") != "live":
        return
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for f in files:
        cmd += ["-i", str(f)]
    if len(files) > 1:
        cmd += ["-filter_complex", f"amix=inputs={len(files)}:duration=longest:normalize=0"]
    cmd += ["-codec:a", "libmp3lame", "-q:a", "4", str(sdir / "mix.mp3")]
    try:
        subprocess.run(cmd, check=True, timeout=1800)
    except Exception:
        pass


# --------------------------------------------------------------------------- accurate pass
def run_final(sid):
    try:
        meta = store.update(sid, status="transcribing", progress=0.0, error=None, stage="Loading model…")
        sdir = store.session_dir(sid)
        model, language, target = meta["final_model"], meta["language"], meta["target"]
        tracks = [(n, sdir / f) for n, f in meta["tracks"].items() if (sdir / f).exists()]
        if not tracks:
            raise RuntimeError("No audio found for this session")
        engine.get_model(model)
        orig, trans, langs = [], [], []
        last = [0.0]

        def progress(base, span, stage):
            def cb(p):
                now = time.time()
                if now - last[0] > 1.0:
                    last[0] = now
                    store.update(sid, progress=round(base + span * p, 3), stage=stage)
            return cb

        n = len(tracks)
        for i, (name, path) in enumerate(tracks):
            lo, share = i / n, 1 / n
            label = f"Transcribing{' ' + name if n > 1 else ''}…"
            whisper_translate = bool(target)
            segs, lang, dur = engine.transcribe_file(
                path, model, language,
                on_progress=progress(lo, share * (0.6 if whisper_translate else 1.0), label))
            langs.append(lang)
            store.update(sid, duration=max(meta.get("duration", 0), round(dur, 1)))
            orig += [dict(s, track=name, lang=lang) for s in segs]
            if target and lang != target:
                if target == "en":
                    tsegs, _, _ = engine.transcribe_file(
                        path, model, lang, task="translate",
                        on_progress=progress(lo + share * 0.6, share * 0.4, "Translating…"))
                    trans += [dict(s, track=name) for s in tsegs]
                else:
                    store.update(sid, stage="Translating…")
                    translate.ensure(lang, target)
                    for s in segs:
                        trans.append({"track": name, "start": s["start"], "end": s["end"],
                                      "text": translate.translate(s["text"], lang, target)})
        store.write_transcript(sid, {
            "model": model, "language": langs[0] if langs else language,
            "original": orig, "translation": trans or None,
        })
        make_mix(sid)
        store.update(sid, status="done", progress=1.0, stage="")
    except Exception as e:  # noqa: BLE001
        store.update(sid, status="error", error=str(e), stage="")


def queue_final(sid):
    store.update(sid, status="queued", progress=0.0, stage="Waiting…")
    executor.submit(run_final, sid)


# --------------------------------------------------------------------------- live transcription
SKIP = object()


class LiveTrack:
    def __init__(self, ws, meta, track):
        self.ws, self.meta, self.track = ws, meta, track
        sdir = store.session_dir(meta["id"])
        self.pcm = open(sdir / f"{track}.pcm", "ab")
        self.buf = np.zeros(0, dtype=np.int16)
        self.buf_start = 0
        self.ending = False
        self.prompt = ""
        self.warned = False

    def feed(self, data: bytes):
        data = data[: len(data) // 2 * 2]
        self.pcm.write(data)
        self.buf = np.concatenate([self.buf, np.frombuffer(data, dtype=np.int16)])

    def take(self):
        n = len(self.buf)
        if n == 0:
            return None
        tail = self.buf[-int(0.8 * SR):].astype(np.float32) / 32768
        silent_tail = float(np.sqrt(np.mean(tail ** 2))) < SILENCE_RMS
        dur = n / SR
        if not (self.ending or dur >= MAX_CHUNK_S or (dur >= MIN_CHUNK_S and silent_tail)):
            return None
        chunk, start = self.buf, self.buf_start
        self.buf, self.buf_start = self.buf[:0], self.buf_start + n
        f32 = chunk.astype(np.float32) / 32768
        if n < 0.4 * SR or float(np.sqrt(np.mean(f32 ** 2))) < SILENCE_RMS * 0.6:
            return SKIP
        return start / SR, f32

    async def send(self, obj):
        try:
            await self.ws.send_json(obj)
        except Exception:
            pass

    async def process(self, start, audio):
        m = self.meta
        text, lang = await asyncio.to_thread(engine.live_chunk, m["live_model"], audio, m["language"], self.prompt)
        if not text:
            return
        item = {"type": "seg", "track": self.track, "start": round(start, 2),
                "end": round(start + len(audio) / SR, 2), "text": text, "lang": lang}
        target = m["target"]
        if target and lang and lang != target:
            try:
                if target == "en":
                    item["translation"], _ = await asyncio.to_thread(
                        engine.live_chunk, m["live_model"], audio, lang, "", "translate")
                else:
                    await asyncio.to_thread(translate.ensure, lang, target)
                    item["translation"] = await asyncio.to_thread(translate.translate, text, lang, target)
            except Exception as e:  # noqa: BLE001
                if not self.warned:
                    self.warned = True
                    await self.send({"type": "warn", "msg": f"Translation unavailable: {e}"})
        store.append_live(m["id"], {k: v for k, v in item.items() if k != "type"})
        await self.send(item)
        self.prompt = (self.prompt + " " + text)[-224:]

    async def worker(self):
        await self.send({"type": "status", "msg": "Loading speech model (first run downloads it)…"})
        try:
            await asyncio.to_thread(engine.get_model, self.meta["live_model"])
        except Exception as e:  # noqa: BLE001
            await self.send({"type": "warn", "msg": f"Could not load live model: {e}. Audio is still being saved."})
            while not self.ending:
                await asyncio.sleep(0.5)
            return
        await self.send({"type": "status", "msg": "Listening"})
        while True:
            await asyncio.sleep(0.4)
            while True:
                r = self.take()
                if r is None:
                    break
                if r is SKIP:
                    continue
                try:
                    await self.process(*r)
                except Exception as e:  # noqa: BLE001
                    await self.send({"type": "warn", "msg": f"Live transcription error: {e}"})
            if self.ending and len(self.buf) == 0:
                return


@app.websocket("/ws/live")
async def ws_live(ws: WebSocket, session: str, track: str):
    await ws.accept()
    try:
        meta = store.load(session)
    except KeyError:
        return await ws.close(code=4404)
    if track not in meta["tracks"]:
        return await ws.close(code=4400)
    lt = LiveTrack(ws, meta, track)
    task = asyncio.create_task(lt.worker())
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes"):
                lt.feed(msg["bytes"])
            elif msg.get("text") == "end":
                break
    except Exception:
        pass
    lt.ending = True
    try:
        await asyncio.wait_for(task, timeout=600)
    except Exception:
        task.cancel()
    lt.pcm.close()
    await lt.send({"type": "done"})
    try:
        await ws.close()
    except Exception:
        pass


# --------------------------------------------------------------------------- HTTP API
@app.get("/")
def index():
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-store"})


@app.get("/api/config")
def config():
    dev, _ = engine.device_info()
    return {
        "live_models": engine.LIVE_MODELS, "final_models": engine.FINAL_MODELS,
        "languages": LANGS, "translation_available": translate.available(),
        "ffmpeg": bool(shutil.which("ffmpeg")), "device": dev,
        "lan_url": getattr(app.state, "lan_url", None),
    }


@app.post("/api/sessions")
async def create_session(request: Request):
    b = await request.json()
    sources = [s for s in b.get("sources", []) if s in ("mic", "system")]
    if not sources:
        raise HTTPException(400, "Pick at least one audio source")
    meta = store.create(
        {s: f"{s}.wav" for s in sources},
        language=b.get("language") or "auto", target=b.get("target") or "",
        live_model=b.get("live_model") or "base", final_model=b.get("final_model") or "large-v3-turbo",
        auto_final=bool(b.get("auto_final", True)),
    )
    return meta


@app.post("/api/sessions/{sid}/finalize")
def finalize(sid: str):
    meta = _session(sid)
    seal_audio(sid)
    if meta["auto_final"]:
        queue_final(sid)
    else:
        store.update(sid, status="recorded")
    return store.load(sid)


@app.post("/api/sessions/{sid}/rerun")
async def rerun(sid: str, request: Request):
    _session(sid)
    b = await request.json() if (await request.body()) else {}
    seal_audio(sid)
    fields = {k: b[k] for k in ("final_model", "language", "target") if k in b}
    if fields:
        store.update(sid, **fields)
    queue_final(sid)
    return store.load(sid)


@app.get("/api/sessions")
def sessions():
    return store.list_all()


@app.get("/api/sessions/{sid}")
def session_detail(sid: str):
    meta = _session(sid)
    sdir = store.session_dir(sid)
    meta["audio"] = sorted(p.name for p in sdir.iterdir() if p.suffix in AUDIO_EXT)
    meta["has_translation"] = bool(store.get_segments(sid, "translation"))
    return meta


@app.get("/api/sessions/{sid}/segments")
def segments(sid: str, which: str = "original"):
    _session(sid)
    return store.get_segments(sid, which)


@app.get("/api/sessions/{sid}/transcript")
def transcript(sid: str, which: str = "original", timestamps: int = 0, speakers: int = 1):
    meta = _session(sid)
    text = store.format_text(store.get_segments(sid, which), bool(timestamps), bool(speakers))
    return PlainTextResponse(text, headers={
        "Content-Disposition": f'inline; filename="{meta["title"]} ({which}).txt"'.encode("ascii", "ignore").decode()})


@app.get("/api/sessions/{sid}/audio/{name}")
def audio(sid: str, name: str):
    _session(sid)
    p = store.session_dir(sid) / Path(name).name
    if not p.exists() or p.suffix not in AUDIO_EXT:
        raise HTTPException(404)
    return FileResponse(p)


@app.delete("/api/sessions/{sid}")
def delete(sid: str):
    _session(sid)
    store.delete(sid)
    return {"ok": True}


@app.post("/api/upload")
async def upload(request: Request, name: str = "audio.m4a", language: str = "auto",
                 target: str = "", final_model: str = "large-v3-turbo"):
    """Raw-body upload of an existing recording (e.g. from your phone)."""
    return await _ingest_stream(request.stream(), name, language, target, final_model)


async def _ingest_stream(stream, name, language, target, final_model):
    ext = Path(name).suffix.lower()
    if ext not in AUDIO_EXT:
        raise HTTPException(400, f"Unsupported file type {ext or '(none)'}")
    title = Path(name).stem[:80]
    meta = store.create({"audio": f"audio{ext}"}, kind="upload", title=title, language=language or "auto",
                        target=target or "", final_model=final_model or "large-v3-turbo", status="uploading")
    dest = store.session_dir(meta["id"]) / f"audio{ext}"
    with open(dest, "wb") as f:
        async for chunk in stream:
            f.write(chunk)
    queue_final(meta["id"])
    return store.load(meta["id"])


# --------------------------------------------------------------------------- watch folder (phone sync)
def watch_folder(folder: Path, final_model, language, target):
    """Auto-transcribe new audio files that appear in a folder (OneDrive / Google Drive / Syncthing...)."""
    seen_file = store.DATA / "watch_seen.json"
    seen = set(json.loads(seen_file.read_text())) if seen_file.exists() else set()
    sizes = {}
    while True:
        try:
            for p in folder.iterdir():
                if p.suffix.lower() not in AUDIO_EXT or not p.is_file():
                    continue
                st = p.stat()
                key = hashlib.sha1(f"{p.name}|{st.st_size}|{int(st.st_mtime)}".encode()).hexdigest()
                if key in seen:
                    continue
                if sizes.get(key) != st.st_size:      # still being written/synced
                    sizes[key] = st.st_size
                    continue
                meta = store.create({"audio": f"audio{p.suffix.lower()}"}, kind="upload", title=p.stem[:80],
                                    language=language, target=target, final_model=final_model, status="uploading")
                shutil.copy2(p, store.session_dir(meta["id"]) / f"audio{p.suffix.lower()}")
                queue_final(meta["id"])
                seen.add(key)
                seen_file.write_text(json.dumps(sorted(seen)))
        except Exception:
            pass
        time.sleep(5)


def recover_interrupted():
    for m in store.list_all():
        if m["status"] in ("recording", "uploading"):
            try:
                seal_audio(m["id"])
                store.update(m["id"], status="recorded", stage="Recovered after an interruption")
            except Exception:
                store.update(m["id"], status="error", error="Recording was interrupted")
        elif m["status"] in ("queued", "transcribing"):
            store.update(m["id"], status="recorded", stage="Interrupted — run the accurate pass again")


# --------------------------------------------------------------------------- entrypoint
def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--lan", action="store_true", help="Also listen on your Wi-Fi so your phone can upload (token protected)")
    ap.add_argument("--watch", type=Path, help="Folder to auto-transcribe new audio from (e.g. a synced phone-recordings folder)")
    ap.add_argument("--watch-model", default="large-v3-turbo")
    ap.add_argument("--watch-language", default="auto")
    ap.add_argument("--watch-target", default="")
    ap.add_argument("--open", action="store_true", help="Open the browser")
    args = ap.parse_args()

    store.init()
    recover_interrupted()
    token = secrets.token_urlsafe(16) if args.lan else None
    app.add_middleware(Gate, token=token)
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    url = f"http://127.0.0.1:{args.port}"
    if args.lan:
        app.state.lan_url = f"http://{lan_ip()}:{args.port}/?t={token}"
        print(f"\n  On your phone (same Wi-Fi), open:\n  {app.state.lan_url}\n")
    if args.watch:
        args.watch.mkdir(parents=True, exist_ok=True)
        threading.Thread(target=watch_folder, daemon=True,
                         args=(args.watch, args.watch_model, args.watch_language, args.watch_target)).start()
        print(f"  Watching {args.watch} for new recordings")
    print(f"  Meeting Scribe running at {url}  (Ctrl+C to quit)")
    if args.open:
        threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
