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

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

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
    document.getElementById('info-header').textContent = f.sectionTitle || 'About You';
    document.getElementById('info-form').innerHTML = `
      <div class="settings-group-label" style="margin-bottom:16px">${f.sectionTitle || 'About You'}</div>
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

    const now = new Date();
    state.iv.date = now.toISOString().slice(0,10);
    state.iv.id   = `${state.iv.date}-${sanitize(state.iv.name)}-${Date.now()}`;

    state.qIndex = 0;
    go('question');
    renderQuestion();
  }

  // ─── QUESTION SCREEN ─────────────────────────────────────────
  function renderQuestion() {
    const qs    = state.lang.questions;
    const i     = state.qIndex;
    const total = qs.length;

    document.getElementById('q-counter').textContent = `Q ${i+1} / ${total}`;
    document.getElementById('q-lang-tag').textContent = state.lang.label;
    document.getElementById('next-label').textContent = i === total-1 ? 'Finish' : 'Next';

    // Dots
    const dotsEl = document.getElementById('q-dots');
    dotsEl.innerHTML = '';
    qs.forEach((_, di) => {
      const d = document.createElement('div');
      d.className = 'q-dot';
      if (di === i) d.classList.add('active');
      else if (state.iv.recs[`Q${di+1}`]) d.classList.add('recorded');
      dotsEl.appendChild(d);
    });

    // Question text
    const textEl = document.getElementById('q-text');
    textEl.textContent = qs[i];
    textEl.className   = 'q-text' + (state.lang.dir === 'rtl' ? ' rtl' : '');

    requestAnimationFrame(fitText);
    updateRecButtons();
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

  function updateRecButtons() {
    const qKey   = `Q${state.qIndex+1}`;
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
    const qKey = `Q${state.qIndex+1}`;
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
    const qKey = `Q${state.qIndex+1}`;
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
    const qKey = `Q${state.qIndex+1}`;
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
    else go('info');
  }

  function nextQ() {
    if (state.isRec) stopRec();
    const total = state.lang.questions.length;
    if (state.qIndex < total - 1) { state.qIndex++; renderQuestion(); }
    else renderShareConsent();
  }

  function backToQuestions() {
    go('question');
    renderQuestion();
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
    // Go back to last question
    state.qIndex = state.lang.questions.length - 1;
    go('question');
    renderQuestion();
  }

  // ─── REVIEW ──────────────────────────────────────────────────
  function renderReview() {
    const qs  = state.lang.questions;
    const el  = document.getElementById('review-list');
    el.innerHTML = '';
    qs.forEach((q, i) => {
      const key    = `Q${i+1}`;
      const hasRec = !!state.iv.recs[key];
      const item   = document.createElement('div');
      item.className = 'review-item';
      item.innerHTML = `
        <div class="review-item-top">
          <span class="review-qnum">Question ${i+1}</span>
          <span class="${hasRec ? 'review-status-rec' : 'review-status-none'}">${hasRec ? '✓ Recorded' : '○ No recording'}</span>
        </div>
        <div class="review-qtext">${q}</div>`;
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
    state.qIndex   = d.qIndex;
    state.langCode = d.langCode;
    state.lang     = state.languages[d.langCode] || Object.values(state.languages)[0];
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

  // ─── FALLBACK LANGUAGES (inline) ─────────────────────────────
  const FALLBACK_LANGS = {
    en: {
      label:'English', nativeLabel:'English', dir:'ltr',
      intro:'May I record an interview with you for a project about people and their stories?',
      consent_yes:'✓  Yes, I agree', consent_no:'✗  No thanks',
      sharing_question:'Can I share this interview?', sharing_yes:'Yes', sharing_anonymous:'Yes, but keep me anonymous', sharing_no:'No',
      fields:{ sectionTitle:'About You', name:'Name', age:'Age', religion:'Religion', location:'Location' },
      questions:['Who are you?','What is your story?','What is the best part of your life?','What is the hardest part of your life?','What do you hope for?']
    },
    es: {
      label:'Spanish', nativeLabel:'Español', dir:'ltr',
      intro:'¿Puedo grabarte una entrevista para un proyecto sobre personas y sus historias?',
      consent_yes:'✓  Sí, acepto', consent_no:'✗  No, gracias',
      sharing_question:'¿Puedo compartir esta entrevista?', sharing_yes:'Sí', sharing_anonymous:'Sí, pero de forma anónima', sharing_no:'No',
      fields:{ sectionTitle:'Sobre Ti', name:'Nombre', age:'Edad', religion:'Religión', location:'Lugar' },
      questions:['¿Quién eres?','¿Cuál es tu historia?','¿Cuál es la mejor parte de tu vida?','¿Cuál es la parte más difícil de tu vida?','¿Qué esperas para el futuro?']
    },
    ar: {
      label:'Arabic', nativeLabel:'العربية', dir:'rtl',
      intro:'هل يمكنني تسجيل مقابلة معك لمشروع عن الناس وقصصهم؟',
      consent_yes:'✓  نعم، أوافق', consent_no:'✗  لا، شكراً',
      sharing_question:'هل يمكنني مشاركة هذه المقابلة؟', sharing_yes:'نعم', sharing_anonymous:'نعم، لكن بشكل مجهول', sharing_no:'لا',
      fields:{ sectionTitle:'عنك', name:'الاسم', age:'العمر', religion:'الدين', location:'المكان' },
      questions:['من أنت؟','ما هي قصتك؟','ما هو أفضل جزء في حياتك؟','ما هو أصعب جزء في حياتك؟','بماذا تأمل في المستقبل؟']
    },
    fr: {
      label:'French', nativeLabel:'Français', dir:'ltr',
      intro:'Puis-je enregistrer un entretien avec vous pour un projet sur les gens et leurs histoires?',
      consent_yes:"✓  Oui, j'accepte", consent_no:'✗  Non, merci',
      sharing_question:'Puis-je partager cette interview?', sharing_yes:'Oui', sharing_anonymous:'Oui, mais de façon anonyme', sharing_no:'Non',
      fields:{ sectionTitle:'À Votre Sujet', name:'Nom', age:'Âge', religion:'Religion', location:'Lieu' },
      questions:['Qui êtes-vous?','Quelle est votre histoire?','Quelle est la meilleure partie de votre vie?','Quelle est la partie la plus difficile de votre vie?',"Qu'espérez-vous pour l'avenir?"]
    },
    id: {
      label:'Indonesian', nativeLabel:'Bahasa Indonesia', dir:'ltr',
      intro:'Bolehkah saya merekam wawancara dengan Anda untuk proyek tentang orang-orang dan kisah mereka?',
      consent_yes:'✓  Ya, saya setuju', consent_no:'✗  Tidak, terima kasih',
      sharing_question:'Bolehkah saya membagikan wawancara ini?', sharing_yes:'Ya', sharing_anonymous:'Ya, tapi anonim saja', sharing_no:'Tidak',
      fields:{ sectionTitle:'Tentang Anda', name:'Nama', age:'Usia', religion:'Agama', location:'Lokasi' },
      questions:['Siapa Anda?','Apa kisah Anda?','Apa bagian terbaik dari hidup Anda?','Apa bagian terberat dari hidup Anda?','Apa harapan Anda?']
    },
    ban: {
      label:'Balinese', nativeLabel:'Basa Bali', dir:'ltr',
      intro:'Dados titiang ngrekam wawancara sareng ragane, antuk proyek indik jadma lan satua-satuannyane?',
      consent_yes:'✓  Inggih, titiang setuju', consent_no:'✗  Nenten, suksma',
      sharing_question:'Dados titiang ngwedar wawancara puniki?', sharing_yes:'Inggih', sharing_anonymous:'Inggih, nanging tanpa adan', sharing_no:'Nenten',
      fields:{ sectionTitle:'Indik Ragane', name:'Adan ragane', age:'Umur ragane', religion:'Agama ragane', location:'Genah ragane' },
      questions:['Sira ragane?','Napi satua urip ragane?','Napi sane becik pisan ring urip ragane?','Napi sane paling berat ring urip ragane?','Napi pangaptin ragane?']
    },
  };

  // ─── BOOT ────────────────────────────────────────────────────
  init();

  // Public API
  return {
    go, startNew, goConsent, consentYes,
    beginInterview, renderQuestion,
    toggleRecord, playCurrentRec,
    prevQ, nextQ, backToQuestions,
    backFromShareConsent, setShareConsent,
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
