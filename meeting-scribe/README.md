# Meeting Scribe

Local, free, offline meeting recorder. Records your **mic**, your **computer's audio output**, or both;
transcribes (and optionally translates) **live**, saves the audio, and when you hit Stop re-transcribes
the whole recording with a bigger Whisper model for a **much more accurate final transcript** you can copy in one click.

Nothing leaves your computer (after the one-time model download).

## Install & run (Windows)

**Easiest:** on the Fun Apps home page, press **Install on this PC**, open the downloaded
`Install-Meeting-Scribe.bat`, and wait. It installs into `%LOCALAPPDATA%\MeetingScribe`, adds a
**Meeting Scribe** desktop shortcut, installs Python 3.12 via winget if you don't have a suitable one,
and starts the app. After that, the **Run Meeting Scribe** button on the home page (or the shortcut) starts it
and opens your browser. If it's already running it just opens the page.

**Manual:** unzip the folder anywhere and double-click **`start.bat`** (same Python check/install).
The first run downloads components and speech models (live: ~150 MB, accurate: ~1.5 GB for `large-v3-turbo`).

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

## Phone recordings (record on your phone, lands on your computer)

When Meeting Scribe is running, the app shows a **Record on your phone** card with a QR code.

1. Phone on the **same Wi-Fi** as the computer; scan the QR code.
2. Your phone warns the connection isn't private: that's the app's own self-signed certificate, and it's needed
   because phone browsers only allow the microphone on `https` pages. Tap **Advanced → Proceed** (Android)
   or **Show Details → visit this website** (iPhone).
3. Tap **Record**. On Stop the audio is sent straight to the computer and transcribed with the accurate model.

Notes:
* Recordings are written to the phone's own storage while recording, so a dropped connection or closed tab
  loses nothing. Anything not sent stays in the list with a **Send** button.
* Keep the screen on and the page open while recording (phones pause the mic in the background).
* The link includes a secret token and stays the same between runs; bookmark it. A phone can only reach the
  recorder page and the upload endpoint, nothing else. Windows Firewall asks once; allow **private** networks.
  Start with `--no-phone` to turn this off.
* Already have a recording (voice memo, etc.)? Use **Transcribe an existing recording** on the app page,
  or run with `--watch "C:\path\to\folder"` to auto-transcribe whatever syncs into a folder (OneDrive, Google Drive...).

## Where things are stored

`data/sessions/<date-time>/` holds `mic.wav` / `system.wav` (16 kHz mono), `mix.mp3` (if `ffmpeg` is installed),
`transcript.json`, and the live segments. Recordings are written as they happen, so a crash or closed tab loses nothing; on the next start
interrupted recordings are recovered and you can run the accurate pass on them.

## Notes / limits

* Live text is a draft (a few seconds behind, chunked at pauses). The accurate pass replaces it.
* Whisper may mis-hear names/jargon; if auto-detect guesses the wrong language, set **Spoken language** explicitly.
* Speaker labels are just Me/Them by audio source (no per-person diarization).
