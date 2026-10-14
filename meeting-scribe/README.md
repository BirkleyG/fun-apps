# Meeting Scribe

Local, free, offline meeting recorder. Records your **mic**, your **computer's audio output**, or both;
transcribes (and optionally translates) **live**, saves the audio, and when you hit Stop re-transcribes
the whole recording with a bigger Whisper model for a **much more accurate final transcript** you can copy in one click.

Nothing leaves your computer (after the one-time model download).

## Run it (Windows)

1. Install Python 3.12 from python.org (tick **Add to PATH**).
2. Double-click **`start.bat`**. First run installs dependencies; your browser opens at http://127.0.0.1:8765.
3. Press **Record**. The first run downloads the models (live: ~150 MB, accurate: ~1.5 GB for `large-v3-turbo`).

Use **Chrome or Edge**. For *Computer audio*, pick **Entire screen** and tick **Also share system audio**
(or share a tab with tab audio). Use headphones when recording mic + computer audio together.

With both sources on, they're transcribed separately and labelled **Me** (mic) / **Them** (computer audio).

## Speed / accuracy (no NVIDIA GPU)

Intel/AMD integrated GPUs don't speed Whisper up, so it runs on the CPU (int8). That's fine:

| Setting | Pick |
|---|---|
| Live model | `base` (fast). Try `small` if your CPU keeps up; `tiny` if the live text lags. |
| Accurate model | `large-v3-turbo` (best speed/accuracy). Use `small`/`medium` if it's too slow. |

The accurate pass runs *after* the meeting, in the background; expect roughly real-time to 2-3x
the meeting length on a typical laptop CPU. With an NVIDIA GPU it's detected and used automatically.

## Translation

* **Into English:** built in (Whisper), nothing to install.
* **Into other languages:** double-click `add-translation.bat` once (offline Argos Translate; language
  packs download on first use, then work offline). Quality is decent, not perfect.

## Phone recordings

Phone browsers block microphone access on plain `http://` pages, so the phone workflow is **record with your
phone's voice recorder, then send the file over**. Two ways:

1. **Upload page:** `start.bat --lan`, open the link it prints on your phone (same Wi-Fi), pick the file.
   The link contains a secret token; it's only reachable on your network. Windows Firewall will ask once. Allow private networks.
2. **Synced folder:** `start.bat --watch "C:\Users\you\OneDrive\Recordings"`. Anything your phone drops into
   that folder (OneDrive, Google Drive, Dropbox, Syncthing...) is transcribed automatically. Your originals are copied, never modified.

Any common format works (m4a, mp3, wav, aac, ogg, opus, flac, mp4, amr...).

## Where things are stored

`data/sessions/<date-time>/` holds `mic.wav` / `system.wav` (16 kHz mono), `mix.mp3` (if `ffmpeg` is installed),
`transcript.json`, and the live segments. Recordings are written as they happen, so a crash or closed tab loses nothing; on the next start
interrupted recordings are recovered and you can run the accurate pass on them.

## Notes / limits

* Live text is a draft (a few seconds behind, chunked at pauses). The accurate pass replaces it.
* Whisper may mis-hear names/jargon; if auto-detect guesses the wrong language, set **Spoken language** explicitly.
* Speaker labels are just Me/Them by audio source (no per-person diarization).
