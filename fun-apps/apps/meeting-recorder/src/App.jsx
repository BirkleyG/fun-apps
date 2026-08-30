import { useEffect, useMemo, useState } from "react";
import AuthGate from "./components/AuthGate";
import RecorderPanel from "./components/RecorderPanel";
import RecordingsList from "./components/RecordingsList";
import RecordingDetail from "./components/RecordingDetail";
import TemplatesEditor from "./components/TemplatesEditor";
import SettingsPanel from "./components/SettingsPanel";
import {
  deleteTemplate,
  ensureDefaultTemplates,
  listCloudRecordings,
  listLocalRecordings,
  saveRecording,
  saveTemplate,
  subscribeTemplates
} from "./lib/store";

const STORAGE_MODE_KEY = "meeting-recorder:default-storage-mode";
const API_KEY_KEY = "meeting-recorder:claude-api-key";

const TABS = [
  { id: "record", label: "Record" },
  { id: "recordings", label: "Recordings" },
  { id: "templates", label: "Templates" },
  { id: "settings", label: "Settings" }
];

function AppShell({ user, signOut }) {
  const [tab, setTab] = useState("record");
  const [defaultStorageMode, setDefaultStorageMode] = useState(
    () => localStorage.getItem(STORAGE_MODE_KEY) || "device"
  );
  const [sessionStorageMode, setSessionStorageMode] = useState(defaultStorageMode);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_KEY) || "");
  const [templates, setTemplates] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    ensureDefaultTemplates(user.uid);
    const unsub = subscribeTemplates(user.uid, setTemplates);
    return unsub;
  }, [user.uid]);

  const refreshRecordings = async () => {
    const [cloud, local] = await Promise.all([listCloudRecordings(user.uid), listLocalRecordings()]);
    const all = [...cloud, ...local].sort((a, b) => {
      const ta = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0;
      const tb = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0;
      return tb - ta;
    });
    setRecordings(all);
  };

  useEffect(() => {
    refreshRecordings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  const selectedRecording = useMemo(
    () => recordings.find((r) => r.id === selectedId) || null,
    [recordings, selectedId]
  );

  const handleDefaultStorageModeChange = (mode) => {
    setDefaultStorageMode(mode);
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  };

  const handleApiKeyChange = (value) => {
    setApiKey(value);
    localStorage.setItem(API_KEY_KEY, value);
  };

  const handleSaved = async ({ blob, mimeType, durationSec, transcript }) => {
    const title = `Meeting on ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    const saved = await saveRecording({
      uid: user.uid,
      storageMode: sessionStorageMode,
      blob,
      mimeType,
      transcript,
      durationSec,
      title
    });
    await refreshRecordings();
    setSelectedId(saved.id);
    setTab("recordings");
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__brand-icon">🎙️</span>
          <span>Meeting Notes AI</span>
        </div>
        <nav className="app__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "app__tab is-active" : "app__tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app__main">
        {tab === "record" && (
          <RecorderPanel
            storageMode={sessionStorageMode}
            onStorageModeChange={setSessionStorageMode}
            onSaved={handleSaved}
          />
        )}

        {tab === "recordings" && (
          <div className="split-view">
            <div className="split-view__list">
              <RecordingsList recordings={recordings} selectedId={selectedId} onSelect={(r) => setSelectedId(r.id)} />
            </div>
            <div className="split-view__detail">
              {selectedRecording ? (
                <RecordingDetail
                  key={selectedRecording.id}
                  recording={selectedRecording}
                  templates={templates}
                  uid={user.uid}
                  apiKey={apiKey}
                  onChanged={refreshRecordings}
                  onDeleted={() => {
                    setSelectedId(null);
                    refreshRecordings();
                  }}
                />
              ) : (
                <p className="hint">Select a recording to view its transcript and notes.</p>
              )}
            </div>
          </div>
        )}

        {tab === "templates" && (
          <TemplatesEditor
            templates={templates}
            onSave={(template) => saveTemplate(user.uid, template)}
            onDelete={(id) => deleteTemplate(user.uid, id)}
          />
        )}

        {tab === "settings" && (
          <SettingsPanel
            defaultStorageMode={defaultStorageMode}
            onDefaultStorageModeChange={(mode) => {
              handleDefaultStorageModeChange(mode);
              setSessionStorageMode(mode);
            }}
            apiKey={apiKey}
            onApiKeyChange={handleApiKeyChange}
            user={user}
            onSignOut={signOut}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return <AuthGate>{({ user, signOut }) => <AppShell user={user} signOut={signOut} />}</AuthGate>;
}
