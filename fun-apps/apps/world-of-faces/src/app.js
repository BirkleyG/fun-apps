import { FALLBACK_LANGS } from './languages.js';

// ═══════════════════════════════════════════════════════════════
//  WORLD OF FACES — Field Interview App
//  v1.0 | Single-file PWA
// ═══════════════════════════════════════════════════════════════

const App = (() => {

  // ─── STATE ───────────────────────────────────────────────────
  const state = {
    languages: {},
    langCode: null,
    lang: null,
    iv: null,        // current interview object
    qIndex: 0,       // current question (0-based)
    questionPrefs: {},
    isRec: false,
    recorder: null,
    chunks: [],
    timerSec: 0,
    timerID: null,
    currentAudio: null,
    db: null,
    dark: false,
    detailId: null,
  };

  const QUESTION_PREFS_KEY = 'wos_question_prefs';
  const LAST_LANG_KEY = 'wos_last_lang';
  const MINUTES_PER_QUESTION = 3;

  // ─── DB HELPERS ──────────────────────────────────────────────
  function openDB() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('wos_db', 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('interviews'))
          db.createObjectStore('interviews', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('recordings')) {
          const s = db.createObjectStore('recordings', { keyPath: 'key' });
          s.createIndex('ivId', 'ivId', { unique: false });
        }
      };
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej(req.error);
    });
  }

  function tx(storeName, mode, fn) {
    return new Promise((res, rej) => {
      const t = state.db.transaction(storeName, mode);
      const s = t.objectStore(storeName);
      const r = fn(s);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }

  const dbPut    = (store, obj)  => tx(store, 'readwrite', s => s.put(obj));
  const dbGet    = (store, key)  => tx(store, 'readonly',  s => s.get(key));
  const dbDel    = (store, key)  => tx(store, 'readwrite', s => s.delete(key));
  const dbAll    = (store)       => tx(store, 'readonly',  s => s.getAll());
  const dbIndex  = (store, idx, val) => new Promise((res, rej) => {
    const t = state.db.transaction(store, 'readonly');
    const r = t.objectStore(store).index(idx).getAll(val);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });

  // ─── INIT ────────────────────────────────────────────────────
  async function init() {
    // Dark mode
    if (localStorage.getItem('darkMode') === '1') {
      state.dark = true;
      document.body.classList.add('dark');
      document.getElementById('dark-toggle').classList.add('on');
    }

    state.db = await openDB();
    await loadLanguages();
    loadQuestionPrefs();

    checkDraft();
  }

  // ─── LANGUAGES ───────────────────────────────────────────────
  async function loadLanguages() {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}languages.json`);
      const d = await r.json();
      state.languages = d.languages;
    } catch (_) {
      state.languages = FALLBACK_LANGS;
    }
  }

  function loadQuestionPrefs() {
    try {
      const raw = localStorage.getItem(QUESTION_PREFS_KEY);
      state.questionPrefs = raw ? JSON.parse(raw) : {};
    } catch (_) {
      state.questionPrefs = {};
    }
  }

  function saveQuestionPrefs() {
    try {
      localStorage.setItem(QUESTION_PREFS_KEY, JSON.stringify(state.questionPrefs));
    } catch (_) {}
  }

  function ensureQuestionPrefs(langCode, total) {
    let changed = false;
    const existing = Array.isArray(state.questionPrefs?.[langCode])
      ? state.questionPrefs[langCode].slice(0, total)
      : [];
    if (!Array.isArray(state.questionPrefs?.[langCode])) changed = true;
    while (existing.length < total) { existing.push(true); changed = true; }
    state.questionPrefs[langCode] = existing;
    if (changed) saveQuestionPrefs();
    return existing;
  }

  function getActiveQuestions() {
    const qs = state.lang?.questions || [];
    const enabled = ensureQuestionPrefs(state.langCode, qs.length);
    const active = [];
    qs.forEach((q, i) => {
      if (enabled[i] !== false) active.push({ index: i, text: q });
    });
    return active;
  }

  function getCurrentQuestion() {
    const active = getActiveQuestions();
    return active[state.qIndex] || null;
  }

  function getCurrentQKey() {
    const q = getCurrentQuestion();
    return q ? `Q${q.index + 1}` : null;
  }

  function getSettingsLang() {
    const saved = localStorage.getItem(LAST_LANG_KEY);
    const code = state.langCode || saved || 'en';
    const lang = state.languages[code]
      || state.languages.en
      || Object.values(state.languages)[0]
      || { label: 'English', questions: [] };
    return { code, lang };
  }

  // ─── NAVIGATION ──────────────────────────────────────────────
  function go(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('s-' + screen).classList.add('active');

    if (screen === 'saved-list')   renderSavedList();
    if (screen === 'audio-files')  renderAudioFiles();
    if (screen === 'settings')     renderSettings();
  }

  // ─── NEW INTERVIEW ───────────────────────────────────────────
  function startNew() {
    state.iv = {
      id: null, date: null,
      name: '', age: '', religion: '', location: '',
      language: '', langLabel: '',
      status: 'draft',
      recs: {}  // { 'Q1': { key, filename, dur }, ... }
    };
    state.qIndex = 0;
    state.langCode = null;
    go('language');
    renderLangList();
  }

  // ─── LANGUAGE SELECT ─────────────────────────────────────────
  function renderLangList() {
    const list = document.getElementById('lang-list');
    const btn  = document.getElementById('lang-continue-btn');
    list.innerHTML = '';
    Object.entries(state.languages).forEach(([code, lang]) => {
      const card = document.createElement('div');
      card.className = 'lang-card' + (code === state.langCode ? ' selected' : '');
      card.innerHTML = `<div><div class="lang-card-name">${lang.label}</div><div class="lang-card-native">${lang.nativeLabel || ''}</div></div>`;
      card.onclick = () => {
        state.langCode = code;
        state.lang = lang;
        localStorage.setItem(LAST_LANG_KEY, code);
        ensureQuestionPrefs(code, (lang.questions || []).length);
        renderLangList();
        document.getElementById('lang-continue-btn').style.display = 'flex';
      };
      list.appendChild(card);
    });
    btn.style.display = state.langCode ? 'flex' : 'none';
  }

  function goConsent() {
    if (!state.langCode) { toast('Select a language'); return; }
    state.lang = state.languages[state.langCode];
    const el = document.getElementById('consent-text');
    el.textContent = state.lang.intro;
    el.className = 'consent-text' + (state.lang.dir === 'rtl' ? ' rtl' : '');
    // Translated buttons
    document.getElementById('consent-btn-yes').textContent = state.lang.consent_yes || '✓  Yes, I agree';
    document.getElementById('consent-btn-no').textContent  = state.lang.consent_no  || '✗  No thanks';
    go('consent');
  }

  function consentYes() {
    go('info');
    renderInfoForm();
  }

  // ─── INFO FORM ───────────────────────────────────────────────
  function renderInfoForm() {
    const f   = state.lang.fields;
    const dir = state.lang.dir || 'ltr';
    document.getElementById('info-header').textContent = f.sectionTitle || 'Biographical Info';
    document.getElementById('info-form').innerHTML = `
      <div class="settings-group-label" style="margin-bottom:16px">${f.sectionTitle || 'Biographical Info'}</div>
      ${field('name',     f.name,     'text',   dir, state.iv.name)}
      ${field('age',      f.age,      'number', dir, state.iv.age)}
      ${field('religion', f.religion, 'text',   dir, state.iv.religion)}
      ${field('location', f.location || 'Location', 'text', dir, state.iv.location)}
    `;
  }

  function field(id, label, type, dir, val='') {
    return `
      <div class="form-group">
        <label class="form-label" for="f-${id}">${label}</label>
        <input class="form-input" id="f-${id}" type="${type}"
          inputmode="${type==='number'?'numeric':'text'}"
          dir="${dir}" value="${val || ''}">
      </div>`;
  }

  function beginInterview() {
    state.iv.name     = document.getElementById('f-name')?.value.trim()     || 'Unknown';
    state.iv.age      = document.getElementById('f-age')?.value.trim()      || '';
    state.iv.religion = document.getElementById('f-religion')?.value.trim() || '';
    state.iv.location = document.getElementById('f-location')?.value.trim() || '';
    state.iv.language = state.langCode;
    state.iv.langLabel = state.lang.label;

    const active = getActiveQuestions();
    if (!active.length) {
      toast('Enable at least one question in Settings');
      return;
    }

    const now = new Date();
    state.iv.date = now.toISOString().slice(0,10);
    state.iv.id   = `${state.iv.date}-${sanitize(state.iv.name)}-${Date.now()}`;

    state.qIndex = 0;
    go('prep');
    renderPrep();
  }

  function renderPrep() {
    const active = getActiveQuestions();
    if (!active.length) {
      toast('Enable at least one question in Settings');
      go('settings');
      return;
    }
    const minutes = active.length * MINUTES_PER_QUESTION;
    const interviewPrompt = state.lang.interview_question
      || `Now, is it okay if I ask you a few questions? It will take around ${minutes} minutes to answer.`;
    const instructions = state.lang.instructions
      || 'The screen will show a question. I will record your answer on my phone. Once you are done, just let me know, and I will move to the next question. Feel free to take as long or as short as you want.';
    const languageNote = state.lang.language_note
      || 'Just so you know, I will not understand what you are saying, so feel free to say whatever you wish. I will only translate the recording once our conversation is finished.';
    const questionNotes = state.lang.question_notes
      || 'The questions are intentionally left ambiguous and open ended. This means you cannot answer them in a way that is wrong. Answer however you wish!';

    const dir = state.lang.dir === 'rtl' ? ' rtl' : '';
    const promptEl = document.getElementById('prep-question');
    const instrEl = document.getElementById('prep-instructions');
    const langEl = document.getElementById('prep-language-note');
    const notesEl = document.getElementById('prep-question-notes');

    if (promptEl) {
      promptEl.textContent = interviewPrompt.replace('{minutes}', minutes);
      promptEl.className = 'prep-text' + dir;
    }
    if (instrEl) {
      instrEl.textContent = instructions;
      instrEl.className = 'prep-text' + dir;
    }
    if (langEl) {
      langEl.textContent = languageNote;
      langEl.className = 'prep-text' + dir;
    }
    if (notesEl) {
      notesEl.textContent = questionNotes;
      notesEl.className = 'prep-text' + dir;
    }
  }

  function startQuestions() {
    state.qIndex = 0;
    go('question');
    renderQuestion();
  }

  // ─── QUESTION SCREEN ─────────────────────────────────────────
  function renderQuestion() {
    const active = getActiveQuestions();
    if (!active.length) {
      toast('Enable at least one question in Settings');
      go('settings');
      return;
    }
    const i     = state.qIndex;
    const total = active.length;
    if (i >= total) {
      state.qIndex = 0;
      renderQuestion();
      return;
    }
    const current = active[i];
    const qKey = current ? `Q${current.index + 1}` : null;

    document.getElementById('q-counter').textContent = `Q ${i+1} / ${total}`;
    document.getElementById('q-lang-tag').textContent = state.lang.label;
    document.getElementById('next-label').textContent = i === total-1 ? 'Finish' : 'Next';

    // Dots
    const dotsEl = document.getElementById('q-dots');
    dotsEl.innerHTML = '';
    active.forEach((q, di) => {
      const d = document.createElement('div');
      d.className = 'q-dot';
      if (di === i) d.classList.add('active');
      else if (q && state.iv.recs[`Q${q.index + 1}`]) d.classList.add('recorded');
      dotsEl.appendChild(d);
    });

    // Question text
    const textEl = document.getElementById('q-text');
    textEl.textContent = current ? current.text : '';
    textEl.className   = 'q-text' + (state.lang.dir === 'rtl' ? ' rtl' : '');

    requestAnimationFrame(fitText);
    updateRecButtons(qKey);
    saveDraft();
  }

  function fitText() {
    const stage  = document.getElementById('q-stage');
    const textEl = document.getElementById('q-text');
    const maxH   = stage.clientHeight - 32;
    let lo = 28, hi = 180;
    textEl.style.fontSize = hi + 'px';
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      textEl.style.fontSize = mid + 'px';
      if (textEl.scrollHeight <= maxH) lo = mid;
      else hi = mid;
    }
    textEl.style.fontSize = lo + 'px';
  }

  function updateRecButtons(qKey = getCurrentQKey()) {
    if (!qKey) return;
    const hasRec = !!state.iv.recs[qKey];
    const btnRec = document.getElementById('btn-record');
    const btnPly = document.getElementById('btn-play');
    const status = document.getElementById('q-status');

    if (state.isRec) {
      btnRec.className = 'ctrl-btn recording';
      document.getElementById('rec-icon').textContent  = '⏹';
      document.getElementById('rec-label').textContent = 'Stop';
      btnPly.className = 'ctrl-btn disabled';
      status.innerHTML = `<div class="rec-badge"><div class="rec-dot"></div><span id="rec-timer">0:00</span></div>`;
    } else {
      btnRec.className = 'ctrl-btn primary';
      document.getElementById('rec-icon').textContent  = '⏺';
      document.getElementById('rec-label').textContent = hasRec ? 'Re-record' : 'Record';
      btnPly.className = hasRec ? 'ctrl-btn' : 'ctrl-btn disabled';
      status.innerHTML = hasRec
        ? `<div class="ok-badge">✓ Recording saved</div>`
        : '';
    }
  }

  // ─── RECORDING ───────────────────────────────────────────────
  async function toggleRecord() {
    if (state.isRec) { stopRec(); return; }
    const qKey = getCurrentQKey();
    if (!qKey) return;
    if (state.iv.recs[qKey]) {
      showSheet('Re-record this answer?', [
        { label: 'Re-record',      fn: startRec },
        { label: 'Cancel', cls: 'cancel', fn: () => {} },
      ]);
    } else {
      startRec();
    }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      state.chunks = [];

      // iOS Safari supports audio/mp4; fall back to webm
      let mime = 'audio/webm';
      for (const m of ['audio/mp4','audio/aac','audio/webm']) {
        if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
      }

      state.recorder = new MediaRecorder(stream, { mimeType: mime });
      state.recorder.ondataavailable = e => { if (e.data.size > 0) state.chunks.push(e.data); };
      state.recorder.onstop = () => {
        const blob = new Blob(state.chunks, { type: mime });
        storeRec(blob, mime);
        stream.getTracks().forEach(t => t.stop());
      };

      state.recorder.start(100);
      state.isRec    = true;
      state.timerSec = 0;
      clearInterval(state.timerID);
      state.timerID = setInterval(() => {
        state.timerSec++;
        const el = document.getElementById('rec-timer');
        if (el) {
          const m = Math.floor(state.timerSec/60);
          const s = state.timerSec % 60;
          el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
        }
      }, 1000);

      updateRecButtons();
    } catch (_) {
      toast('Microphone access denied');
    }
  }

  function stopRec() {
    if (state.recorder && state.isRec) {
      state.recorder.stop();
      state.isRec = false;
      clearInterval(state.timerID);
      updateRecButtons();
    }
  }

  async function storeRec(blob, mime) {
    const qKey = getCurrentQKey();
    if (!qKey) return;
    const ext  = mime.includes('mp4')||mime.includes('m4a') ? 'm4a'
               : mime.includes('aac') ? 'aac' : 'webm';
    const fn   = `${state.iv.date}-${sanitize(state.iv.name)}-${qKey}.${ext}`;
    const key  = `${state.iv.id}__${qKey}`;

    await dbPut('recordings', {
      key, ivId: state.iv.id, qKey, filename: fn,
      blob, mimeType: mime,
      dur: state.timerSec, date: state.iv.date, name: state.iv.name
    });

    state.iv.recs[qKey] = { key, filename: fn, dur: state.timerSec };
    updateRecButtons();
    toast('Recording saved');
    saveDraft();
  }

  async function playCurrentRec() {
    const qKey = getCurrentQKey();
    const rec  = state.iv.recs[qKey];
    if (rec) playByKey(rec.key);
  }

  async function playByKey(key) {
    const rec = await dbGet('recordings', key);
    if (!rec) { toast('Recording not found'); return; }
    if (state.currentAudio) { state.currentAudio.pause(); state.currentAudio = null; }
    const url = URL.createObjectURL(rec.blob);
    const audio = new Audio(url);
    state.currentAudio = audio;
    audio.play().catch(() => toast('Could not play'));
    audio.onended = () => { URL.revokeObjectURL(url); state.currentAudio = null; };
    toast('Playing…');
  }

  function prevQ() {
    if (state.isRec) stopRec();
    if (state.qIndex > 0) { state.qIndex--; renderQuestion(); }
    else { go('prep'); renderPrep(); }
  }

  function nextQ() {
    if (state.isRec) stopRec();
    const total = getActiveQuestions().length;
    if (state.qIndex < total - 1) { state.qIndex++; renderQuestion(); }
    else renderComplete();
  }

  function backToQuestions() {
    go('question');
    renderQuestion();
  }

  function renderComplete() {
    const dir = state.lang.dir || 'ltr';
    const el  = document.getElementById('complete-text');
    const msg = state.lang.completed
      || 'That is all the questions I have. Thank you so very much.';
    if (el) {
      el.textContent = msg;
      el.className = 'consent-text' + (dir === 'rtl' ? ' rtl' : '');
    }
    go('complete');
  }

  function goShareConsent() {
    renderShareConsent();
  }

  // ─── SHARING CONSENT ─────────────────────────────────────────
  function renderShareConsent() {
    const dir = state.lang.dir || 'ltr';
    const el  = document.getElementById('sc-question');
    el.textContent = state.lang.sharing_question || 'Can I share this interview?';
    el.className   = 'consent-text' + (dir === 'rtl' ? ' rtl' : '');
    document.getElementById('sc-yes').textContent  = state.lang.sharing_yes       || 'Yes';
    document.getElementById('sc-anon').textContent = state.lang.sharing_anonymous || 'Yes, but keep me anonymous';
    document.getElementById('sc-no').textContent   = state.lang.sharing_no        || 'No';
    go('share-consent');
  }

  function setShareConsent(answer) {
    state.iv.sharingConsent = answer;
    state.iv.anonymous = (answer === 'anonymous');
    renderReview();
  }

  function backFromShareConsent() {
    const total = getActiveQuestions().length;
    state.qIndex = Math.max(0, total - 1);
    renderComplete();
  }

  // ─── REVIEW ──────────────────────────────────────────────────
  function renderReview() {
    const qs  = getActiveQuestions();
    const el  = document.getElementById('review-list');
    el.innerHTML = '';
    qs.forEach((q, i) => {
      const key    = `Q${q.index + 1}`;
      const hasRec = !!state.iv.recs[key];
      const item   = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML = `
        <div class="review-item-top">
          <span class="review-qnum">Question ${i+1}</span>
          <span class="${hasRec ? 'review-status-rec' : 'review-status-none'}">${hasRec ? '✓ Recorded' : '○ No recording'}</span>
        </div>
        <div class="review-qtext">${q.text}</div>`;
      el.appendChild(item);
    });
    go('review');
  }

  async function saveInterview() {
    state.iv.status = 'completed';
    const sharingLabel = {
      yes: 'Yes', anonymous: 'Yes — anonymous', no: 'No'
    }[state.iv.sharingConsent] || 'Not answered';
    const meta = {
      id: state.iv.id, date: state.iv.date,
      name: state.iv.name, age: state.iv.age,
      religion: state.iv.religion, location: state.iv.location,
      language: state.langCode, langLabel: state.lang.label,
      status: 'completed',
      sharingConsent: state.iv.sharingConsent || null,
      sharingLabel,
      anonymous: !!state.iv.anonymous,
      recCount: Object.keys(state.iv.recs).length,
      recs: state.iv.recs,
    };
    await dbPut('interviews', meta);
    localStorage.removeItem('wos_draft');
    toast('Interview saved!');
    setTimeout(() => go('saved-list'), 900);
  }

  // ─── DRAFT ───────────────────────────────────────────────────
  function saveDraft() {
    try {
      localStorage.setItem('wos_draft', JSON.stringify({
        iv: state.iv, qIndex: state.qIndex, langCode: state.langCode
      }));
    } catch (_) {}
  }

  function checkDraft() {
    try {
      const raw = localStorage.getItem('wos_draft');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d.iv?.id) return;
      setTimeout(() => {
        showSheet(`Resume interview with ${d.iv.name || 'Unknown'}?`, [
          { label: '▶ Resume',            fn: () => resumeDraft(d) },
          { label: 'Discard', cls: 'danger', fn: () => localStorage.removeItem('wos_draft') },
          { label: 'Cancel', cls: 'cancel',  fn: () => {} },
        ]);
      }, 600);
    } catch(_) {}
  }

  async function resumeDraft(d) {
    state.iv       = d.iv;
    state.langCode = d.langCode;
    state.lang     = state.languages[d.langCode] || Object.values(state.languages)[0];
    const active = getActiveQuestions();
    if (!active.length) {
      toast('Enable at least one question in Settings');
      go('settings');
      return;
    }
    state.qIndex = Math.min(d.qIndex, active.length - 1);
    go('question');
    renderQuestion();
  }

  // ─── SAVED LIST ──────────────────────────────────────────────
  async function renderSavedList() {
    const list = await dbAll('interviews');
    list.sort((a,b) => b.date.localeCompare(a.date));
    const el = document.getElementById('saved-list-content');
    if (!list.length) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No saved interviews</div><div class="empty-sub">Start a new interview to see it here</div></div>`;
      return;
    }
    el.innerHTML = '';
    list.forEach(iv => {
      const c = document.createElement('div');
      c.className = 'card';
      c.innerHTML = `
        <div class="card-name">${iv.name}${iv.anonymous ? ' <span class="chip" style="background:#FFF0F0;color:var(--rec)">Anonymous</span>' : ''}</div>
        <div class="card-meta">
          <span>${iv.date}</span>
          <span class="chip">${iv.langLabel || iv.language}</span>
          <span>${iv.recCount} rec${iv.recCount !== 1 ? 's' : ''}</span>
          ${iv.sharingConsent === 'no' ? '<span class="chip" style="background:#FFF8E0;color:#8a6200">No sharing</span>' : ''}
        </div>`;
      c.onclick = () => openDetail(iv.id);
      el.appendChild(c);
    });
  }

  // ─── DETAIL ──────────────────────────────────────────────────
  async function openDetail(id) {
    state.detailId = id;
    const iv = await dbGet('interviews', id);
    if (!iv) return;
    document.getElementById('detail-nav-title').textContent = iv.name;

    // Meta block
    document.getElementById('detail-meta').innerHTML = `
      <div class="meta-row"><span class="meta-key">Date</span><span class="meta-val">${iv.date}</span></div>
      <div class="meta-row"><span class="meta-key">Language</span><span class="meta-val">${iv.langLabel || iv.language}</span></div>
      <div class="meta-row"><span class="meta-key">Age</span><span class="meta-val">${iv.age || '—'}</span></div>
      <div class="meta-row"><span class="meta-key">Religion</span><span class="meta-val">${iv.religion || '—'}</span></div>
      <div class="meta-row"><span class="meta-key">Location</span><span class="meta-val">${iv.location || '—'}</span></div>
      <div class="meta-row"><span class="meta-key">Sharing consent</span><span class="meta-val" style="${iv.sharingConsent==='no'?'color:var(--rec)':iv.sharingConsent==='anonymous'?'color:var(--muted)':''}">${iv.sharingLabel || '—'}</span></div>
    `;

    // Recordings
    const recsEl = document.getElementById('detail-recs');
    recsEl.innerHTML = '';
    const lang = state.languages[iv.language] || {};

    const entries = Object.entries(iv.recs || {});
    entries.sort((a,b) => a[0].localeCompare(b[0]));

    entries.forEach(([qKey, rec]) => {
      const qNum = parseInt(qKey.replace('Q',''));
      const qText = (lang.questions || [])[qNum-1] || qKey;
      const row = document.createElement('div');
      row.className = 'rec-row';
      row.innerHTML = `
        <div class="rec-row-info">
          <div class="rec-row-name">${rec.filename}</div>
          <div class="rec-row-sub">${qText}</div>
        </div>
        <div class="rec-row-btns">
          <button class="icon-btn" onclick="App.playByKey('${rec.key}')">▶</button>
          <button class="icon-btn share" onclick="App.shareByKey('${rec.key}')">↑</button>
        </div>`;
      recsEl.appendChild(row);
    });

    if (!entries.length) {
      recsEl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--muted);font-size:15px">No recordings saved</div>`;
    }

    // Share all button
    const shareAllEl = document.getElementById('detail-share-all');
    shareAllEl.innerHTML = '';
    if (entries.length > 1) {
      shareAllEl.innerHTML = `<div style="margin-top:16px"><button class="btn btn-ghost" onclick="App.shareAll('${id}')">↑ &nbsp;Share All Recordings</button></div>`;
    }

    go('detail');
  }

  function promptDeleteInterview() {
    showSheet('Delete this interview?', [
      { label: 'Delete Interview & Recordings', cls: 'danger', fn: () => deleteInterview(state.detailId) },
      { label: 'Cancel', cls: 'cancel', fn: () => {} },
    ]);
  }

  async function deleteInterview(id) {
    await dbDel('interviews', id);
    const recs = await dbIndex('recordings', 'ivId', id);
    for (const r of recs) await dbDel('recordings', r.key);
    toast('Deleted');
    go('saved-list');
  }

  // ─── AUDIO FILES ─────────────────────────────────────────────
  async function renderAudioFiles() {
    const recs = await dbAll('recordings');
    recs.sort((a,b) => (b.date||'').localeCompare(a.date||''));
    const el = document.getElementById('af-content');
    if (!recs.length) {
      el.innerHTML = `<div class="empty"><div class="empty-icon">🎙</div><div class="empty-title">No audio files yet</div><div class="empty-sub">Record answers during interviews</div></div>`;
      return;
    }
    el.innerHTML = '';
    recs.forEach(r => {
      const dur = r.dur ? `${Math.floor(r.dur/60)}:${(r.dur%60).toString().padStart(2,'0')}` : '';
      const row = document.createElement('div');
      row.className = 'af-row';
      row.innerHTML = `
        <div class="af-info">
          <div class="af-name">${r.filename}</div>
          <div class="af-meta">${r.name} · ${r.date}${dur?' · '+dur:''}</div>
        </div>
        <div class="af-btns">
          <button class="icon-btn" onclick="App.playByKey('${r.key}')">▶</button>
          <button class="icon-btn share" onclick="App.shareByKey('${r.key}')">↑</button>
          <button class="icon-btn del"   onclick="App.promptDeleteRec('${r.key}')">🗑</button>
        </div>`;
      el.appendChild(row);
    });
  }

  function promptDeleteRec(key) {
    showSheet('Delete this recording?', [
      { label: 'Delete', cls: 'danger', fn: async () => {
        await dbDel('recordings', key);
        toast('Deleted');
        renderAudioFiles();
      }},
      { label: 'Cancel', cls: 'cancel', fn: () => {} },
    ]);
  }

  // ─── SHARE / EXPORT ──────────────────────────────────────────
  async function shareByKey(key) {
    const rec = await dbGet('recordings', key);
    if (!rec) { toast('Not found'); return; }
    const file = new File([rec.blob], rec.filename, { type: rec.mimeType });
    await shareFiles([file], rec.filename);
  }

  async function shareAll(ivId) {
    const recs = await dbIndex('recordings', 'ivId', ivId);
    if (!recs.length) { toast('No recordings'); return; }
    const files = recs.map(r => new File([r.blob], r.filename, { type: r.mimeType }));
    await shareFiles(files, `Interview recordings`);
  }

  async function shareFiles(files, title) {
    if (navigator.share && navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files, title });
      } catch(e) {
        if (e.name !== 'AbortError') toast('Could not open share sheet');
      }
      return;
    }
    // Share API not available (non-iOS browser) — show instructions
    toast('Open in Safari on iPhone to share files');
  }

  // ─── SETTINGS ────────────────────────────────────────────────
  async function renderSettings() {
    const ivs  = await dbAll('interviews');
    const recs = await dbAll('recordings');
    document.getElementById('stat-iv').textContent  = ivs.length;
    document.getElementById('stat-rec').textContent = recs.length;
    renderQuestionSettings();
  }

  function renderQuestionSettings() {
    const wrap = document.getElementById('settings-questions');
    if (!wrap) return;
    const { code, lang } = getSettingsLang();
    const qs = lang.questions || [];
    const prefs = ensureQuestionPrefs(code, qs.length);
    const enabledCount = prefs.filter(Boolean).length;

    const langLabel = document.getElementById('questions-lang-label');
    const countLabel = document.getElementById('questions-enabled-count');
    if (langLabel) langLabel.textContent = lang.label || code;
    if (countLabel) countLabel.textContent = `${enabledCount} / ${qs.length}`;

    wrap.innerHTML = '';
    if (!qs.length) {
      wrap.innerHTML = `<div class="settings-val" style="padding:8px 0">No questions configured.</div>`;
      return;
    }
    qs.forEach((q, i) => {
      const row = document.createElement('div');
      row.className = 'settings-row settings-question';
      const text = document.createElement('span');
      text.className = 'settings-q-text';
      text.textContent = q;
      const toggle = document.createElement('button');
      toggle.className = `toggle ${prefs[i] ? 'on' : ''}`;
      toggle.onclick = () => toggleQuestion(i, code);
      row.appendChild(text);
      row.appendChild(toggle);
      wrap.appendChild(row);
    });
  }

  function toggleQuestion(index, langCode) {
    const lang = state.languages[langCode] || {};
    const qs = lang.questions || [];
    const prefs = ensureQuestionPrefs(langCode, qs.length);
    prefs[index] = !prefs[index];
    state.questionPrefs[langCode] = prefs;
    saveQuestionPrefs();
    renderQuestionSettings();
  }

  function toggleDark() {
    state.dark = !state.dark;
    document.body.classList.toggle('dark', state.dark);
    document.getElementById('dark-toggle').classList.toggle('on', state.dark);
    localStorage.setItem('darkMode', state.dark ? '1' : '0');
  }

  function promptClearAll() {
    showSheet('This will delete everything permanently.', [
      { label: 'Delete All Data', cls: 'danger', fn: async () => {
        await new Promise(r => { const req = indexedDB.deleteDatabase('wos_db'); req.onsuccess = req.onerror = r; });
        localStorage.clear();
        toast('All data cleared');
        setTimeout(() => location.reload(), 1000);
      }},
      { label: 'Cancel', cls: 'cancel', fn: () => {} },
    ]);
  }

  // ─── SHEET ───────────────────────────────────────────────────
  function showSheet(title, btns) {
    document.getElementById('sheet-title').textContent = title;
    const el = document.getElementById('sheet-btns');
    el.innerHTML = '';
    btns.forEach(b => {
      const btn = document.createElement('button');
      btn.className = `sheet-btn ${b.cls || 'bold'}`;
      btn.textContent = b.label;
      btn.onclick = () => { hideSheet(); b.fn(); };
      el.appendChild(btn);
    });
    document.getElementById('overlay').classList.add('show');
  }
  function hideSheet() { document.getElementById('overlay').classList.remove('show'); }

  // ─── TOAST ───────────────────────────────────────────────────
  let _toastT;
  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(_toastT);
    _toastT = setTimeout(() => el.classList.remove('show'), 2400);
  }

  // ─── HELPERS ─────────────────────────────────────────────────
  function sanitize(name) {
    return (name || 'Unknown')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9\-]/g, '')
      .substring(0, 28) || 'Unknown';
  }

  // ─── RESIZE ──────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    if (document.getElementById('s-question').classList.contains('active')) fitText();
  });

  // ─── BOOT ────────────────────────────────────────────────────
  init();

  // Public API
  return {
    go, startNew, goConsent, consentYes,
    beginInterview, renderPrep, startQuestions, renderQuestion,
    toggleRecord, playCurrentRec,
    prevQ, nextQ, backToQuestions,
    backFromShareConsent, setShareConsent, goShareConsent,
    saveInterview,
    openDetail, promptDeleteInterview,
    playByKey, shareByKey, shareAll,
    promptDeleteRec,
    toggleDark, promptClearAll,
    hideSheet,
    fitText,
  };

})();

window.App = App;
