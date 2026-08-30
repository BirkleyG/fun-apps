import { useEffect, useState } from "react";
import { aiFormat, heuristicFormat } from "../lib/formatter";
import { deleteRecording, getAudioUrl, updateFormatted } from "../lib/store";

export default function RecordingDetail({ recording, templates, uid, apiKey, onChanged, onDeleted }) {
  const [audioUrl, setAudioUrl] = useState("");
  const [transcript, setTranscript] = useState(recording.transcript || "");
  const [templateId, setTemplateId] = useState(recording.templateId || templates[0]?.id || "");
  const [formatted, setFormatted] = useState(recording.formatted || null);
  const [formatting, setFormatting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    getAudioUrl(recording).then((url) => {
      if (cancelled) return;
      setAudioUrl(url);
      if (recording.storageMode === "device") objectUrl = url;
    });
    setTranscript(recording.transcript || "");
    setTemplateId(recording.templateId || templates[0]?.id || "");
    setFormatted(recording.formatted || null);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording.id]);

  const runFormat = async () => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    setFormatting(true);
    setError("");
    try {
      const sections = apiKey
        ? await aiFormat(transcript, template, apiKey).catch(async (err) => {
            setError(`AI formatting failed, used the free formatter instead. (${err.message})`);
            return heuristicFormat(transcript, template);
          })
        : heuristicFormat(transcript, template);
      setFormatted(sections);
      await updateFormatted(uid, recording, templateId, sections);
      onChanged?.();
    } finally {
      setFormatting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this recording? This can't be undone.")) return;
    await deleteRecording(uid, recording);
    onDeleted?.();
  };

  return (
    <div className="recording-detail">
      <div className="recording-detail__header">
        <h2>{recording.title || "Untitled meeting"}</h2>
        <button className="btn btn--danger-ghost" onClick={handleDelete}>
          Delete
        </button>
      </div>

      {audioUrl && <audio className="recording-detail__audio" src={audioUrl} controls />}

      <div className="recording-detail__transcript">
        <div className="recording-detail__label">Transcript</div>
        <textarea
          className="textarea"
          rows={6}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="No transcript captured. You can paste or type one here."
        />
      </div>

      <div className="recording-detail__format">
        <div className="recording-detail__label">Format into template</div>
        <div className="recording-detail__format-row">
          <select className="input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button className="btn btn--primary" onClick={runFormat} disabled={formatting || !transcript.trim()}>
            {formatting ? "Formatting..." : apiKey ? "Format with AI" : "Format (free)"}
          </button>
        </div>
        {error && <p className="hint hint--warn">{error}</p>}

        {formatted && (
          <div className="formatted-notes">
            {formatted.map((section) => (
              <div className="formatted-notes__section" key={section.id}>
                <h3>{section.title}</h3>
                <p>{section.text?.trim() || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
