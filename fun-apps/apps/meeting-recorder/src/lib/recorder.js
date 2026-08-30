function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

export const isLiveTranscriptionSupported = () => Boolean(SpeechRecognitionImpl);

export function createMeetingRecorder({ onTranscriptUpdate, onTick } = {}) {
  let stream = null;
  let mediaRecorder = null;
  let chunks = [];
  let mimeType = "";
  let recognition = null;
  let finalTranscript = "";
  let interimTranscript = "";
  let tickTimer = null;
  let startedAt = 0;
  let restartRequested = false;

  function emitTranscript() {
    onTranscriptUpdate?.((finalTranscript + " " + interimTranscript).trim());
  }

  function startRecognition() {
    if (!SpeechRecognitionImpl) return;
    recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + result[0].transcript.trim();
        } else {
          interim += result[0].transcript;
        }
      }
      interimTranscript = interim;
      emitTranscript();
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
    };

    recognition.onend = () => {
      if (restartRequested) {
        try {
          recognition.start();
        } catch {
          /* already running */
        }
      }
    };

    restartRequested = true;
    try {
      recognition.start();
    } catch {
      /* ignore */
    }
  }

  return {
    mimeType: () => mimeType,
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mimeType = pickMimeType();
      chunks = [];
      finalTranscript = "";
      interimTranscript = "";

      mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.start(250);

      startedAt = Date.now();
      tickTimer = setInterval(() => {
        onTick?.(Math.round((Date.now() - startedAt) / 1000));
      }, 1000);

      startRecognition();
    },
    pause() {
      if (mediaRecorder?.state === "recording") mediaRecorder.pause();
    },
    resume() {
      if (mediaRecorder?.state === "paused") mediaRecorder.resume();
    },
    async stop() {
      restartRequested = false;
      clearInterval(tickTimer);
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }
      const blob = await new Promise((resolve) => {
        if (!mediaRecorder) {
          resolve(new Blob([], { type: mimeType || "audio/webm" }));
          return;
        }
        mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || "audio/webm" }));
        if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
        else resolve(new Blob(chunks, { type: mimeType || "audio/webm" }));
      });
      stream?.getTracks().forEach((t) => t.stop());
      const durationSec = Math.round((Date.now() - startedAt) / 1000);
      return {
        blob,
        mimeType: mimeType || blob.type,
        durationSec,
        transcript: (finalTranscript + " " + interimTranscript).trim()
      };
    }
  };
}
