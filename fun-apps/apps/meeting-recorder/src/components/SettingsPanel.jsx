export default function SettingsPanel({ defaultStorageMode, onDefaultStorageModeChange, apiKey, onApiKeyChange, user, onSignOut }) {
  return (
    <div className="settings-panel">
      <h2>Settings</h2>

      <div className="settings-panel__row">
        <div>
          <div className="settings-panel__label">Signed in as</div>
          <div className="settings-panel__value">{user.email}</div>
        </div>
        <button className="btn btn--ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <div className="settings-panel__row settings-panel__row--column">
        <div className="settings-panel__label">Default recording storage</div>
        <div className="segmented">
          <button
            className={defaultStorageMode === "device" ? "segmented__btn is-active" : "segmented__btn"}
            onClick={() => onDefaultStorageModeChange("device")}
          >
            This device
          </button>
          <button
            className={defaultStorageMode === "cloud" ? "segmented__btn is-active" : "segmented__btn"}
            onClick={() => onDefaultStorageModeChange("cloud")}
          >
            Cloud
          </button>
        </div>
        <p className="hint">
          "This device" keeps the audio, transcript, and notes entirely in this browser's local storage — nothing
          is uploaded. "Cloud" backs everything up to your account so it's available on other devices.
        </p>
      </div>

      <div className="settings-panel__row settings-panel__row--column">
        <div className="settings-panel__label">Claude API key (optional, for smarter AI summaries)</div>
        <input
          className="input"
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
        />
        <p className="hint">
          Without a key, formatting uses a free built-in keyword/summary engine that runs entirely in your browser.
          Add your own Anthropic API key to get real AI-written summaries instead. The key is stored only in this
          browser's local storage and is sent directly to Anthropic, never to any server of ours.
        </p>
      </div>
    </div>
  );
}
