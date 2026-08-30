function formatDate(recording) {
  const seconds = recording.createdAt?.seconds ?? (typeof recording.createdAt === "number" ? recording.createdAt / 1000 : null);
  if (!seconds) return "Just now";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDuration(sec) {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RecordingsList({ recordings, selectedId, onSelect }) {
  if (recordings.length === 0) {
    return <p className="hint">No recordings yet. Hit Record to capture your first meeting.</p>;
  }

  return (
    <div className="recordings-list">
      {recordings.map((recording) => (
        <button
          key={recording.id}
          className={recording.id === selectedId ? "recording-item is-active" : "recording-item"}
          onClick={() => onSelect(recording)}
        >
          <div className="recording-item__title">{recording.title || "Untitled meeting"}</div>
          <div className="recording-item__meta">
            <span>{formatDate(recording)}</span>
            <span>{formatDuration(recording.durationSec)}</span>
            <span className={`badge badge--${recording.storageMode}`}>
              {recording.storageMode === "device" ? "On device" : "Cloud"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
