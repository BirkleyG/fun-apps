import { useRef, useState } from "react";
import { createMeetingRecorder, isLiveTranscriptionSupported } from "../lib/recorder";

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecorderPanel({ storageMode, onStorageModeChange, onSaved }) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef(null);

  const start = async () => {
    setError("");
    try {
      const recorder = createMeetingRecorder({
        onTranscriptUpdate: setLiveTranscript,
        onTick: setElapsed
      });
      await recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setElapsed(0);
      setLiveTranscript("");
    } catch (err) {
      setError("Couldn't access the microphone. Check your browser/site permissions.");
    }
  };

  const stop = async () => {
    if (!recorderRef.current) return;
    setSaving(true);
    try {
      const result = await recorderRef.current.stop();
      recorderRef.current = null;
      setIsRecording(false);
      await onSaved(result);
      setLiveTranscript("");
      setElapsed(0);
    } catch (err) {
      setError("Something went wrong saving the recording.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="recorder-panel">
      <div className="recorder-panel__mode">
        <span>Save to:</span>
        <div className="segmented">
          <button
            className={storageMode === "device" ? "segmented__btn is-active" : "segmented__btn"}
            onClick={() => onStorageModeChange("device")}
            disabled={isRecording}
          >
            This device
          </button>
          <button
            className={storageMode === "cloud" ? "segmented__btn is-active" : "segmented__btn"}
            onClick={() => onStorageModeChange("cloud")}
            disabled={isRecording}
          >
            Cloud
          </button>
        </div>
      </div>

      <div className={isRecording ? "recorder-panel__dial is-recording" : "recorder-panel__dial"}>
        <button className="record-btn" onClick={isRecording ? stop : start} disabled={saving}>
          {saving ? "Saving..." : isRecording ? "Stop" : "Record"}
        </button>
        <div className="recorder-panel__clock">{formatClock(elapsed)}</div>
      </div>

      {!isLiveTranscriptionSupported() && (
        <p className="hint hint--warn">
          Live transcription isn't supported in this browser. The recording will still be saved, but you can only
          add a transcript manually afterward. Try Chrome or Edge for live captions.
        </p>
      )}

      {isRecording && (
        <div className="live-transcript">
          <div className="live-transcript__label">Live transcript</div>
          <div className="live-transcript__text">{liveTranscript || "Listening..."}</div>
        </div>
      )}

      {error && <p className="hint hint--error">{error}</p>}
    </div>
  );
}
