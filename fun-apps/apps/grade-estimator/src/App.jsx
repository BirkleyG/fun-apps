import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, provider } from "./firebase";

// ─── Storage helpers ──────────────────────────────────────────────────────────
const APP_DOC_ID = "grade-estimator";
const getAppDocRef = (uid) => doc(db, "users", uid, "apps", APP_DOC_ID);

async function loadStorage(uid) {
  const snapshot = await getDoc(getAppDocRef(uid));
  return snapshot.exists() ? snapshot.data() : null;
}
async function saveStorage(uid, val) {
  await setDoc(
    getAppDocRef(uid),
    {
      ...val,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  aThreshold: 93,
  aMinusThreshold: 90,
  worstCaseFill: 50,
  fillStrategy: "avg_known_estimated",
};
const DEFAULT_ANALYZER_STATE = {
  selectedClassId: "",
  entries: {}
};

let _id = 0;
function uid() { return `${Date.now()}-${++_id}`; }

// ─── Computation ──────────────────────────────────────────────────────────────
function computeStats(categories, settings) {
  const known    = categories.filter(c => c.mode === "known"     && c.grade !== "");
  const estimated= categories.filter(c => c.mode === "estimated" && c.grade !== "");
  const analyze  = categories.filter(c => c.mode === "analyze");
  const knownEst = [...known, ...estimated];

  const currentWeightSum = knownEst.reduce((s, c) => s + c.weight, 0);
  const currentGrade = currentWeightSum > 0
    ? knownEst.reduce((s, c) => s + (c.weight / currentWeightSum) * parseFloat(c.grade), 0)
    : null;

  const worstFill = settings.worstCaseFill;
  const worstTotal = categories.reduce((s, c) => {
    if (c.mode === "analyze")   return s + (c.weight / 100) * worstFill;
    if (c.grade !== "")         return s + (c.weight / 100) * parseFloat(c.grade);
    return s;
  }, 0);
  const worstWeightUsed = categories.reduce((s, c) => {
    if (c.mode === "analyze" || c.grade !== "") return s + c.weight;
    return s;
  }, 0);
  const finalWorst = worstWeightUsed > 0 ? (worstTotal / worstWeightUsed) * 100 : null;

  const estimateFill = currentGrade !== null ? currentGrade : worstFill;
  const estimateTotal = categories.reduce((s, c) => {
    if (c.mode === "analyze") return s + (c.weight / 100) * estimateFill;
    if (c.grade !== "")       return s + (c.weight / 100) * parseFloat(c.grade);
    return s;
  }, 0);
  const estimateWeightUsed = categories.reduce((s, c) => {
    if (c.mode === "analyze" || c.grade !== "") return s + c.weight;
    return s;
  }, 0);
  const finalEstimate = estimateWeightUsed > 0 ? (estimateTotal / estimateWeightUsed) * 100 : null;

  const knownEstSum     = knownEst.reduce((s, c) => s + (c.weight / 100) * parseFloat(c.grade), 0);
  const yellowWeightSum = analyze.reduce((s, c) => s + c.weight / 100, 0);
  const minForA      = yellowWeightSum > 0 ? (settings.aThreshold      - knownEstSum) / yellowWeightSum : null;
  const minForAMinus = yellowWeightSum > 0 ? (settings.aMinusThreshold - knownEstSum) / yellowWeightSum : null;

  return { currentGrade, finalWorst, finalEstimate, minForA, minForAMinus, hasAnalyze: analyze.length > 0 };
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const G = {
  bg: "#0f0f13", surface: "#16161d", surfaceHover: "#1c1c26",
  border: "#2a2a38", borderLight: "#353548",
  text: "#e8e6f0", textMuted: "#7a7890", textDim: "#4a4860",
  amber: "#f5a623", green: "#3ecf8e", yellow: "#ffd166",
  yellowDim: "#7a5f1a", greenDim: "#1a6647", red: "#f25c5c",
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f13; color: #e8e6f0; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; line-height: 1.5; min-height: 100vh; }
  .app { display: flex; flex-direction: column; min-height: 100vh; }

  .nav { display: flex; align-items: center; background: #16161d; border-bottom: 1px solid #2a2a38; padding: 0 24px; position: sticky; top: 0; z-index: 100; }
  .nav-logo { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600; color: #f5a623; letter-spacing: 0.08em; padding: 16px 24px 16px 0; border-right: 1px solid #2a2a38; margin-right: 8px; white-space: nowrap; }
  .nav-tab { padding: 18px 16px; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: #7a7890; cursor: pointer; border: none; background: transparent; border-bottom: 2px solid transparent; transition: all 0.15s; white-space: nowrap; }
  .nav-tab:hover { color: #e8e6f0; }
  .nav-tab.active { color: #f5a623; border-bottom-color: #f5a623; }

  .main { flex: 1; padding: 32px 24px; max-width: 960px; margin: 0 auto; width: 100%; }
  .page-title { font-family: 'IBM Plex Mono', monospace; font-size: 20px; font-weight: 600; color: #e8e6f0; letter-spacing: -0.01em; }
  .page-subtitle { color: #7a7890; font-size: 13px; margin-top: 4px; }

  .card { background: #16161d; border: 1px solid #2a2a38; border-radius: 8px; padding: 20px; margin-bottom: 16px; animation: fadeUp 0.2s ease; }
  .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .card-title { font-family: 'IBM Plex Mono', monospace; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; color: #7a7890; text-transform: uppercase; }

  .input { background: #0f0f13; border: 1px solid #2a2a38; border-radius: 6px; color: #e8e6f0; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; padding: 8px 12px; outline: none; transition: border-color 0.15s; width: 100%; }
  .input:focus { border-color: #f5a623; }
  .input.error { border-color: #f25c5c; }
  .input-sm { padding: 6px 10px; font-size: 13px; }
  .input-num { font-family: 'IBM Plex Mono', monospace; text-align: right; }

  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; border: none; transition: all 0.15s; white-space: nowrap; }
  .btn-primary { background: #f5a623; color: #0f0f13; }
  .btn-primary:hover { background: #f7b84a; }
  .btn-ghost { background: transparent; color: #7a7890; border: 1px solid #2a2a38; }
  .btn-ghost:hover { background: #1c1c26; color: #e8e6f0; border-color: #353548; }
  .btn-danger { background: transparent; color: #f25c5c; border: 1px solid transparent; }
  .btn-danger:hover { background: rgba(242,92,92,0.1); border-color: rgba(242,92,92,0.3); }
  .btn-sm { padding: 5px 10px; font-size: 12px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
  .badge-known     { background: rgba(122,120,144,0.15); color: #7a7890; border: 1px solid rgba(122,120,144,0.25); }
  .badge-analyze   { background: rgba(255,209,102,0.12); color: #ffd166; border: 1px solid rgba(255,209,102,0.25); }
  .badge-estimated { background: rgba(62,207,142,0.12);  color: #3ecf8e; border: 1px solid rgba(62,207,142,0.25); }

  .cat-row { display: grid; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 6px; border: 1px solid #2a2a38; background: #0f0f13; margin-bottom: 8px; transition: border-color 0.15s; }
  .cat-row:hover { border-color: #353548; }
  .cat-row.mode-known     { border-left: 3px solid #7a7890; }
  .cat-row.mode-analyze   { border-left: 3px solid #ffd166; }
  .cat-row.mode-estimated { border-left: 3px solid #3ecf8e; }

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 12px; margin-bottom: 16px; }
  .stat-box { background: #0f0f13; border: 1px solid #2a2a38; border-radius: 8px; padding: 16px; }
  .stat-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #7a7890; margin-bottom: 8px; }
  .stat-value { font-family: 'IBM Plex Mono', monospace; font-size: 28px; font-weight: 600; color: #f5a623; line-height: 1; }
  .stat-value.null-val { color: #4a4860; font-size: 20px; }
  .stat-value.good { color: #3ecf8e; }
  .stat-value.warn { color: #ffd166; }
  .stat-value.bad  { color: #f25c5c; }
  .stat-sub { font-size: 11px; color: #7a7890; margin-top: 6px; }

  .select { background: #0f0f13; border: 1px solid #2a2a38; border-radius: 6px; color: #e8e6f0; font-family: 'IBM Plex Sans', sans-serif; font-size: 14px; padding: 8px 12px; outline: none; cursor: pointer; width: 100%; }
  .select:focus { border-color: #f5a623; }

  .mode-toggle { display: flex; gap: 4px; }
  .mode-btn { padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; cursor: pointer; border: 1px solid transparent; transition: all 0.12s; font-family: 'IBM Plex Mono', monospace; }
  .mode-btn-known     { color: #7a7890; border-color: #2a2a38; }
  .mode-btn-known.active, .mode-btn-known:hover     { background: rgba(122,120,144,0.2); color: #e8e6f0; border-color: #7a7890; }
  .mode-btn-analyze   { color: #7a5f1a; border-color: #2a2a38; }
  .mode-btn-analyze.active, .mode-btn-analyze:hover { background: rgba(255,209,102,0.15); color: #ffd166; border-color: #ffd166; }
  .mode-btn-estimated { color: #1a6647; border-color: #2a2a38; }
  .mode-btn-estimated.active, .mode-btn-estimated:hover { background: rgba(62,207,142,0.15); color: #3ecf8e; border-color: #3ecf8e; }

  .error-text { color: #f25c5c; font-size: 11px; margin-top: 4px; }
  .weight-total { font-family: 'IBM Plex Mono', monospace; font-size: 13px; }
  .weight-total.ok { color: #3ecf8e; }
  .weight-total.bad { color: #f25c5c; }
  .weight-total.partial { color: #ffd166; }

  .class-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border: 1px solid #2a2a38; border-radius: 6px; background: #0f0f13; margin-bottom: 8px; cursor: pointer; transition: all 0.15s; }
  .class-item:hover { border-color: #353548; background: #1c1c26; }
  .class-name { font-weight: 500; font-size: 14px; }
  .class-meta { font-size: 12px; color: #7a7890; margin-top: 2px; font-family: 'IBM Plex Mono', monospace; }

  .label { font-size: 12px; font-weight: 500; color: #7a7890; margin-bottom: 6px; display: block; letter-spacing: 0.04em; }
  .range-input { width: 100%; accent-color: #f5a623; cursor: pointer; }

  .delta { font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-weight: 600; }
  .delta.positive { color: #3ecf8e; }
  .delta.negative { color: #f25c5c; }
  .delta.neutral  { color: #7a7890; }

  .quick-controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }

  .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #2a2a38; }
  .setting-label { font-size: 14px; font-weight: 500; }
  .setting-desc  { font-size: 12px; color: #7a7890; margin-top: 2px; }
  .setting-input-wrap { display: flex; align-items: center; gap: 8px; }

  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal { background: #16161d; border: 1px solid #2a2a38; border-radius: 10px; padding: 24px; width: 340px; }
  .modal-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  .modal-body { font-size: 13px; color: #7a7890; margin-bottom: 20px; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

  .empty { text-align: center; padding: 48px 24px; color: #4a4860; font-size: 13px; }
  .empty-icon { font-size: 32px; margin-bottom: 12px; }

  .flex-between { display: flex; align-items: center; justify-content: space-between; }
  .flex-center  { display: flex; align-items: center; gap: 8px; }
  .mb-8  { margin-bottom: 8px; }
  .mb-16 { margin-bottom: 16px; }
  .gap-8 { gap: 8px; }

  /* EXPANDABLE CATEGORY ROW */
  .cat-card { border: 1px solid #2a2a38; border-radius: 8px; background: #0f0f13; margin-bottom: 10px; overflow: hidden; transition: border-color 0.15s; }
  .cat-card:hover { border-color: #353548; }
  .cat-card.mode-known    { border-left: 3px solid #7a7890; }
  .cat-card.mode-analyze  { border-left: 3px solid #ffd166; }
  .cat-card.mode-estimated{ border-left: 3px solid #3ecf8e; }
  .cat-card.expanded { border-color: #353548; }

  .cat-card-header {
    display: grid;
    grid-template-columns: 28px 1fr 70px 100px auto;
    gap: 8px;
    align-items: center;
    padding: 10px 12px;
    cursor: pointer;
    user-select: none;
  }
  .cat-card-header:hover { background: rgba(255,255,255,0.02); }

  .cat-chevron {
    font-size: 10px;
    color: #4a4860;
    transition: transform 0.2s;
    display: flex; align-items: center; justify-content: center;
  }
  .cat-chevron.open { transform: rotate(90deg); color: #7a7890; }

  /* ASSIGNMENT PANEL */
  .assignment-panel {
    border-top: 1px solid #2a2a38;
    padding: 12px 16px 16px;
    background: #0d0d11;
  }
  .assignment-panel-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px;
  }
  .assignment-panel-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
    text-transform: uppercase; color: #4a4860;
  }
  .assignment-row {
    display: grid;
    grid-template-columns: 1fr 80px 16px 80px 32px;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }
  .assignment-sep { font-family: 'IBM Plex Mono', monospace; font-size: 14px; color: #4a4860; text-align: center; }
  .pts-result {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px; color: #7a7890;
    text-align: right;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #2a2a38;
  }
  .pts-result .computed-grade { font-size: 18px; font-weight: 600; color: #f5a623; }
  .pts-result .pts-fraction { font-size: 11px; color: #4a4860; margin-left: 8px; }

  .grade-computed {
    background: rgba(245,166,35,0.08);
    border-color: rgba(245,166,35,0.25) !important;
    color: #f5a623;
  }

  @keyframes fadeUp   { from { opacity: 0; transform: translateY(8px);   } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 600px; } }
  .assignment-panel { animation: slideDown 0.18s ease; }

  .sandbox-float-bar {
    position: fixed;
    top: 57px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 90;
    display: flex;
    align-items: stretch;
    background: #16161d;
    border: 1px solid #353548;
    border-radius: 40px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,166,35,0.07);
    animation: fadeDown 0.2s ease;
    overflow: hidden;
    white-space: nowrap;
  }
  .float-bar-cell {
    padding: 10px 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    border-right: 1px solid #2a2a38;
  }
  .float-bar-cell:last-child { border-right: none; }
  .float-bar-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4a4860;
  }
  .float-bar-value {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 16px;
    font-weight: 600;
    line-height: 1;
  }
  .float-bar-value.good      { color: #3ecf8e; }
  .float-bar-value.warn      { color: #ffd166; }
  .float-bar-value.bad       { color: #f25c5c; }
  .float-bar-delta {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
  }
  .float-bar-delta.pos { color: #3ecf8e; }
  .float-bar-delta.neg { color: #f25c5c; }
`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfirmModal({ title, body, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger btn-sm" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, color }) {
  const fmt = v => (v === null || v === undefined) ? "—" : v.toFixed(1) + "%";
  const cls = (value === null || value === undefined) ? "null-val" : color || "";
  return (
    <div className="stat-box">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls}`}>{fmt(value)}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function StatsCard({ categories, settings }) {
  const s = computeStats(categories, settings);
  function minLabel(v) {
    if (v === null)  return "No analyze categories";
    if (v <= 0)      return "✓ Already secured";
    if (v > 100)     return "✗ Impossible (> 100%)";
    return `Need avg ${v.toFixed(1)}% across yellows`;
  }
  function minColor(v) {
    if (v === null || v <= 0) return "good";
    if (v > 100)  return "bad";
    if (v > 85)   return "warn";
    return "good";
  }
  function gradeColor(v) {
    if (v === null) return "";
    if (v >= settings.aThreshold)      return "good";
    if (v >= settings.aMinusThreshold) return "warn";
    return "bad";
  }
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Grade Estimates</div></div>
      <div className="stats-grid">
        <StatBox label="Current (so far)" value={s.currentGrade} sub="Known + Estimated, renorm." />
        <StatBox label="Final — Worst Case" value={s.finalWorst} sub={`Yellow → ${settings.worstCaseFill}%`} color={gradeColor(s.finalWorst)} />
        <StatBox label="Final — Estimate" value={s.finalEstimate} sub="Yellow → avg of known+est" color={gradeColor(s.finalEstimate)} />
        <StatBox
          label={`Min for A (${settings.aThreshold}%)`}
          value={s.hasAnalyze && s.minForA !== null && s.minForA >= 0 && s.minForA <= 100 ? s.minForA : null}
          sub={minLabel(s.minForA)} color={minColor(s.minForA)} />
        <StatBox
          label={`Min for A− (${settings.aMinusThreshold}%)`}
          value={s.hasAnalyze && s.minForAMinus !== null && s.minForAMinus >= 0 && s.minForAMinus <= 100 ? s.minForAMinus : null}
          sub={minLabel(s.minForAMinus)} color={minColor(s.minForAMinus)} />
      </div>
    </div>
  );
}

// ─── PAGE: Class Builder ──────────────────────────────────────────────────────

function ClassBuilder({ classes, setClasses }) {
  const [editingId, setEditingId]   = useState(null);
  const [form, setForm]             = useState({ name: "", categories: [] });
  const [errors, setErrors]         = useState({});
  const [confirmDelete, setConfirm] = useState(null);
  const [mode, setMode]             = useState("list");

  const weightTotal = form.categories.reduce((s, c) => s + (parseFloat(c.weight) || 0), 0);

  function startCreate() {
    setEditingId(null);
    setForm({ name: "", categories: [{ id: uid(), name: "", weight: "" }] });
    setErrors({});
    setMode("edit");
  }
  function startEdit(cls) {
    setEditingId(cls.id);
    setForm({ name: cls.name, categories: cls.categories.map(c => ({ ...c })) });
    setErrors({});
    setMode("edit");
  }
  function addCat()    { setForm(f => ({ ...f, categories: [...f.categories, { id: uid(), name: "", weight: "" }] })); }
  function removeCat(id) { setForm(f => ({ ...f, categories: f.categories.filter(c => c.id !== id) })); }
  function updateCat(id, field, val) {
    setForm(f => ({ ...f, categories: f.categories.map(c => c.id === id ? { ...c, [field]: val } : c) }));
  }
  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Class name required";
    if (form.categories.length === 0) e.cats = "At least one category required";
    form.categories.forEach(c => {
      if (!c.name.trim()) e[`name_${c.id}`] = "Required";
      const w = parseFloat(c.weight);
      if (isNaN(w) || w < 0 || w > 100) e[`w_${c.id}`] = "0–100";
    });
    if (form.categories.length > 0 && Math.abs(weightTotal - 100) > 0.01) e.weightTotal = "Weights must sum to 100%";
    return e;
  }
  function save() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const now = new Date().toISOString();
    if (editingId) {
      setClasses(cs => cs.map(c => c.id === editingId
        ? { ...c, name: form.name, categories: form.categories.map(c => ({ ...c, weight: parseFloat(c.weight) })), updatedAt: now }
        : c));
    } else {
      setClasses(cs => [...cs, {
        id: uid(), name: form.name,
        categories: form.categories.map(c => ({ ...c, weight: parseFloat(c.weight) })),
        createdAt: now, updatedAt: now,
      }]);
    }
    setMode("list");
  }
  function deleteClass(id) { setClasses(cs => cs.filter(c => c.id !== id)); setConfirm(null); }

  if (mode === "edit") return (
    <div>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div><div className="page-title">{editingId ? "Edit Class" : "New Class"}</div></div>
        <button className="btn btn-ghost btn-sm" onClick={() => setMode("list")}>← Back</button>
      </div>
      <div className="card">
        <label className="label">Class Name</label>
        <input className={`input ${errors.name ? "error" : ""}`} value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., MATH 301" />
        {errors.name && <div className="error-text">{errors.name}</div>}
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Grade Categories</div>
          <div className="flex-center gap-8">
            <span className={`weight-total ${Math.abs(weightTotal - 100) < 0.01 ? "ok" : weightTotal > 100 ? "bad" : "partial"}`}>
              Σ {weightTotal.toFixed(1)}%
            </span>
            <button className="btn btn-ghost btn-sm" onClick={addCat}>+ Category</button>
          </div>
        </div>
        {errors.weightTotal && <div className="error-text" style={{ marginBottom: 12 }}>{errors.weightTotal}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 36px", gap: 8, marginBottom: 8 }}>
          <span className="label">Name</span><span className="label">Weight %</span><span></span>
        </div>
        {form.categories.map(cat => (
          <div key={cat.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 36px", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input className={`input input-sm ${errors[`name_${cat.id}`] ? "error" : ""}`} value={cat.name}
              onChange={e => updateCat(cat.id, "name", e.target.value)} placeholder="Category name" />
            <input className={`input input-sm input-num ${errors[`w_${cat.id}`] ? "error" : ""}`} value={cat.weight}
              onChange={e => updateCat(cat.id, "weight", e.target.value)} placeholder="0" type="number" min="0" max="100" />
            <button className="btn btn-danger btn-sm" style={{ padding: "5px 8px" }} onClick={() => removeCat(cat.id)}>✕</button>
          </div>
        ))}
        {form.categories.length === 0 && (
          <div style={{ color: "#4a4860", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
            No categories yet. Click "+ Category" to add one.
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => setMode("list")}>Cancel</button>
        <button className="btn btn-primary" onClick={save}>{editingId ? "Save Changes" : "Create Class"}</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div><div className="page-title">Classes</div><div className="page-subtitle">Create and manage your classes</div></div>
        <button className="btn btn-primary" onClick={startCreate}>+ Class</button>
      </div>
      {classes.length === 0 ? (
        <div className="empty"><div className="empty-icon">📚</div>No classes yet. Create your first class to get started.</div>
      ) : classes.map(cls => (
        <div key={cls.id} className="class-item" onClick={() => startEdit(cls)}>
          <div>
            <div className="class-name">{cls.name}</div>
            <div className="class-meta">{cls.categories.length} cats · {cls.categories.map(c => `${c.name} (${c.weight}%)`).join(", ")}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(cls)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirm(cls)}>Delete</button>
          </div>
        </div>
      ))}
      {confirmDelete && (
        <ConfirmModal title="Delete Class" body={`Delete "${confirmDelete.name}"? This cannot be undone.`}
          onConfirm={() => deleteClass(confirmDelete.id)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

// ─── Assignment grade calculator ─────────────────────────────────────────────
function calcAssignmentGrade(assignments) {
  const valid = assignments.filter(a => parseFloat(a.total) > 0);
  if (valid.length === 0) return null;
  const totalEarned   = valid.reduce((s, a) => s + (parseFloat(a.earned) || 0), 0);
  const totalPossible = valid.reduce((s, a) => s + parseFloat(a.total), 0);
  return { pct: (totalEarned / totalPossible) * 100, earned: totalEarned, possible: totalPossible };
}

// ─── PAGE: Grade Analyzer ─────────────────────────────────────────────────────

function GradeAnalyzer({ classes, settings, analyzerState, setAnalyzerState }) {
  const { selectedClassId, entries } = analyzerState;
  const cls = classes.find(c => c.id === selectedClassId);
  const [expandedCatId, setExpandedCatId] = useState(null);

  const BLANK_ENTRY = { grade: "", mode: "known", assignments: [] };

  // Seed missing entries
  useEffect(() => {
    if (!cls) return;
    setAnalyzerState(prev => {
      const existing = prev.entries[cls.id] || {};
      let changed = false;
      const updated = {};
      cls.categories.forEach(cat => {
        if (!existing[cat.id]) { updated[cat.id] = { ...BLANK_ENTRY }; changed = true; }
        else updated[cat.id] = existing[cat.id];
      });
      if (!changed) return prev;
      return { ...prev, entries: { ...prev.entries, [cls.id]: { ...existing, ...updated } } };
    });
  }, [selectedClassId, cls?.categories?.length]);

  function setSelectedClassId(id) {
    setAnalyzerState(prev => ({ ...prev, selectedClassId: id }));
    setExpandedCatId(null);
  }

  function patchEntry(catId, patch) {
    setAnalyzerState(prev => {
      const clsEntries = prev.entries[selectedClassId] || {};
      const cur = clsEntries[catId] || { ...BLANK_ENTRY };
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [selectedClassId]: { ...clsEntries, [catId]: { ...cur, ...patch } },
        },
      };
    });
  }

  // Assignment CRUD
  function addAssignment(catId) {
    const clsEntries = entries[selectedClassId] || {};
    const cur = clsEntries[catId] || { ...BLANK_ENTRY };
    const newAssignment = { id: uid(), name: "", earned: "", total: "" };
    const assignments = [...(cur.assignments || []), newAssignment];
    patchEntry(catId, { assignments });
  }

  function patchAssignment(catId, aId, field, val) {
    const clsEntries = entries[selectedClassId] || {};
    const cur = clsEntries[catId] || { ...BLANK_ENTRY };
    const assignments = (cur.assignments || []).map(a => a.id === aId ? { ...a, [field]: val } : a);
    // Recompute grade from assignments
    const calc = calcAssignmentGrade(assignments);
    patchEntry(catId, { assignments, grade: calc !== null ? String(calc.pct.toFixed(4)) : cur.grade });
  }

  function removeAssignment(catId, aId) {
    const clsEntries = entries[selectedClassId] || {};
    const cur = clsEntries[catId] || { ...BLANK_ENTRY };
    const assignments = (cur.assignments || []).filter(a => a.id !== aId);
    const calc = calcAssignmentGrade(assignments);
    patchEntry(catId, { assignments, grade: calc !== null ? String(calc.pct.toFixed(4)) : "" });
  }

  const classEntries = cls ? (entries[cls.id] || {}) : {};

  // Build categories with effective grade (from assignments if available)
  const analyzeCategories = cls ? cls.categories.map(c => {
    const entry = classEntries[c.id] || { ...BLANK_ENTRY };
    const calc = calcAssignmentGrade(entry.assignments || []);
    const effectiveGrade = calc !== null ? String(calc.pct.toFixed(4)) : entry.grade;
    return { ...c, grade: effectiveGrade, mode: entry.mode };
  }) : [];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="page-title">Grade Analyzer</div>
        <div className="page-subtitle">Tap a category to add assignments · grades saved and used by Sandbox</div>
      </div>

      <div className="card">
        <label className="label">Select Class</label>
        <select className="select" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
          <option value="">— Choose a class —</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {cls && (
        <>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Categories</div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="badge badge-known">K</span>
                <span className="badge badge-analyze">A</span>
                <span className="badge badge-estimated">E</span>
              </div>
            </div>

            {cls.categories.map(cat => {
              const entry       = classEntries[cat.id] || { ...BLANK_ENTRY };
              const assignments = entry.assignments || [];
              const calc        = calcAssignmentGrade(assignments);
              const isExpanded  = expandedCatId === cat.id;
              const hasAssign   = assignments.length > 0;

              // Effective displayed grade
              const displayGrade = calc !== null
                ? calc.pct.toFixed(1)
                : entry.grade !== "" ? parseFloat(entry.grade).toFixed(1) : "";

              const modeColor = entry.mode === "known" ? "#7a7890"
                : entry.mode === "analyze" ? "#ffd166" : "#3ecf8e";

              return (
                <div key={cat.id} className={`cat-card mode-${entry.mode}${isExpanded ? " expanded" : ""}`}>
                  {/* ── Header row (clickable) ── */}
                  <div className="cat-card-header"
                    onClick={() => setExpandedCatId(isExpanded ? null : cat.id)}>

                    {/* Chevron */}
                    <div className={`cat-chevron${isExpanded ? " open" : ""}`}>▶</div>

                    {/* Name + assignment count pill */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {cat.name}
                      </span>
                      {hasAssign && (
                        <span style={{
                          background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)",
                          borderRadius: 4, padding: "1px 6px",
                          fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: "#f5a623",
                        }}>
                          {assignments.length} assign.
                        </span>
                      )}
                    </div>

                    {/* Weight */}
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: "#7a7890", textAlign: "right" }}>
                      {cat.weight}%
                    </div>

                    {/* Grade — computed or manual */}
                    <div onClick={e => e.stopPropagation()}>
                      {calc !== null ? (
                        // Computed from assignments — read-only display
                        <div className={`input input-sm input-num grade-computed`}
                          style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", height: 31 }}>
                          {calc.pct.toFixed(1)}%
                        </div>
                      ) : (
                        <input
                          className="input input-sm input-num"
                          value={entry.grade}
                          disabled={entry.mode === "analyze"}
                          onChange={e => patchEntry(cat.id, { grade: e.target.value })}
                          placeholder={entry.mode === "analyze" ? "—" : "0–100"}
                          type="number" min="0" max="100"
                          style={{ opacity: entry.mode === "analyze" ? 0.4 : 1 }}
                        />
                      )}
                    </div>

                    {/* Mode toggle */}
                    <div className="mode-toggle" onClick={e => e.stopPropagation()}>
                      {["known", "analyze", "estimated"].map(m => (
                        <button key={m} className={`mode-btn mode-btn-${m} ${entry.mode === m ? "active" : ""}`}
                          onClick={() => patchEntry(cat.id, { mode: m })}>
                          {m === "known" ? "K" : m === "analyze" ? "A" : "E"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Expanded assignment panel ── */}
                  {isExpanded && (
                    <div className="assignment-panel">
                      <div className="assignment-panel-header">
                        <span className="assignment-panel-title">Assignments</span>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                          onClick={() => addAssignment(cat.id)}>
                          + Add
                        </button>
                      </div>

                      {assignments.length === 0 ? (
                        <div style={{ color: "#4a4860", fontSize: 12, textAlign: "center", padding: "12px 0" }}>
                          No assignments yet — click "+ Add" to track individual scores
                        </div>
                      ) : (
                        <>
                          {/* Column headers */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 16px 80px 32px", gap: 6, marginBottom: 4 }}>
                            <span className="label" style={{ marginBottom: 0 }}>Name</span>
                            <span className="label" style={{ marginBottom: 0, textAlign: "right" }}>Earned</span>
                            <span></span>
                            <span className="label" style={{ marginBottom: 0, textAlign: "right" }}>Total</span>
                            <span></span>
                          </div>

                          {assignments.map(a => {
                            const pct = parseFloat(a.total) > 0
                              ? ((parseFloat(a.earned) || 0) / parseFloat(a.total) * 100)
                              : null;
                            return (
                              <div key={a.id} className="assignment-row">
                                <input
                                  className="input input-sm"
                                  value={a.name}
                                  onChange={e => patchAssignment(cat.id, a.id, "name", e.target.value)}
                                  placeholder="e.g., HW 1"
                                />
                                <input
                                  className="input input-sm input-num"
                                  value={a.earned}
                                  onChange={e => patchAssignment(cat.id, a.id, "earned", e.target.value)}
                                  placeholder="0"
                                  type="number" min="0"
                                />
                                <div className="assignment-sep">/</div>
                                <input
                                  className="input input-sm input-num"
                                  value={a.total}
                                  onChange={e => patchAssignment(cat.id, a.id, "total", e.target.value)}
                                  placeholder="100"
                                  type="number" min="0"
                                />
                                <button className="btn btn-danger btn-sm" style={{ padding: "4px 7px", fontSize: 11 }}
                                  onClick={() => removeAssignment(cat.id, a.id)}>
                                  ✕
                                </button>
                              </div>
                            );
                          })}

                          {/* Running total */}
                          {calc !== null && (
                            <div className="pts-result">
                              <span className="computed-grade">{calc.pct.toFixed(2)}%</span>
                              <span className="pts-fraction">
                                {calc.earned % 1 === 0 ? calc.earned : calc.earned.toFixed(2)} / {calc.possible} pts
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <StatsCard categories={analyzeCategories} settings={settings} />
        </>
      )}

      {!cls && classes.length === 0 && (
        <div className="empty"><div className="empty-icon">📊</div>No classes found. Create one in Class Builder first.</div>
      )}
      {!cls && classes.length > 0 && (
        <div className="empty"><div className="empty-icon">📊</div>Select a class above to start analyzing.</div>
      )}
    </div>
  );
}

// ─── PAGE: Sandbox ────────────────────────────────────────────────────────────

function Sandbox({ classes, settings, analyzerState }) {
  const { selectedClassId, entries } = analyzerState;
  const cls = classes.find(c => c.id === selectedClassId);
  const classEntries = cls ? (entries[cls.id] || {}) : {};

  const [sandboxGrades, setSandboxGrades] = useState({});
  const [seededFor, setSeededFor]         = useState(null);
  const [floatVisible, setFloatVisible]   = useState(false);
  const liveGradeRef = useRef(null);

  // Show floating bar when the live grade card scrolls out of view
  useEffect(() => {
    const el = liveGradeRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFloatVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-57px 0px 0px 0px" } // account for sticky nav
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cls]);

  useEffect(() => {
    if (!cls || cls.id === seededFor) return;
    const seeds = {};
    cls.categories.forEach(cat => {
      const entry = classEntries[cat.id] || { grade: "", mode: "known" };
      const calc  = calcAssignmentGrade(entry.assignments || []);
      const effectiveGrade = calc !== null ? calc.pct : parseFloat(entry.grade) || 0;
      if (entry.mode === "analyze") {
        seeds[cat.id] = settings.worstCaseFill;
      } else if (entry.mode === "estimated") {
        seeds[cat.id] = effectiveGrade;
      }
    });
    setSandboxGrades(seeds);
    setSeededFor(cls.id);
  }, [selectedClassId, cls]);

  function setGrade(catId, val) {
    setSandboxGrades(g => ({ ...g, [catId]: parseFloat(val) }));
  }

  function computeAvgKnownEst() {
    if (!cls) return settings.worstCaseFill;
    const knownEst = cls.categories.filter(cat => {
      const e = classEntries[cat.id];
      return e && (e.mode === "known" || e.mode === "estimated");
    });
    const withGrades = knownEst.filter(cat => {
      const e = classEntries[cat.id];
      const calc = calcAssignmentGrade(e.assignments || []);
      return calc !== null || e.grade !== "";
    });
    const wSum = withGrades.reduce((s, c) => s + c.weight, 0);
    if (wSum === 0) return settings.worstCaseFill;
    return withGrades.reduce((s, c) => {
      const e = classEntries[c.id];
      const calc = calcAssignmentGrade(e.assignments || []);
      const g = calc !== null ? calc.pct : parseFloat(e.grade);
      return s + (c.weight / wSum) * g;
    }, 0);
  }

  function setAllAnalyze(val) {
    if (!cls) return;
    setSandboxGrades(prev => {
      const next = { ...prev };
      cls.categories.forEach(cat => {
        const mode = classEntries[cat.id]?.mode ?? "known";
        if (mode === "analyze") next[cat.id] = parseFloat(val);
      });
      return next;
    });
  }

  // Final sandbox grade = sum of weighted grades for all categories
  const totalGrade = cls
    ? cls.categories.reduce((sum, cat) => {
        const entry = classEntries[cat.id] || { grade: "", mode: "known" };
        const calc  = calcAssignmentGrade(entry.assignments || []);
        const knownGrade = calc !== null ? calc.pct : (entry.grade !== "" ? parseFloat(entry.grade) : null);
        if (entry.mode === "known") {
          return sum + (knownGrade !== null ? (cat.weight / 100) * knownGrade : 0);
        }
        const sg = sandboxGrades[cat.id];
        return sum + (sg !== undefined ? (cat.weight / 100) * sg : 0);
      }, 0)
    : null;

  const deltaA      = totalGrade !== null ? totalGrade - settings.aThreshold      : null;
  const deltaAMinus = totalGrade !== null ? totalGrade - settings.aMinusThreshold : null;

  const hasFlexible = cls && cls.categories.some(cat => {
    const mode = classEntries[cat.id]?.mode ?? "known";
    return mode === "analyze" || mode === "estimated";
  });

  if (!cls) {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div className="page-title">Scenario Sandbox</div>
          <div className="page-subtitle">Play with grades live — seeded from Grade Analyzer</div>
        </div>
        <div className="empty">
          <div className="empty-icon">🧪</div>
          {classes.length > 0
            ? "No class selected in Grade Analyzer. Head there first, pick a class, then come back."
            : "No classes found. Create one in Class Builder first."}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: 24 }}>
        <div>
          <div className="page-title">Scenario Sandbox</div>
          <div className="page-subtitle">
            {cls.name} · Known grades are locked · Analyze/Estimated are editable sliders
          </div>
        </div>
      </div>

      {/* Live grade */}
      <div className="card" ref={liveGradeRef}>
        <div className="card-title" style={{ marginBottom: 16 }}>Live Grade</div>
        <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="stat-label">Final Grade</div>
            <div className={`stat-value ${
              totalGrade >= settings.aThreshold ? "good"
              : totalGrade >= settings.aMinusThreshold ? "warn"
              : "bad"}`}>
              {totalGrade.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="stat-label">vs A ({settings.aThreshold}%)</div>
            <div className={`delta ${deltaA >= 0 ? "positive" : "negative"}`}>
              {(deltaA >= 0 ? "+" : "") + deltaA.toFixed(2) + "%"}
            </div>
          </div>
          <div>
            <div className="stat-label">vs A− ({settings.aMinusThreshold}%)</div>
            <div className={`delta ${deltaAMinus >= 0 ? "positive" : "negative"}`}>
              {(deltaAMinus >= 0 ? "+" : "") + deltaAMinus.toFixed(2) + "%"}
            </div>
          </div>
        </div>
      </div>

      {/* Floating grade bar — shown when live grade card scrolls out of view */}
      {floatVisible && (
        <div className="sandbox-float-bar">
          <div className="float-bar-cell">
            <div className="float-bar-label">Grade</div>
            <div className={`float-bar-value ${totalGrade >= settings.aThreshold ? "good" : totalGrade >= settings.aMinusThreshold ? "warn" : "bad"}`}>
              {totalGrade.toFixed(2)}%
            </div>
          </div>
          <div className="float-bar-cell">
            <div className="float-bar-label">vs A ({settings.aThreshold}%)</div>
            <div className={`float-bar-delta ${deltaA >= 0 ? "pos" : "neg"}`}>
              {(deltaA >= 0 ? "+" : "") + deltaA.toFixed(2) + "%"}
            </div>
          </div>
          <div className="float-bar-cell">
            <div className="float-bar-label">vs A− ({settings.aMinusThreshold}%)</div>
            <div className={`float-bar-delta ${deltaAMinus >= 0 ? "pos" : "neg"}`}>
              {(deltaAMinus >= 0 ? "+" : "") + deltaAMinus.toFixed(2) + "%"}
            </div>
          </div>
        </div>
      )}

      {/* Quick controls — only for analyze categories */}
      {hasFlexible && (
        <div className="quick-controls">
          <button className="btn btn-ghost btn-sm" onClick={() => setAllAnalyze(100)}>Set yellows → 100%</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAllAnalyze(settings.worstCaseFill)}>
            Reset yellows → worst case ({settings.worstCaseFill}%)
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAllAnalyze(computeAvgKnownEst())}>
            Reset yellows → final estimate
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAllAnalyze(settings.aThreshold)}>
            Set yellows → A threshold ({settings.aThreshold}%)
          </button>
        </div>
      )}

      {/* Category sliders */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 16 }}>Categories</div>
        {cls.categories.map(cat => {
          const entry  = classEntries[cat.id] || { grade: "", mode: "known" };
          const mode   = entry.mode;
          const locked = mode === "known";

          let displayVal, sliderVal;
          if (locked) {
            displayVal = entry.grade !== "" ? parseFloat(entry.grade) : null;
            sliderVal  = displayVal ?? 0;
          } else {
            displayVal = sandboxGrades[cat.id] ?? 0;
            sliderVal  = displayVal;
          }

          const modeColor = mode === "known" ? "#7a7890" : mode === "analyze" ? "#ffd166" : "#3ecf8e";

          return (
            <div key={cat.id} style={{ marginBottom: 20 }}>
              <div className="flex-between mb-8">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{
                    width: 3, height: 28, borderRadius: 2, background: modeColor, flexShrink: 0,
                  }} />
                  <div>
                    <span style={{ fontWeight: 500 }}>{cat.name}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "#7a7890", marginLeft: 8 }}>
                      {cat.weight}%
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: modeColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {locked ? "🔒 " : ""}
                    {mode}
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 600, color: modeColor, minWidth: 60, textAlign: "right" }}>
                    {displayVal !== null ? Math.round(displayVal) + "%" : "—"}
                  </span>
                </div>
              </div>
              <input
                type="range" min="0" max="100" step="0.5"
                className="range-input"
                value={sliderVal}
                disabled={locked}
                onChange={e => setGrade(cat.id, e.target.value)}
                style={{ opacity: locked ? 0.2 : 1, cursor: locked ? "not-allowed" : "pointer" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PAGE: Settings ───────────────────────────────────────────────────────────

function Settings({ settings, setSettings }) {
  function update(field, val) { setSettings(s => ({ ...s, [field]: parseFloat(val) || 0 })); }
  const rows = [
    { key: "aThreshold",      label: "A Threshold",      desc: "Minimum grade for an A"                            },
    { key: "aMinusThreshold", label: "A− Threshold",     desc: "Minimum grade for an A−"                           },
    { key: "worstCaseFill",   label: "Worst-Case Fill",  desc: "Grade assigned to Analyze categories in worst case" },
  ];
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div className="page-title">Settings</div>
        <div className="page-subtitle">Configure thresholds and defaults</div>
      </div>
      <div className="card">
        {rows.map(r => (
          <div key={r.key} className="setting-row">
            <div><div className="setting-label">{r.label}</div><div className="setting-desc">{r.desc}</div></div>
            <div className="setting-input-wrap">
              <input className="input input-num" style={{ width: 80 }} type="number" min="0" max="100"
                value={settings[r.key]} onChange={e => update(r.key, e.target.value)} />
              <span style={{ color: "#7a7890", fontSize: 13 }}>%</span>
            </div>
          </div>
        ))}
        <div className="setting-row">
          <div><div className="setting-label">Fill Strategy</div><div className="setting-desc">How to estimate Analyze categories in "Final Estimate"</div></div>
          <select className="select" style={{ width: 220 }} value={settings.fillStrategy}
            onChange={e => setSettings(s => ({ ...s, fillStrategy: e.target.value }))}>
            <option value="avg_known_estimated">Avg of Known + Estimated</option>
            <option value="worst_case">Worst Case Only</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button className="btn btn-ghost" onClick={() => setSettings(DEFAULT_SETTINGS)}>Restore Defaults</button>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

function AuthGate({ authReady, user, onSignIn }) {
  if (!authReady) {
    return (
      <div className="app">
        <main className="main">
          <div className="card">
            <div className="page-title">Loading...</div>
          </div>
        </main>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="app">
      <main className="main">
        <div className="card" style={{ maxWidth: 520, margin: "64px auto 0" }}>
          <div className="page-title">Grade Estimator</div>
          <div className="page-subtitle" style={{ marginBottom: 20 }}>
            Sign in with Google to save your data to Firebase.
          </div>
          <button className="btn btn-primary" onClick={onSignIn}>
            Sign in with Google
          </button>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [page, setPage]         = useState("builder");
  const [classes, setClasses]   = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [user, setUser]         = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const saveTimerRef = useRef(null);

  // Shared state: analyzer entries + selected class, persisted, read by Sandbox
  const [analyzerState, setAnalyzerState] = useState(DEFAULT_ANALYZER_STATE);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setClasses([]);
      setSettings(DEFAULT_SETTINGS);
      setAnalyzerState(DEFAULT_ANALYZER_STATE);
      setLoaded(false);
      setSaveState("idle");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const remote = await loadStorage(user.uid);
        if (cancelled) return;
        setClasses(Array.isArray(remote?.classes) ? remote.classes : []);
        setSettings(remote?.settings ? { ...DEFAULT_SETTINGS, ...remote.settings } : DEFAULT_SETTINGS);
        setAnalyzerState(remote?.analyzerState ?? DEFAULT_ANALYZER_STATE);
        setLoaded(true);
      } catch {
        if (cancelled) return;
        setClasses([]);
        setSettings(DEFAULT_SETTINGS);
        setAnalyzerState(DEFAULT_ANALYZER_STATE);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!user || !loaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    setSaveState("saving");
    saveTimerRef.current = setTimeout(() => {
      saveStorage(user.uid, { classes, settings, analyzerState })
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [classes, settings, analyzerState, loaded, user]);

  const tabs = [
    { id: "builder",  label: "Class Builder"  },
    { id: "analyzer", label: "Grade Analyzer" },
    { id: "sandbox",  label: "Sandbox"        },
    { id: "settings", label: "Settings"       },
  ];

  if (!user) {
    return (
      <>
        <style>{css}</style>
        <AuthGate
          authReady={authReady}
          user={user}
          onSignIn={() => signInWithPopup(auth, provider).catch(() => undefined)}
        />
      </>
    );
  }

  if (!loaded) {
    return (
      <>
        <style>{css}</style>
        <div className="app">
          <main className="main">
            <div className="card">
              <div className="page-title">Loading your data...</div>
            </div>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <nav className="nav">
          <div className="nav-logo">GRADESCOPE</div>
          {tabs.map(t => (
            <button key={t.id} className={`nav-tab ${page === t.id ? "active" : ""}`} onClick={() => setPage(t.id)}>
              {t.label}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <span className="page-subtitle" style={{ marginTop: 0 }}>
              {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save error" : ""}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => signOut(auth)}>
              Sign out
            </button>
          </div>
        </nav>
        <main className="main">
          {page === "builder"  && <ClassBuilder  classes={classes} setClasses={setClasses} />}
          {page === "analyzer" && <GradeAnalyzer classes={classes} settings={settings} analyzerState={analyzerState} setAnalyzerState={setAnalyzerState} />}
          {page === "sandbox"  && <Sandbox       classes={classes} settings={settings} analyzerState={analyzerState} />}
          {page === "settings" && <Settings      settings={settings} setSettings={setSettings} />}
        </main>
      </div>
    </>
  );
}
