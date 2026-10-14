"""Whisper wrapper (faster-whisper). Runs fully offline once a model is downloaded."""
import os
import threading

_models = {}
_locks = {}
_guard = threading.Lock()

LIVE_MODELS = ["tiny", "base", "small"]
FINAL_MODELS = ["small", "medium", "large-v3-turbo", "large-v3"]


def device_info():
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


def get_model(name):
    from faster_whisper import WhisperModel
    with _guard:
        if name not in _models:
            device, ctype = device_info()
            try:
                _models[name] = WhisperModel(name, device=device, compute_type=ctype,
                                             cpu_threads=os.cpu_count() or 4)
            except Exception:
                if device == "cpu":
                    raise
                _models[name] = WhisperModel(name, device="cpu", compute_type="int8",
                                             cpu_threads=os.cpu_count() or 4)
            _locks[name] = threading.Lock()
        return _models[name], _locks[name]


def is_loaded(name):
    return name in _models


_JUNK = {"thank you", "thanks for watching", "you", "bye", "thank you for watching", ""}


def _junk(text):
    return text.lower().strip(" .!?,") in _JUNK


def live_chunk(model_name, audio_f32, language, prompt, task="transcribe"):
    """Transcribe one short chunk. Returns (text, detected_language)."""
    model, lock = get_model(model_name)
    with lock:
        segs, info = model.transcribe(
            audio_f32,
            language=None if language in (None, "", "auto") else language,
            task=task,
            beam_size=1,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300},
            condition_on_previous_text=False,
            initial_prompt=prompt or None,
        )
        parts = []
        for s in segs:
            if s.no_speech_prob > 0.6 and s.avg_logprob < -1.0:
                continue
            parts.append(s.text.strip())
    text = " ".join(p for p in parts if p).strip()
    return ("" if _junk(text) else text), info.language


def transcribe_file(path, model_name, language, task="transcribe", on_progress=None):
    """Accurate pass over a whole file. Returns (segments, language, duration)."""
    model, lock = get_model(model_name)
    with lock:
        gen, info = model.transcribe(
            str(path),
            language=None if language in (None, "", "auto") else language,
            task=task,
            beam_size=5,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
            condition_on_previous_text=False,
        )
        out = []
        dur = info.duration or 0.0
        for s in gen:
            text = s.text.strip()
            if text and not _junk(text):
                out.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": text})
            if on_progress and dur:
                on_progress(min(s.end / dur, 1.0))
    return out, info.language, dur
