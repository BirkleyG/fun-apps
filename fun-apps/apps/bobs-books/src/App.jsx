import React, { useState, useEffect, useRef } from "react";
import {
  BookOpenText,
  Books,
  ChartLineUp,
  CheckCircle,
  GearSix,
  MagnifyingGlass,
  Palette,
  PencilSimple,
  Plus,
  SignOut,
  SlidersHorizontal,
  Tag as TagIcon,
  Target,
  Trash,
  X,
} from "@phosphor-icons/react";
import { getRedirectResult, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, provider } from "./firebase";

const genId = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

// --- Colors ------------------------------------------------------------------
const C = {
  bg:"#f6efe2", surface:"#fff9ef", card:"#fffaf2", cardHover:"#f0e4d1",
  accent:"#315f43", accentLight:"#6f9f78", accentDim:"rgba(49,95,67,0.12)",
  text:"#2b251b", muted:"#756a58", border:"#ded0bb", borderLight:"#cdbfa8",
  red:"#a85648", green:"#315f43", blue:"#4d7b84",
  shelfWood:"linear-gradient(180deg,#b88953 0%,#8c5d2f 58%,#70451e 100%)",
  shelfPlank:"linear-gradient(180deg,#c79a62 0%,#9f6d3c 42%,#765028 100%)",
};

// --- Genre & Tag Defaults -----------------------------------------------------
const DEFAULT_GENRES = [
  { name:"Fantasy",         color:"#5e3a8a", font:"'Newsreader Variable',serif" },
  { name:"Science Fiction", color:"#1a5f80", font:"'Plus Jakarta Sans Variable',sans-serif" },
  { name:"Horror",          color:"#7a1a2a", font:"'Newsreader Variable',serif" },
  { name:"Mystery",         color:"#2d3454", font:"'Newsreader Variable',serif" },
  { name:"Romance",         color:"#8a3560", font:"'Newsreader Variable',serif" },
  { name:"Historical",      color:"#6b4e1a", font:"'Newsreader Variable',serif" },
  { name:"Thriller",        color:"#3a2010", font:"'Plus Jakarta Sans Variable',sans-serif" },
  { name:"Literary",        color:"#2a4a4a", font:"'Newsreader Variable',serif" },
  { name:"Non-fiction",     color:"#1e4a2a", font:"'Newsreader Variable',serif" },
  { name:"Biography",       color:"#4a3520", font:"'Newsreader Variable',serif" },
  { name:"Self-Help",       color:"#2a5040", font:"'Plus Jakarta Sans Variable',sans-serif" },
  { name:"Young Adult",     color:"#3a2a6a", font:"'Plus Jakarta Sans Variable',sans-serif" },
  { name:"Children's",      color:"#7a3a10", font:"'Newsreader Variable',serif" },
  { name:"Poetry",          color:"#5a2a5a", font:"'Newsreader Variable',serif" },
  { name:"Graphic Novel",   color:"#1a3a6a", font:"'Plus Jakarta Sans Variable',sans-serif" },
];
const DEFAULT_TAGS = ["favorite","re-read","borrowed","gift","audiobook-only","DNF","classics","page-turner","slow-burn","recommended"];
const DEFAULT_GOAL_STATS = {
  showCoreMetrics:true, showRateStats:true, showProjections:true,
  showTimePatterns:true, showBookBreakdown:true, showMotivation:true,
};

const APP_DOC_ID = "bobs-books";
const getAppDocRef = (uid) => doc(db, "users", uid, "apps", APP_DOC_ID);
const getLegacyAppDocRefs = (uid) => [
  doc(db, "users", uid, "apps", "bobsBooks"),
  doc(db, "users", uid, "bobs-books", "data"),
  doc(db, "users", uid, "bobsBooks", "data"),
  doc(db, "bobs-books", uid),
  doc(db, "bobsBooks", uid),
];
const getCacheKey = (uid) => `bobs-books-cache-${uid}`;

function loadLocalCache(uid) {
  try {
    const raw = localStorage.getItem(getCacheKey(uid));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveLocalCache(uid, payload) {
  try {
    localStorage.setItem(getCacheKey(uid), JSON.stringify({ ...payload, cachedAt: new Date().toISOString() }));
  } catch {}
}

function formatAuthError(error) {
  const code = error?.code || "";
  if (code === "auth/unauthorized-domain") {
    return "This domain is not allowed in Firebase Auth yet. Add the demo domain in Firebase Authentication, then try again.";
  }
  if (code === "auth/popup-blocked") {
    return "Your browser blocked the Google window. I will try the full-page sign-in flow instead.";
  }
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Google sign-in was closed before it finished.";
  }
  if (code === "auth/network-request-failed") {
    return "Google sign-in could not reach Firebase. Check the connection and try again.";
  }
  return "Google sign-in could not start. Please try again.";
}

function shouldTryRedirectSignIn(error) {
  return [
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ].includes(error?.code);
}

async function loadAppData(uid) {
  const refs = [getAppDocRef(uid), ...getLegacyAppDocRefs(uid)];
  for (const ref of refs) {
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) continue;
    const normalized = normalizeAppData(snapshot.data());
    if (normalized) return normalized;
  }
  return null;
}

async function saveAppData(uid, payload) {
  await setDoc(
    getAppDocRef(uid),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
const STAT_LABELS = {
  showCoreMetrics:"Core Metrics (Wheel + Health)", showRateStats:"Rate & Session Cards",
  showProjections:"Projections & Forecast", showTimePatterns:"Time Patterns & Streaks",
  showBookBreakdown:"Book Breakdown", showMotivation:"Highlights & Records",
};
function normalizeAppData(data) {
  const source = data?.books || data?.sessions || data?.goals ? data : data?.state || data?.library || data?.data;
  if (!source || typeof source !== "object") return null;
  return {
    books: Array.isArray(source.books) ? source.books.map(normalizeBookRecord) : [],
    sessions: Array.isArray(source.sessions) ? source.sessions : [],
    goals: Array.isArray(source.goals) ? source.goals : [],
    settings: source.settings && typeof source.settings === "object" ? source.settings : null,
  };
}

const DEFAULT_BOOK_ICON = "open-book";
const BOOK_ICONS = [
  { id:"open-book", label:"Open book", tone:"#315f43" },
  { id:"stack", label:"Stack", tone:"#7a5a35" },
  { id:"bookmark", label:"Bookmark", tone:"#9f5b4a" },
  { id:"moon", label:"Moon", tone:"#536878" },
  { id:"spark", label:"Spark", tone:"#b88953" },
  { id:"map", label:"Map", tone:"#4d7b84" },
  { id:"castle", label:"Castle", tone:"#6d5c8d" },
  { id:"planet", label:"Planet", tone:"#3f7280" },
  { id:"leaf", label:"Leaf", tone:"#567d4d" },
  { id:"heart", label:"Heart", tone:"#a85665" },
  { id:"key", label:"Key", tone:"#8c6a31" },
  { id:"lamp", label:"Lamp", tone:"#b1783f" },
  { id:"wave", label:"Wave", tone:"#3d758a" },
  { id:"crown", label:"Crown", tone:"#9a7435" },
  { id:"flask", label:"Flask", tone:"#5f7b76" },
  { id:"compass", label:"Compass", tone:"#6c7041" },
];
const BOOK_ICON_IDS = new Set(BOOK_ICONS.map(icon => icon.id));

function normalizeIconId(value) {
  if (BOOK_ICON_IDS.has(value)) return value;
  return DEFAULT_BOOK_ICON;
}

function normalizeBookRecord(book) {
  if (!book || typeof book !== "object") return book;
  return { ...book, icon: normalizeIconId(book.icon || book.emoji) };
}

function getBookIconId(book) {
  return normalizeIconId(book?.icon || book?.emoji);
}

function BookMarkIcon({id,size=34}) {
  const icon = BOOK_ICONS.find(item => item.id === normalizeIconId(id)) || BOOK_ICONS[0];
  const common = { fill:"none", stroke:"currentColor", strokeWidth:"1.8", strokeLinecap:"round", strokeLinejoin:"round" };
  const shapes = {
    "open-book": <><path {...common} d="M7 9.5c4.2-.7 7.2.1 9 2.4 1.8-2.3 4.8-3.1 9-2.4v16.2c-4.2-.7-7.2.1-9 2.4-1.8-2.3-4.8-3.1-9-2.4V9.5Z"/><path {...common} d="M16 11.9v16.2"/></>,
    stack: <><path {...common} d="M9 10.5h15a2 2 0 0 1 2 2v2H11a2 2 0 0 1-2-2v-2Z"/><path {...common} d="M7 15h16a2 2 0 0 1 2 2v2H9a2 2 0 0 1-2-2v-2Z"/><path {...common} d="M10 19.5h15v4H10a2 2 0 0 1 0-4Z"/></>,
    bookmark: <><path {...common} d="M10 7.5h12a2 2 0 0 1 2 2v17l-8-4.5-8 4.5v-17a2 2 0 0 1 2-2Z"/><path {...common} d="M13 12h6"/></>,
    moon: <><path {...common} d="M22.5 24.5A10.5 10.5 0 0 1 11.5 8a12 12 0 1 0 11 16.5Z"/><path {...common} d="M20 8.5v4M18 10.5h4"/></>,
    spark: <><path {...common} d="M16 5.5l2.8 7.7 7.7 2.8-7.7 2.8-2.8 7.7-2.8-7.7-7.7-2.8 7.7-2.8L16 5.5Z"/><path {...common} d="M25 6.5v4M23 8.5h4"/></>,
    map: <><path {...common} d="M8 9.5l6-2.5 6 2.5 5-2v17l-5 2-6-2.5-6 2.5-1-.5v-17l1 .5Z"/><path {...common} d="M14 7v17M20 9.5v17"/></>,
    castle: <><path {...common} d="M8 27V11l3 2 3-2 3 2 3-2 3 2 3-2v16"/><path {...common} d="M6 27h22"/><path {...common} d="M13 27v-6a3 3 0 0 1 6 0v6"/><path {...common} d="M10 16h4M20 16h4"/></>,
    planet: <><circle {...common} cx="16" cy="16" r="7"/><path {...common} d="M5.5 20c3 2.4 9.1 1.8 15.1-1.5s9.7-7.7 8.2-10.4c-.8-1.4-3-1.8-5.8-1.2"/><path {...common} d="M26.5 12c-2.8-2.2-8.4-1.8-14 1.2-6.1 3.3-9.8 7.9-8.3 10.6.8 1.5 3.3 1.8 6.3.9"/></>,
    leaf: <><path {...common} d="M25.5 7.5C15 7.7 8.5 12.7 8.5 20a5.5 5.5 0 0 0 5.5 5.5c7.2 0 11.4-7.1 11.5-18Z"/><path {...common} d="M21 12c-4.8 2.2-8 5.8-10 10.5"/></>,
    heart: <><path {...common} d="M16 26s-9-5.4-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.6-9 12-9 12Z"/></>,
    key: <><circle {...common} cx="11" cy="16" r="4.5"/><path {...common} d="M15.5 16H27l-2 2 2 2-2 2"/></>,
    lamp: <><path {...common} d="M12 7h8l3 10H9l3-10Z"/><path {...common} d="M16 17v10M11 27h10M16 4v3"/></>,
    wave: <><path {...common} d="M5 20c3.6-5.2 7.2-5.2 10.8 0 3.6 5.2 7.2 5.2 10.8 0"/><path {...common} d="M5 14c3.6-5.2 7.2-5.2 10.8 0 3.6 5.2 7.2 5.2 10.8 0"/></>,
    crown: <><path {...common} d="M7 24h18l1-12-6 5-4-8-4 8-6-5 1 12Z"/><path {...common} d="M9 27h14"/></>,
    flask: <><path {...common} d="M13 6h6M15 6v7l-6.5 11A2 2 0 0 0 10.2 27h11.6a2 2 0 0 0 1.7-3L17 13V6"/><path {...common} d="M11 22h10"/></>,
    compass: <><circle {...common} cx="16" cy="16" r="10"/><path {...common} d="M20.5 11.5l-2.2 6.8-6.8 2.2 2.2-6.8 6.8-2.2Z"/></>,
  };
  return (
    <span className="bb-custom-icon" style={{"--book-icon-tone":icon.tone,width:size,height:size}} title={icon.label}>
      <svg viewBox="0 0 32 32" aria-hidden="true">{shapes[icon.id] || shapes[DEFAULT_BOOK_ICON]}</svg>
    </span>
  );
}

// --- Color Helpers ------------------------------------------------------------
function hexToRgb(hex) {
  const h = hex.replace("#","");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgbToHex(r,g,b) {
  return "#"+[r,g,b].map(v=>Math.min(255,Math.max(0,Math.round(v))).toString(16).padStart(2,"0")).join("");
}
function getSpineColor(genreName, genres, bookId) {
  const g = genres.find(x=>x.name===genreName);
  const base = g?.color || "#4a3728";
  const [r,bv,bl] = hexToRgb(base);
  const seed = bookId ? (bookId.charCodeAt(0)*7+(bookId.charCodeAt(1)||0)*13)%40-20 : 0;
  return rgbToHex(r+seed, bv+Math.round(seed*0.7), bl+Math.round(seed*0.5));
}
function getGenreFont(genreName, genres) {
  return genres.find(g=>g.name===genreName)?.font || "'Newsreader Variable',serif";
}
function needsDarkText(hex) {
  const [r,g,b] = hexToRgb(hex);
  return (0.299*r+0.587*g+0.114*b)/255 > 0.42;
}

// --- Sound --------------------------------------------------------------------
function playFanfare() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [[523.25,0,.22],[659.25,.2,.22],[783.99,.4,.22],[1046.5,.6,.55]].forEach(([freq,start,dur])=>{
      const osc=ctx.createOscillator(), gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type="sawtooth"; osc.frequency.value=freq;
      const t=ctx.currentTime+start;
      gain.gain.setValueAtTime(0,t);
      gain.gain.linearRampToValueAtTime(0.2,t+0.025);
      gain.gain.setValueAtTime(0.2,t+dur-0.04);
      gain.gain.linearRampToValueAtTime(0,t+dur);
      osc.start(t); osc.stop(t+dur+0.05);
    });
  } catch(e){}
}

// --- Core Computed ------------------------------------------------------------
function getBookProgress(book,sessions){
  const total=book.format==="paged"?(book.totalPages||0):(book.totalMinutes||0);
  const bs=sessions.filter(s=>s.bookId===book.id);
  const current=bs.length?Math.max(...bs.map(s=>s.endValue||0)):0;
  return{current,total,percent:total>0?Math.min(100,Math.round((current/total)*100)):0};
}
function getBookStatus(book,sessions){
  const bs=sessions.filter(s=>s.bookId===book.id);
  if(!bs.length)return"want";
  const{current,total}=getBookProgress(book,sessions);
  if(total>0&&current>=total)return"finished";
  return"reading";
}
function getBookDates(book,sessions){
  const bs=sessions.filter(s=>s.bookId===book.id).sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(!bs.length)return{};
  const{current,total}=getBookProgress(book,sessions);
  return{startedAt:bs[0].date,lastSessionAt:bs[bs.length-1].date,finishedAt:total>0&&current>=total?bs[bs.length-1].date:null};
}
function getSessionDelta(session,sessions,books){
  const book=books.find(b=>b.id===session.bookId);
  if(!book)return 0;
  const prev=sessions.filter(s=>s.bookId===session.bookId&&s.id!==session.id&&new Date(s.date)<=new Date(session.date)).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const prevMax=prev.length?Math.max(...prev.map(s=>s.endValue||0)):0;
  return Math.max(0,(session.endValue||0)-prevMax);
}
function sessionPageEquiv(session,sessions,books,ppm){
  const book=books.find(b=>b.id===session.bookId);
  if(!book)return 0;
  const delta=getSessionDelta(session,sessions,books);
  return book.format==="paged"?delta:Math.round(delta*ppm);
}
function getBookProjection(book,sessions,settings){
  const bs=sessions.filter(s=>s.bookId===book.id).sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(bs.length<2)return null;
  const win=settings.projectionWindow*86400000,now=Date.now();
  const rec=bs.filter(s=>now-new Date(s.date).getTime()<win);
  if(rec.length<2)return null;
  const days=Math.max(1,(new Date(rec[rec.length-1].date)-new Date(rec[0].date))/86400000);
  const rate=((rec[rec.length-1].endValue||0)-(rec[0].endValue||0))/days;
  if(rate<=0)return null;
  const{current,total}=getBookProgress(book,sessions);
  const finishDate=new Date(now+(total-current)/rate*86400000);
  return{finishDate:finishDate.toISOString().slice(0,10),ratePerDay:Math.round(rate)};
}
function formatMinutes(m){if(!m&&m!==0)return"-";const h=Math.floor(m/60);return h>0?`${h}h ${m%60}m`:`${m}m`;}

// --- Librarian Says -----------------------------------------------------------
function librarianSays(aheadBy, consistencyScore, goalId) {
  const seed = goalId ? goalId.charCodeAt(0) % 4 : 0;
  if (aheadBy >= 0.1) {
    return [
      "Librarian Says: \"Outstanding. The shelves bow before you.\"",
      "Librarian Says: \"You are a reading deity. Please don't replace me.\"",
      "Librarian Says: \"I've never been so proud and so redundant simultaneously.\"",
      "Librarian Says: \"A true scholar. The Dewey Decimal System weeps with joy.\"",
    ][seed];
  }
  if (aheadBy >= -0.05) {
    return [
      "Librarian Says: \"Hmm. Technically on track. Don't get complacent.\"",
      "Librarian Says: \"You're like a bookmark, technically still in the game.\"",
      "Librarian Says: \"Not bad. Not great. Solidly bookish.\"",
      "Librarian Says: \"The shelves are cautiously optimistic about you.\"",
    ][seed];
  }
  if (aheadBy >= -0.2) {
    return [
      "Librarian Says: \"The shelves are judging you. They're very disappointed.\"",
      "Librarian Says: \"I've seen dust bunnies with better reading habits.\"",
      "Librarian Says: \"Your bookmark hasn't moved. I filed a missing persons report.\"",
      "Librarian Says: \"The books are starting to feel rejected. Read them.\"",
    ][seed];
  }
  return [
    "Librarian Says: \"THIS IS REALLY BAD. I'm calling the reading police.\"",
    "Librarian Says: \"Have you considered... just watching TV instead?\"",
    "Librarian Says: \"I've seen faster progress in a book about watching paint dry.\"",
    "Librarian Says: \"Sir, this is a library. Not a storage facility for unread books.\"",
  ][seed];
}

// --- Shared UI ----------------------------------------------------------------
function ProgressBar({percent,h=4}){
  return <div className="bb-progress-track" style={{height:h}}><div className="bb-progress-fill" style={{width:`${percent}%`,background:percent>=100?C.green:C.accent}}/></div>;
}
function Modal({onClose,children,wide,full}){
  return(
    <div className={`bb-modal-backdrop ${full?"bb-modal-backdrop-full":""}`} onClick={onClose}>
      <div className={`bb-modal-panel ${wide?"bb-modal-wide":""} ${full?"bb-modal-full":""}`} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
function ModalTitle({children}){return<h2 className="bb-modal-title">{children}</h2>;}
function Field({label,children}){return<div className="bb-field"><label>{label}</label>{children}</div>;}
function Input({style,className="",...props}){return<input className={`bb-control ${className}`} style={style}{...props}/>;}
function Textarea({style,className="",...props}){return<textarea className={`bb-control bb-textarea ${className}`} style={style}{...props}/>;}
function Btn({variant="primary",onClick,children,style,icon:Icon,type="button",className="",disabled=false}){
  return(
    <button type={type} onClick={onClick} disabled={disabled} className={`bb-btn bb-btn-${variant} ${className}`} style={style}>
      {Icon&&<Icon size={16} weight="duotone" aria-hidden="true"/>}
      <span>{children}</span>
    </button>
  );
}
function Tag({children}){return<span className="bb-tag">{children}</span>;}
function FlipCard({front,back,height=104}){
  const[f,setF]=useState(false);
  return(
    <div onClick={()=>setF(x=>!x)} style={{perspective:900,cursor:"pointer",height,position:"relative"}} title="Click to flip">
      <div style={{transition:"transform .42s cubic-bezier(.4,0,.2,1)",transformStyle:"preserve-3d",transform:f?"rotateY(180deg)":"rotateY(0)",width:"100%",height:"100%",position:"relative"}}>
        <div style={{backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",position:"absolute",inset:0,background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:14}}>
          {front}
        </div>
        <div style={{backfaceVisibility:"hidden",WebkitBackfaceVisibility:"hidden",transform:"rotateY(180deg)",position:"absolute",inset:0,background:C.cardHover,border:`1px solid ${C.accentDim}`,borderRadius:6,padding:14}}>
          {back}
        </div>
      </div>
    </div>
  );
}
function StatCard({label,value,sub,color}){
  return(
    <div className="bb-stat-card">
      <div className="bb-stat-label">{label}</div>
      <div className="bb-stat-value" style={{color:color||C.accent}}>{value??"-"}</div>
      {sub&&<div className="bb-stat-sub">{sub}</div>}
    </div>
  );
}
function SectionHead({children}){return<div className="bb-section-head">{children}</div>;}
function StarPicker({value,onChange,size=26}){
  const[hover,setHover]=useState(0);
  return(
    <div style={{display:"flex",gap:4}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onMouseEnter={()=>setHover(n)} onMouseLeave={()=>setHover(0)} onClick={()=>onChange(n)}
          style={{fontSize:size,cursor:"pointer",color:n<=(hover||value)?C.accent:C.border,transition:"color .1s",lineHeight:1}}>{n<=(hover||value)?"★":"☆"}</span>
      ))}
    </div>
  );
}

// --- Custom Icon Picker -------------------------------------------------------
function BookIconPicker({value,onChange}){
  const[open,setOpen]=useState(false);
  const selected = normalizeIconId(value);
  return(
    <div className="bb-icon-picker">
      <button type="button" className="bb-icon-picker-trigger" onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-label="Choose book icon">
        <BookMarkIcon id={selected} size={38}/>
      </button>
      {open&&(
        <div className="bb-icon-picker-popover" role="listbox" aria-label="Book icons">
          {BOOK_ICONS.map(icon=>(
            <button
              key={icon.id}
              type="button"
              className={`bb-icon-choice ${selected===icon.id?"is-selected":""}`}
              onClick={()=>{onChange(icon.id);setOpen(false);}}
              role="option"
              aria-selected={selected===icon.id}
              title={icon.label}
            >
              <BookMarkIcon id={icon.id} size={36}/>
              <span>{icon.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- BookSpine ----------------------------------------------------------------
function BookSpine({book,sessions,genres,onClick,height=136,dimmed=false}){
  const progress=getBookProgress(book,sessions);
  const status=getBookStatus(book,sessions);
  const sc=getSpineColor(book.genre,genres,book.id);
  const isFinished=status==="finished";
  const ratingStars = isFinished && book.rating ? Math.round(book.rating) : 0;
  const iconId = getBookIconId(book);
  const statusLabels={want:"Want to read",reading:"Reading",finished:"Finished"};

  return(
    <button
      type="button"
      className={`bb-book-tile ${dimmed?"is-dimmed":""}`}
      onClick={onClick}
      title={`${book.title} by ${book.author}${isFinished&&book.rating?` - ${book.rating}/5`:""}${status==="reading"?` - ${progress.percent}%`:""}`}
      style={{"--book-tone":sc}}
    >
      <span className="bb-book-tile-cover">
        <BookMarkIcon id={iconId} size={46}/>
        <span className="bb-book-tile-shine"/>
      </span>
      <span className="bb-book-tile-body">
        <strong>{book.title}</strong>
        <small>{book.author || "Unknown author"}</small>
      </span>
      <span className="bb-book-tile-meta">
        <span>{statusLabels[status]}</span>
        {isFinished&&ratingStars? <span>{ratingStars}/5</span> : status==="reading" ? <span>{progress.percent}%</span> : <span>{book.genre || "Queued"}</span>}
      </span>
      <div className="bb-book-tile-progress" aria-hidden="true">
        <span style={{width:`${progress.percent}%`}}/>
      </div>
    </button>
  );
}

// --- Confetti (Canvas) --------------------------------------------------------
function Confetti({onDone}){
  const ref=useRef(null);
  useEffect(()=>{
    const canvas=ref.current;
    if(!canvas)return;
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    const ctx=canvas.getContext("2d");
    const COLORS=["#d4903e","#e8b56a","#5a9e6a","#5a9ab8","#b85050","#c070c0","#f0d060","#e04080"];
    const pieces=Array.from({length:120},()=>({
      x:Math.random()*canvas.width, y:-20,
      vx:(Math.random()-.5)*3, vy:2+Math.random()*4,
      rot:Math.random()*Math.PI*2, rs:(Math.random()-.5)*.15,
      w:7+Math.random()*11, h:4+Math.random()*7,
      color:COLORS[Math.floor(Math.random()*COLORS.length)], opacity:1,
    }));
    let raf, start=Date.now();
    const draw=()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const elapsed=(Date.now()-start)/1000;
      let alive=false;
      pieces.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.06; p.rot+=p.rs;
        if(elapsed>2.5)p.opacity=Math.max(0,p.opacity-.025);
        if(p.opacity>0)alive=true;
        ctx.save();
        ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.globalAlpha=p.opacity; ctx.fillStyle=p.color;
        ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
        ctx.restore();
      });
      if(alive)raf=requestAnimationFrame(draw);
      else if(onDone)onDone();
    };
    draw();
    return()=>cancelAnimationFrame(raf);
  },[]);
  return<canvas ref={ref} style={{position:"fixed",inset:0,zIndex:9998,pointerEvents:"none",width:"100%",height:"100%"}}/>;
}

// --- Finish Celebration Modal -------------------------------------------------
function FinishCelebrationModal({book,sessions,genres,onSave,onSkip}){
  const[rating,setRating]=useState(book.rating||0);
  const[review,setReview]=useState(book.review||"");
  const dates=getBookDates(book,sessions);
  const days=dates.startedAt&&dates.finishedAt?Math.round((new Date(dates.finishedAt)-new Date(dates.startedAt))/86400000):null;
  const sc=getSpineColor(book.genre,genres,book.id);
  const font=getGenreFont(book.genre,genres);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.card,border:`2px solid ${C.accent}`,borderRadius:12,padding:36,maxWidth:520,width:"100%",textAlign:"center"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:10}}><BookMarkIcon id={getBookIconId(book)} size={54}/></div>
        <h2 style={{fontFamily:"'Newsreader Variable',serif",fontSize:28,color:C.accent,marginBottom:6}}>You finished it!</h2>
        <h3 style={{fontFamily:font,fontSize:20,color:C.text,marginBottom:4}}>{book.title}</h3>
        <p style={{color:C.muted,fontSize:14,marginBottom:20}}>{book.author}{days?` - took ${days} days`:""}</p>
        <div style={{marginBottom:20}}>
          <p style={{fontSize:13,color:C.muted,marginBottom:10}}>Rate this book</p>
          <div style={{display:"flex",justifyContent:"center"}}><StarPicker value={rating} onChange={setRating} size={36}/></div>
        </div>
        <div style={{marginBottom:24,textAlign:"left"}}>
          <label style={{display:"block",fontSize:11,textTransform:"uppercase",letterSpacing:".08em",color:C.muted,marginBottom:6}}>Your Review (optional)</label>
          <Textarea value={review} onChange={e=>setReview(e.target.value)} placeholder="What did you think? Would you recommend it?" style={{minHeight:80}}/>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center"}}>
          <Btn variant="ghost" onClick={onSkip}>Skip</Btn>
          <Btn onClick={()=>onSave({rating,review})}>Save Review</Btn>
        </div>
      </div>
    </div>
  );
}

// --- Finished Book Review Modal -----------------------------------------------
function FinishedBookReviewModal({book,sessions,genres,onClose,onEditReview}){
  const dates=getBookDates(book,sessions);
  const days=dates.startedAt&&dates.finishedAt?Math.round((new Date(dates.finishedAt)-new Date(dates.startedAt))/86400000):null;
  const sc=getSpineColor(book.genre,genres,book.id);
  const font=getGenreFont(book.genre,genres);
  const tags=book.tags?book.tags.split(",").map(t=>t.trim()).filter(Boolean):[];
  return(
    <Modal onClose={onClose} wide>
      <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>
        <div className="bb-detail-icon-card" style={{"--book-tone":sc}}>
          <BookMarkIcon id={getBookIconId(book)} size={58}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h2 style={{fontFamily:"'Newsreader Variable',serif",fontSize:24,color:C.text,lineHeight:1.2,marginBottom:4}}>{book.title}</h2>
          <p style={{color:C.muted,fontSize:15,marginBottom:12}}>{book.author}</p>
          {book.rating?(
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{display:"flex",gap:2}}>
                {[1,2,3,4,5].map(n=><span key={n} style={{fontSize:22,color:n<=Math.round(book.rating)?C.accent:C.border}}>{n<=Math.round(book.rating)?"★":"☆"}</span>)}
              </div>
              <span style={{color:C.accent,fontSize:16,fontWeight:700}}>{book.rating}/5</span>
            </div>
          ):<div style={{color:C.muted,fontSize:13,marginBottom:12,fontStyle:"italic"}}>No rating yet</div>}
          <div style={{display:"flex",gap:10,fontSize:12,color:C.muted,marginBottom:16,flexWrap:"wrap"}}>
            {dates.finishedAt&&<span>Finished {dates.finishedAt}</span>}
            {days&&<span>{days} days</span>}
            {book.genre&&<span>{book.genre}</span>}
            {book.format&&<span>{book.format==="paged"?"Print":"Audio"}</span>}
          </div>
          {tags.length>0&&<div style={{marginBottom:12}}>{tags.map(t=><Tag key={t}>{t}</Tag>)}</div>}
        </div>
      </div>
      {book.review&&(
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:20,margin:"20px 0",fontSize:15,color:C.text,fontStyle:"italic",lineHeight:1.7,borderLeft:`3px solid ${C.accent}`}}>
          "{book.review}"
        </div>
      )}
      {!book.review&&<div style={{color:C.muted,fontSize:13,fontStyle:"italic",margin:"16px 0"}}>No review written yet.</div>}
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <Btn onClick={onEditReview}>Edit Review</Btn>
      </div>
    </Modal>
  );
}

// --- Finished Shelf Modal -----------------------------------------------------
function FinishedShelfModal({books,sessions,genres,onClose,onBookClick}){
  const[sort,setSort]=useState("date");
  const[filterRating,setFilterRating]=useState(0);
  const finished=books.filter(b=>getBookStatus(b,sessions)==="finished");
  const sorted=[...finished].filter(b=>!filterRating||Math.round(b.rating||0)>=filterRating).sort((a,b)=>{
    if(sort==="rating")return(b.rating||0)-(a.rating||0);
    if(sort==="title")return a.title.localeCompare(b.title);
    const da=getBookDates(a,sessions).finishedAt||"";
    const db=getBookDates(b,sessions).finishedAt||"";
    return db.localeCompare(da);
  });
  return(
    <Modal onClose={onClose} full>
      <div style={{height:"100dvh",display:"flex",flexDirection:"column",background:C.bg}}>
        <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"16px 24px",display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <h2 style={{fontFamily:"'Newsreader Variable',serif",fontSize:20,color:C.accent}}>Finished Books ({finished.length})</h2>
          <div style={{display:"flex",gap:8,marginLeft:"auto",alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:12,color:C.muted}}>Filter rating at least</span>
            {[0,1,2,3,4,5].map(r=>(
              <button key={r} onClick={()=>setFilterRating(r)} style={{background:filterRating===r?C.accent:C.card,color:filterRating===r?C.bg:C.muted,border:`1px solid ${C.border}`,borderRadius:4,padding:"4px 8px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{r===0?"All":`${r}+`}</button>
            ))}
            <span style={{fontSize:12,color:C.muted,marginLeft:8}}>Sort:</span>
            {[["date","Date"],["rating","Rating"],["title","Title"]].map(([k,l])=>(
              <button key={k} onClick={()=>setSort(k)} style={{background:sort===k?C.accentDim:C.card,color:sort===k?C.accent:C.muted,border:`1px solid ${sort===k?C.accent:C.border}`,borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>{l}</button>
            ))}
            <Btn variant="ghost" icon={X} onClick={onClose} style={{marginLeft:8}}>Close</Btn>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:24}}>
          {sorted.length===0&&<p style={{color:C.muted,fontStyle:"italic",textAlign:"center",marginTop:40}}>No finished books match the filter.</p>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:16}}>
            {sorted.map(book=>{
              const dates=getBookDates(book,sessions);
              const sc=getSpineColor(book.genre,genres,book.id);
              const font=getGenreFont(book.genre,genres);
              return(
                <div key={book.id} onClick={()=>onBookClick(book)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,overflow:"hidden",cursor:"pointer",transition:"border-color .2s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                  <div style={{height:96,background:`linear-gradient(145deg, ${sc}22, ${sc}08)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <BookMarkIcon id={getBookIconId(book)} size={48}/>
                  </div>
                  <div style={{padding:12}}>
                    <div style={{fontFamily:"'Newsreader Variable',serif",fontSize:14,color:C.text,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{book.title}</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{book.author}</div>
                    <div style={{display:"flex",gap:1,marginBottom:4}}>
                      {book.rating?[1,2,3,4,5].map(n=><span key={n} style={{fontSize:13,color:n<=Math.round(book.rating)?C.accent:C.border}}>{n<=Math.round(book.rating)?"★":"☆"}</span>):<span style={{fontSize:12,color:C.muted,fontStyle:"italic"}}>unrated</span>}
                    </div>
                    {dates.finishedAt&&<div style={{fontSize:11,color:C.muted}}>{dates.finishedAt}</div>}
                    {book.review&&<div style={{fontSize:11,color:C.muted,fontStyle:"italic",marginTop:4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>"{book.review}"</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// --- Shelf Expand Modal -------------------------------------------------------
function ShelfExpandModal({shelfName,books,sessions,genres,onClose,onBookClick}){
  return(
    <Modal onClose={onClose} wide>
      <ModalTitle>{shelfName} - All Books ({books.length})</ModalTitle>
      <div className="bb-book-tile-grid bb-modal-book-grid">
        {books.map(book=>(
          <BookSpine key={book.id} book={book} sessions={sessions} genres={genres} onClick={()=>{onBookClick(book);onClose();}} height={130}/>
        ))}
      </div>
    </Modal>
  );
}

// --- Book Form Modal ----------------------------------------------------------
function BookFormModal({title,initial,settings,onSave,onClose}){
  const genres=settings.genres||DEFAULT_GENRES;
  const allTags=settings.tags||DEFAULT_TAGS;
  const[f,setF]=useState({
    title:"",
    author:"",
    genre:"",
    format:"paged",
    totalPages:"",
    totalMinutes:"",
    rating:"",
    review:"",
    ...initial,
    icon:normalizeIconId(initial?.icon || initial?.emoji),
    tags:initial?.tags||"",
  });
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const[tagOpen,setTagOpen]=useState(false);
  const selectedTags=f.tags?f.tags.split(",").map(t=>t.trim()).filter(Boolean):[];
  const toggleTag=t=>{
    const cur=new Set(selectedTags);
    cur.has(t)?cur.delete(t):cur.add(t);
    set("tags",[...cur].join(", "));
  };
  const submit=()=>{
    if(!f.title.trim()||!f.author.trim())return alert("Title and author required");
    if(f.format==="paged"&&!f.totalPages)return alert("Total pages required");
    if(f.format==="audible"&&!f.totalMinutes)return alert("Total minutes required");
    onSave({...f,icon:normalizeIconId(f.icon),emoji:"",totalPages:parseInt(f.totalPages)||0,totalMinutes:parseInt(f.totalMinutes)||0,rating:f.rating?parseFloat(f.rating):null});
  };
  return(
    <Modal onClose={onClose}>
      <ModalTitle>{title}</ModalTitle>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div style={{gridColumn:"1/-1",display:"flex",gap:12,alignItems:"flex-start"}}>
          <div>
            <label style={{display:"block",fontSize:11,textTransform:"uppercase",letterSpacing:".08em",color:C.muted,marginBottom:5}}>Icon</label>
            <BookIconPicker value={f.icon} onChange={v=>set("icon",v)}/>
          </div>
          <div style={{flex:1}}>
            <Field label="Title *"><Input value={f.title} onChange={e=>set("title",e.target.value)} placeholder="Book title"/></Field>
          </div>
        </div>
        <div style={{gridColumn:"1/-1"}}><Field label="Author *"><Input value={f.author} onChange={e=>set("author",e.target.value)} placeholder="Author name"/></Field></div>
        <Field label="Genre">
          <select value={f.genre} onChange={e=>set("genre",e.target.value)}
            style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,color:f.genre?C.text:C.muted,padding:"8px 12px",borderRadius:4,fontSize:14,outline:"none"}}>
            <option value="">Select genre</option>
            {genres.map(g=><option key={g.name} value={g.name}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Rating (0-5)">
          <Input type="number" min="0" max="5" step="0.5" value={f.rating} onChange={e=>set("rating",e.target.value)} placeholder="Optional"/>
        </Field>
        <div style={{gridColumn:"1/-1"}}>
          <label style={{display:"block",fontSize:11,textTransform:"uppercase",letterSpacing:".08em",color:C.muted,marginBottom:5}}>Tags</label>
          <div style={{position:"relative"}}>
            <button onClick={()=>setTagOpen(o=>!o)} style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,color:C.text,padding:"8px 12px",borderRadius:4,fontSize:13,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
              {selectedTags.length?selectedTags.join(", "):<span style={{color:C.muted}}>Select tags</span>}
            </button>
            {tagOpen&&(
              <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:C.card,border:`1px solid ${C.border}`,borderRadius:4,padding:8,boxShadow:"0 4px 16px rgba(0,0,0,.5)"}}>
                {allTags.map(t=>(
                  <div key={t} onClick={()=>toggleTag(t)} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",cursor:"pointer",borderRadius:4,background:selectedTags.includes(t)?C.accentDim:"none"}}
                    onMouseEnter={ev=>ev.currentTarget.style.background=C.accentDim}
                    onMouseLeave={ev=>ev.currentTarget.style.background=selectedTags.includes(t)?C.accentDim:"none"}>
                    <div style={{width:14,height:14,border:`1px solid ${C.border}`,borderRadius:3,background:selectedTags.includes(t)?C.accent:"none",flexShrink:0}}/>
                    <span style={{fontSize:13,color:C.text}}>{t}</span>
                  </div>
                ))}
                <button onClick={()=>setTagOpen(false)} style={{width:"100%",marginTop:6,background:C.card,border:`1px solid ${C.border}`,color:C.muted,padding:"4px",borderRadius:4,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Done</button>
              </div>
            )}
          </div>
        </div>
        <div style={{gridColumn:"1/-1"}}>
          <Field label="Format">
            <div style={{display:"flex",gap:8}}>
              {["paged","audible"].map(fmt=>(
                <button key={fmt} onClick={()=>set("format",fmt)} style={{flex:1,padding:"8px",background:f.format===fmt?C.accent:C.bg,color:f.format===fmt?C.bg:C.muted,border:`1px solid ${f.format===fmt?C.accent:C.border}`,borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontSize:14}}>
                  {fmt==="paged"?"Paged":"Audible"}
                </button>
              ))}
            </div>
          </Field>
        </div>
        {f.format==="paged"&&<div style={{gridColumn:"1/-1"}}><Field label="Total Pages *"><Input type="number" value={f.totalPages} onChange={e=>set("totalPages",e.target.value)} placeholder="e.g. 320"/></Field></div>}
        {f.format==="audible"&&<div style={{gridColumn:"1/-1"}}><Field label="Total Minutes *"><Input type="number" value={f.totalMinutes} onChange={e=>set("totalMinutes",e.target.value)} placeholder="e.g. 480"/></Field></div>}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit}>Save Book</Btn>
      </div>
    </Modal>
  );
}

// --- Session Form Modal -------------------------------------------------------
function SessionFormModal({books,prefillBook,initial,sessions,onSave,onClose}){
  const[bookId,setBookId]=useState(initial?.bookId||prefillBook?.id||books[0]?.id||"");
  const[date,setDate]=useState(initial?.date?.slice(0,16)||new Date().toISOString().slice(0,16));
  const[endValue,setEndValue]=useState(initial?.endValue?.toString()||"");
  const[dur,setDur]=useState(initial?.durationMinutes?.toString()||"");
  const[correction,setCorrection]=useState(initial?.isCorrection||false);
  const selBook=books.find(b=>b.id===bookId);
  const progress=selBook?getBookProgress(selBook,sessions):null;
  const isAudio=selBook?.format==="audible";
  const submit=()=>{
    if(!bookId)return alert("Select a book");
    const val=parseInt(endValue);
    if(isNaN(val)||val<0)return alert("Invalid value");
    if(!correction&&progress&&val<progress.current)return alert(`Current is ${progress.current}. Enable correction mode to go back.`);
    if(progress&&progress.total>0&&val>progress.total)return alert(`Exceeds total (${progress.total})`);
    onSave({bookId,date:new Date(date).toISOString(),endValue:val,durationMinutes:parseInt(dur)||null,isCorrection:correction});
  };
  return(
    <Modal onClose={onClose}>
      <ModalTitle>{initial?"Edit Session":"Log Reading Session"}</ModalTitle>
      <Field label="Book">
        <select value={bookId} onChange={e=>setBookId(e.target.value)} style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,color:C.text,padding:"8px 12px",borderRadius:4,fontSize:14,outline:"none"}}>
          <option value="">Select book</option>
          {books.map(b=><option key={b.id} value={b.id}>{b.title}{b.format==="audible"?" (Audio)":""}</option>)}
        </select>
      </Field>
      {selBook&&progress&&(
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:4,padding:"10px 12px",marginBottom:14,fontSize:13,color:C.muted}}>
          Progress: <span style={{color:C.text}}>{isAudio?formatMinutes(progress.current):`${progress.current} pages`}</span> / <span style={{color:C.text}}>{isAudio?formatMinutes(progress.total):`${progress.total} pages`}</span> ({progress.percent}%)
        </div>
      )}
      <Field label="Date & Time"><Input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></Field>
      <Field label={isAudio?"End Minute (total elapsed)":"End Page"}>
        <Input type="number" min="0" value={endValue} onChange={e=>setEndValue(e.target.value)} placeholder={isAudio?"e.g. 95":"e.g. 142"}/>
      </Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Duration (min, optional)"><Input type="number" min="0" value={dur} onChange={e=>setDur(e.target.value)} placeholder="e.g. 45"/></Field>
        <Field label="Session note"><Input value="" placeholder="(removed)"/></Field>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <input type="checkbox" id="corr" checked={correction} onChange={e=>setCorrection(e.target.checked)}/>
        <label htmlFor="corr" style={{fontSize:13,color:C.muted,cursor:"pointer"}}>Correction mode (allow going back)</label>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit}>Save Session</Btn>
      </div>
    </Modal>
  );
}

// --- Book Detail Modal --------------------------------------------------------
function BookDetailModal({book,sessions,settings,genres,getProgress,onClose,onEdit,onDelete,onAddSession,onEditSession,onDeleteSession,onEditReview}){
  const[confirm,setConfirm]=useState(false);
  const[confirmSessId,setConfirmSessId]=useState(null);
  const progress=getProgress(book);
  const status=getBookStatus(book,sessions);
  const dates=getBookDates(book,sessions);
  const proj=getBookProjection(book,sessions,settings);
  const bookSessions=sessions.filter(s=>s.bookId===book.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const isAudio=book.format==="audible";
  const tags=book.tags?book.tags.split(",").map(t=>t.trim()).filter(Boolean):[];
  const sc=getSpineColor(book.genre,genres,book.id);
  const font=getGenreFont(book.genre,genres);
  const isFinished=status==="finished";
  const statusColors={want:C.muted,reading:C.accent,finished:C.green};
  const statusLabels={want:"Want to Read",reading:"Reading",finished:"Finished"};
  const days=dates.startedAt&&dates.finishedAt?Math.round((new Date(dates.finishedAt)-new Date(dates.startedAt))/86400000):null;
  return(
    <Modal onClose={onClose} wide>
      <div style={{display:"flex",gap:20,marginBottom:20,alignItems:"flex-start"}}>
        <div className="bb-detail-icon-card" style={{"--book-tone":sc}}>
          <BookMarkIcon id={getBookIconId(book)} size={54}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:4}}>
            <h2 style={{fontFamily:"'Newsreader Variable',serif",fontSize:22,color:C.text,lineHeight:1.2}}>{book.title}</h2>
            <span style={{background:statusColors[status]+"30",color:statusColors[status],borderRadius:12,padding:"3px 12px",fontSize:12,whiteSpace:"nowrap",border:`1px solid ${statusColors[status]}40`}}>{statusLabels[status]}</span>
          </div>
          <p style={{color:C.muted,fontSize:15,marginBottom:8}}>{book.author}</p>
          {book.genre&&<span style={{background:C.accentDim,color:C.accent,borderRadius:12,padding:"2px 10px",fontSize:12,marginRight:4}}>{book.genre}</span>}
          {tags.map(t=><Tag key={t}>{t}</Tag>)}
          {isFinished&&book.rating&&(
            <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6}}>
              {[1,2,3,4,5].map(n=><span key={n} style={{fontSize:18,color:n<=Math.round(book.rating)?C.accent:C.border}}>{n<=Math.round(book.rating)?"★":"☆"}</span>)}
              <span style={{color:C.muted,fontSize:13,marginLeft:2}}>{book.rating}/5</span>
            </div>
          )}
        </div>
      </div>

      {/* Review (if finished) */}
      {isFinished&&book.review&&(
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.accent}`,borderRadius:"0 6px 6px 0",padding:"14px 18px",marginBottom:16,fontSize:14,color:C.text,fontStyle:"italic",lineHeight:1.7}}>
          "{book.review}"
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:14}}>
          <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>Progress</div>
          <ProgressBar percent={progress.percent} h={6}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:13}}>
            <span style={{color:C.text}}>{isAudio?formatMinutes(progress.current):`${progress.current} pages`}</span>
            <span style={{color:C.accent,fontWeight:700}}>{progress.percent}%</span>
            <span style={{color:C.muted}}>{isAudio?formatMinutes(progress.total):`${progress.total} pages`}</span>
          </div>
        </div>
        <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:14}}>
          <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>Dates</div>
          {dates.startedAt&&<div style={{fontSize:13,color:C.muted,marginBottom:3}}>Started: <span style={{color:C.text}}>{dates.startedAt.slice(0,10)}</span></div>}
          {dates.finishedAt&&<div style={{fontSize:13,color:C.green}}>Finished: {dates.finishedAt.slice(0,10)}{days?` (${days}d)`:""}</div>}
          {proj&&!dates.finishedAt&&<div style={{fontSize:13,color:C.accent,marginTop:4}}>~{proj.finishDate} at {proj.ratePerDay} {isAudio?"min":"pg"}/day</div>}
        </div>
      </div>

      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Reading Log ({bookSessions.length})</div>
        {bookSessions.length===0&&<p style={{color:C.muted,fontSize:13,fontStyle:"italic"}}>No sessions yet.</p>}
        <div style={{maxHeight:180,overflowY:"auto"}}>
          {bookSessions.map(s=>(
            <div key={s.id} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1,fontSize:13,color:C.muted}}>
                <span style={{color:C.text}}>{s.date.slice(0,10)}</span>
                <span style={{marginLeft:8}}>{isAudio?formatMinutes(s.endValue):`p.${s.endValue}`}</span>
                {s.durationMinutes&&<span style={{marginLeft:6}}>({s.durationMinutes}min)</span>}
                {s.isCorrection&&<span style={{color:C.red,marginLeft:6}}>[correction]</span>}
              </div>
              <Btn variant="small" onClick={()=>onEditSession(s)}>Edit</Btn>
              {confirmSessId===s.id?(
                <><Btn variant="danger" style={{padding:"3px 8px",fontSize:11}} onClick={()=>{onDeleteSession(s.id);setConfirmSessId(null);}}>Del</Btn>
                <Btn variant="small" onClick={()=>setConfirmSessId(null)}>No</Btn></>
              ):<Btn variant="small" style={{color:C.red}} onClick={()=>setConfirmSessId(s.id)}>Remove</Btn>}
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:8}}>
          {confirm?(
            <><Btn variant="danger" onClick={()=>onDelete(book)}>Yes, Delete</Btn><Btn variant="ghost" onClick={()=>setConfirm(false)}>Cancel</Btn></>
          ):<Btn variant="danger" onClick={()=>setConfirm(true)}>Delete Book</Btn>}
          <Btn variant="ghost" onClick={()=>onEdit(book)}>Edit Book</Btn>
          {isFinished&&<Btn variant="ghost" onClick={onEditReview}>{book.review?"Edit Review":"Write Review"}</Btn>}
        </div>
        <Btn onClick={()=>onAddSession(book)}>+ Log Session</Btn>
      </div>
    </Modal>
  );
}

// --- Bookshelf Page -----------------------------------------------------------
const MAX_SHELF = 8;

function BookshelfPage({books,sessions,genres,searchQuery,getProgress,onAddBook,onBookClick}){
  const[expandShelf,setExpandShelf]=useState(null);
  const[showFinished,setShowFinished]=useState(false);
  const[finishedBook,setFinishedBook]=useState(null);

  const q=searchQuery.toLowerCase();
  const filtered=q?books.filter(b=>[b.title,b.author,b.genre,b.tags].some(f=>f?.toLowerCase().includes(q))):books;

  const shelves=[
    {key:"want",  label:"Want to Read",  emptyMsg:"Add books you want to read"},
    {key:"reading",label:"Currently Reading",emptyMsg:"Start a session to move books here"},
  ];

  const sortBooks=(bs,key)=>{
    if(key==="reading")return[...bs].sort((a,b)=>{
      const da=getBookDates(a,sessions).lastSessionAt||"";
      const db=getBookDates(b,sessions).lastSessionAt||"";
      return db.localeCompare(da);
    });
    return[...bs].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  };

  const statusCounts = {
    want: filtered.filter(b=>getBookStatus(b,sessions)==="want").length,
    reading: filtered.filter(b=>getBookStatus(b,sessions)==="reading").length,
    finished: filtered.filter(b=>getBookStatus(b,sessions)==="finished").length,
  };

  return(
    <div className="bb-library-page bb-page-reveal">
      <div className="bb-library-hero">
        <div>
          <p className="bb-kicker">Bookshelf</p>
          <h2>Your reading room.</h2>
          <p>Browse what is queued, in progress, and finished without the old cramped shelf rails.</p>
        </div>
        <div className="bb-library-hero-actions">
          <div className="bb-library-mini-stats">
            <span><strong>{books.length}</strong> books</span>
            <span><strong>{statusCounts.reading}</strong> reading</span>
            <span><strong>{statusCounts.finished}</strong> finished</span>
          </div>
          <Btn icon={Plus} onClick={onAddBook}>Add Book</Btn>
        </div>
      </div>

      {shelves.map(shelf=>{
        const shelfBooks=sortBooks(filtered.filter(b=>getBookStatus(b,sessions)===shelf.key),shelf.key);
        const visible=shelfBooks.slice(0,MAX_SHELF);
        const hiddenCount=shelfBooks.length-MAX_SHELF;
        return(
          <section key={shelf.key} className="bb-shelf-section">
            <div className="bb-shelf-header">
              <div>
                <h3>{shelf.label}</h3>
                <p>{shelfBooks.length ? `${shelfBooks.length} books` : shelf.emptyMsg}</p>
              </div>
              {shelfBooks.length>MAX_SHELF&&<Btn variant="ghost" onClick={()=>setExpandShelf(shelf.key)}>View all</Btn>}
            </div>
            {shelfBooks.length===0?(
              <div className="bb-shelf-empty">
                <BookOpenText size={34} weight="duotone"/>
                <span>{shelf.emptyMsg}</span>
              </div>
            ):(
              <div className="bb-book-tile-grid">
                {visible.map(book=>(
                  <BookSpine key={book.id} book={book} sessions={sessions} genres={genres} onClick={()=>onBookClick(book)} height={140}/>
                ))}
                {hiddenCount>0&&(
                  <button className="bb-more-books-card" onClick={()=>setExpandShelf(shelf.key)}>
                    <Plus size={24} weight="duotone"/>
                    <strong>{hiddenCount} more</strong>
                    <span>Open shelf</span>
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Finished shelf */}
      {(() => {
        const finishedBooks = sortBooks(filtered.filter(b => getBookStatus(b, sessions) === "finished"), "finished");
        const visible = finishedBooks.slice(0, MAX_SHELF);
        const hiddenCount = finishedBooks.length - MAX_SHELF;
        return (
          <section className="bb-shelf-section bb-shelf-section-finished">
            <div className="bb-shelf-header">
              <div>
                <h3>Finished</h3>
                <p>{finishedBooks.length ? `${finishedBooks.length} completed books` : "Finish a book to see it here"}</p>
              </div>
              {finishedBooks.length>0&&<Btn variant="ghost" onClick={()=>setShowFinished(true)}>Browse finished</Btn>}
            </div>
            {finishedBooks.length===0?(
              <div className="bb-shelf-empty">
                <CheckCircle size={34} weight="duotone"/>
                <span>Finish a book to see it here</span>
              </div>
            ):(
              <div className="bb-book-tile-grid">
                {visible.map(book=>(
                  <BookSpine key={book.id} book={book} sessions={sessions} genres={genres} onClick={()=>setFinishedBook(book)} height={140}/>
                ))}
                {hiddenCount>0&&(
                  <button className="bb-more-books-card" onClick={()=>setShowFinished(true)}>
                    <Plus size={24} weight="duotone"/>
                    <strong>{hiddenCount} more</strong>
                    <span>Browse finished</span>
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })()}

      {/* Modals */}
      {expandShelf&&(
        <ShelfExpandModal
          shelfName={shelves.find(s=>s.key===expandShelf)?.label||expandShelf}
          books={sortBooks(books.filter(b=>getBookStatus(b,sessions)===expandShelf),expandShelf)}
          sessions={sessions} genres={genres}
          onClose={()=>setExpandShelf(null)}
          onBookClick={b=>{onBookClick(b);setExpandShelf(null);}}
        />
      )}
      {showFinished&&(
        <FinishedShelfModal
          books={books} sessions={sessions} genres={genres}
          onClose={()=>setShowFinished(false)}
          onBookClick={b=>{setFinishedBook(b);setShowFinished(false);}}
        />
      )}
      {finishedBook&&(
        <FinishedBookReviewModal
          book={books.find(b=>b.id===finishedBook.id)||finishedBook}
          sessions={sessions} genres={genres}
          onClose={()=>setFinishedBook(null)}
          onEditReview={()=>{setFinishedBook(null);onBookClick(books.find(b=>b.id===finishedBook.id)||finishedBook);}}
        />
      )}
    </div>
  );
}

// --- Main / Dashboard ---------------------------------------------------------
function MainPage({books,sessions,settings,getProgress,getSessionDelta,getSessionPageEquiv,onAddSession,onEditSession,onDeleteSession,onBookClick}){
  const[confirmSessId,setConfirmSessId]=useState(null);
  const todayISO=todayStr();
  const weekAgo=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const todayPages=sessions.filter(s=>s.date.slice(0,10)===todayISO).reduce((s,x)=>s+getSessionPageEquiv(x),0);
  const weekPages=sessions.filter(s=>s.date.slice(0,10)>=weekAgo).reduce((s,x)=>s+getSessionPageEquiv(x),0);
  const finishedBooks=books.filter(b=>getBookStatus(b,sessions)==="finished").length;
  const readingNow=books.filter(b=>getBookStatus(b,sessions)==="reading");
  const recent=[...sessions].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,20);
  let streak=0;
  for(let d=new Date();;d.setDate(d.getDate()-1)){
    if(sessions.some(s=>s.date.slice(0,10)===d.toISOString().slice(0,10)))streak++;
    else break;
  }
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{fontFamily:"'Newsreader Variable',serif",fontSize:24,color:C.text}}>Dashboard</h2>
        <Btn onClick={onAddSession}>+ Log Session</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:24}}>
        {[{num:todayPages,label:"Pages Today"},{num:weekPages,label:"Pages This Week"},{num:streak,label:"Day Streak"},{num:`${finishedBooks}/${books.length}`,label:"Books Finished"}].map(({num,label})=>(
          <div key={label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:16}}>
            <div style={{fontFamily:"'Newsreader Variable',serif",fontSize:28,color:C.accent,lineHeight:1}}>{num}</div>
            <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",marginTop:5}}>{label}</div>
          </div>
        ))}
      </div>
      {readingNow.length>0&&(
        <div style={{marginBottom:24}}>
          <h3 style={{fontFamily:"'Newsreader Variable',serif",fontSize:17,color:C.muted,marginBottom:12}}>Currently Reading</h3>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
            {readingNow.map(book=>{
              const prog=getProgress(book);
              const proj=getBookProjection(book,sessions,settings);
              return(
                <div key={book.id} onClick={()=>onBookClick(book)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:14,cursor:"pointer",display:"flex",gap:12}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                  <BookMarkIcon id={getBookIconId(book)} size={34}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"'Newsreader Variable',serif",fontSize:14,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{book.title}</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:5}}>{book.author}</div>
                    <ProgressBar percent={prog.percent} h={3}/>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:12}}>
                      <span style={{color:C.muted}}>{prog.percent}%</span>
                      {proj&&<span style={{color:C.accent}}>~{proj.finishDate}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <h3 style={{fontFamily:"'Newsreader Variable',serif",fontSize:17,color:C.muted,marginBottom:12}}>Reading Log</h3>
      {recent.length===0&&<p style={{color:C.muted,fontSize:13,fontStyle:"italic"}}>No sessions yet!</p>}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,overflow:"hidden"}}>
        {recent.map((s,i)=>{
          const book=books.find(b=>b.id===s.bookId);
          const delta=getSessionDelta(s);
          const pageEquiv=getSessionPageEquiv(s);
          const isAudio=book?.format==="audible";
          return(
            <div key={s.id} style={{display:"flex",gap:12,alignItems:"center",padding:"11px 16px",borderBottom:i<recent.length-1?`1px solid ${C.border}`:"none"}}>
              <BookMarkIcon id={getBookIconId(book)} size={30}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Newsreader Variable',serif",fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{book?.title||"Unknown"}</div>
                <div style={{fontSize:12,color:C.muted}}>
                  {s.date.slice(0,10)} - {isAudio?`${formatMinutes(s.endValue)} elapsed`:`page ${s.endValue}`}
                  {delta>0&&<span style={{color:C.accent,marginLeft:6}}>+{isAudio?formatMinutes(delta):`${delta}pg`}</span>}
                  {s.durationMinutes&&<span style={{marginLeft:6}}>({s.durationMinutes}min)</span>}
                </div>
              </div>
              {book?.format==="audible"&&delta>0&&<div style={{fontSize:11,color:C.muted,textAlign:"right",flexShrink:0}}><span style={{color:C.accentLight}}>{pageEquiv}</span><br/>pg-eq</div>}
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <Btn variant="small" onClick={()=>onEditSession(s)}>Edit</Btn>
                {confirmSessId===s.id?(<>
                  <Btn variant="danger" style={{padding:"3px 8px",fontSize:11}} onClick={()=>{onDeleteSession(s.id);setConfirmSessId(null);}}>Del</Btn>
                  <Btn variant="small" onClick={()=>setConfirmSessId(null)}>No</Btn>
                </>):<Btn variant="small" style={{color:C.red}} onClick={()=>setConfirmSessId(s.id)}>Remove</Btn>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- SVG Line Chart -----------------------------------------------------------
function CumulativeLineChart({goal,goalSessions,getSessionPageEquiv,overallRate}){
  const W=560,H=160,ML=44,MB=28,MR=12,MT=12;
  const PW=W-ML-MR,PH=H-MT-MB;
  const start=new Date(goal.startDate),end=new Date(goal.endDate),now=new Date();
  const totalDays=Math.max(1,(end-start)/86400000);

  const perDay={};
  goalSessions.forEach(s=>{
    const d=s.date.slice(0,10);
    perDay[d]=(perDay[d]||0)+getSessionPageEquiv(s);
  });

  // Build cumulative actual points
  const actual=[];
  let cum=0;
  for(let d=new Date(start);d<=new Date(Math.min(end,now));d.setDate(d.getDate()+1)){
    const ds=d.toISOString().slice(0,10);
    cum+=(perDay[ds]||0);
    actual.push({day:(new Date(ds)-start)/86400000,val:cum});
  }

  // Ideal line: 0 to target over totalDays
  const maxY=Math.max(goal.target,cum)*1.08;
  const xScale=d=>ML+d/totalDays*PW;
  const yScale=v=>MT+PH-(v/maxY)*PH;

  // Projected from current to goal end
  const currentDay=Math.min(totalDays,(now-start)/86400000);
  const projEnd=cum+overallRate*(totalDays-currentDay);
  const projPath=`M${xScale(currentDay)},${yScale(cum)} L${xScale(totalDays)},${yScale(projEnd)}`;

  const actualPath=actual.length>1?`M${actual.map(p=>`${xScale(p.day)},${yScale(p.val)}`).join(" L")}`:"";
  const idealPath=`M${xScale(0)},${yScale(0)} L${xScale(totalDays)},${yScale(goal.target)}`;

  // Y axis ticks
  const ticks=[0,0.25,0.5,0.75,1].map(t=>Math.round(maxY*t));

  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
      {/* Grid */}
      {ticks.map(t=>(
        <g key={t}>
          <line x1={ML} y1={yScale(t)} x2={W-MR} y2={yScale(t)} stroke={C.border} strokeWidth={0.5}/>
          <text x={ML-4} y={yScale(t)+4} fontSize={9} fill={C.muted} textAnchor="end">{t>=1000?`${(t/1000).toFixed(1)}k`:t}</text>
        </g>
      ))}
      {/* Goal target line */}
      <line x1={ML} y1={yScale(goal.target)} x2={W-MR} y2={yScale(goal.target)} stroke={C.green} strokeWidth={1} strokeDasharray="4,3" opacity={0.6}/>
      <text x={W-MR-2} y={yScale(goal.target)-3} fontSize={8} fill={C.green} textAnchor="end" opacity={0.8}>target</text>
      {/* Ideal */}
      <path d={idealPath} stroke={C.muted} strokeWidth={1} strokeDasharray="3,3" fill="none" opacity={0.4}/>
      {/* Projection */}
      {overallRate>0&&<path d={projPath} stroke={C.blue} strokeWidth={1.5} strokeDasharray="5,3" fill="none" opacity={0.7}/>}
      {/* Actual fill */}
      {actual.length>1&&(
        <path d={actualPath+` L${xScale(actual[actual.length-1].day)},${MT+PH} L${xScale(0)},${MT+PH} Z`}
          fill={C.accent} opacity={0.1}/>
      )}
      {/* Actual line */}
      {actual.length>1&&<path d={actualPath} stroke={C.accent} strokeWidth={2} fill="none" strokeLinejoin="round"/>}
      {/* Axes */}
      <line x1={ML} y1={MT} x2={ML} y2={MT+PH} stroke={C.border} strokeWidth={1}/>
      <line x1={ML} y1={MT+PH} x2={W-MR} y2={MT+PH} stroke={C.border} strokeWidth={1}/>
      {/* Legend */}
      <g transform={`translate(${ML+4},${MT+4})`}>
        <rect width={8} height={3} y={3} fill={C.accent} rx={1}/>
        <text x={11} y={8} fontSize={8} fill={C.muted}>Actual</text>
        <rect x={48} width={8} height={3} y={3} fill={C.blue} rx={1} opacity={0.7}/>
        <text x={59} y={8} fontSize={8} fill={C.muted}>Projected</text>
        <rect x={104} width={8} height={3} y={3} fill={C.muted} rx={1} opacity={0.4}/>
        <text x={115} y={8} fontSize={8} fill={C.muted}>Ideal pace</text>
      </g>
    </svg>
  );
}

// --- 12-Segment Bar Chart -----------------------------------------------------
function SegmentBarChart({goal,goalSessions,getSessionPageEquiv,overallRate}){
  const W=560,H=180,ML=44,MB=40,MR=12,MT=16;
  const PW=W-ML-MR,PH=H-MT-MB;
  const start=new Date(goal.startDate),end=new Date(goal.endDate),now=new Date();
  const totalDays=Math.max(1,(end-start)/86400000);
  const segDays=totalDays/12;
  const perSeg=goal.target/12;

  const perDay={};
  goalSessions.forEach(s=>{
    const d=s.date.slice(0,10);
    perDay[d]=(perDay[d]||0)+getSessionPageEquiv(s);
  });

  const segments=Array.from({length:12},(_,i)=>{
    const segStart=new Date(start.getTime()+i*segDays*86400000);
    const segEnd=new Date(start.getTime()+(i+1)*segDays*86400000);
    const isPast=segEnd<=now;
    const isFuture=segStart>now;
    let actual=0;
    for(let d=new Date(segStart);d<segEnd;d.setDate(d.getDate()+1)){
      actual+=(perDay[d.toISOString().slice(0,10)]||0);
    }
    const projected=isFuture?overallRate*segDays:(isPast?actual:actual+overallRate*Math.max(0,(now-segStart)/86400000-1));
    const label=`${(segStart.getMonth()+1)}/${segStart.getDate()}`;
    return{actual,projected,target:perSeg,isPast,isFuture,label,i};
  });

  const maxVal=Math.max(...segments.map(s=>Math.max(s.actual,s.projected,s.target)),1)*1.15;
  const bw=(PW/12)*0.36;
  const xSlot=i=>ML+i*(PW/12)+PW/24;
  const yScale=v=>MT+PH-(v/maxVal)*PH;

  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
      {/* Y grid */}
      {[0,.5,1].map(t=>{
        const val=Math.round(maxVal*t);
        return<g key={t}>
          <line x1={ML} y1={yScale(val)} x2={W-MR} y2={yScale(val)} stroke={C.border} strokeWidth={0.5}/>
          <text x={ML-3} y={yScale(val)+4} fontSize={8} fill={C.muted} textAnchor="end">{val>=1000?`${Math.round(val/100)/10}k`:val}</text>
        </g>;
      })}
      {segments.map(seg=>{
        const cx=xSlot(seg.i);
        const actualH=Math.max(2,((seg.isPast||!seg.isFuture?seg.actual:0)/maxVal)*PH);
        const projH=Math.max(2,(seg.projected/maxVal)*PH);
        const tgtH=Math.max(2,(seg.target/maxVal)*PH);
        const base=MT+PH;
        return(
          <g key={seg.i}>
            {/* Target line/tick */}
            <line x1={cx-bw*1.3} y1={base-tgtH} x2={cx+bw*1.3} y2={base-tgtH}
              stroke={C.green} strokeWidth={1.5} strokeDasharray="2,2" opacity={0.7}/>
            {/* Projected bar (future segs) */}
            {seg.isFuture&&(
              <rect x={cx-bw/2} y={base-projH} width={bw} height={projH}
                fill={C.accent} opacity={0.2} rx={2}/>
            )}
            {/* Actual bar */}
            {!seg.isFuture&&seg.actual>0&&(
              <rect x={cx-bw/2} y={base-actualH} width={bw} height={actualH}
                fill={seg.isPast?C.accent:"#e8a05a"} opacity={seg.isPast?0.85:0.95} rx={2}/>
            )}
            {/* X label */}
            <text x={cx} y={H-MB+14} fontSize={7.5} fill={C.muted} textAnchor="middle">{seg.label}</text>
          </g>
        );
      })}
      {/* Axes */}
      <line x1={ML} y1={MT} x2={ML} y2={MT+PH} stroke={C.border} strokeWidth={1}/>
      <line x1={ML} y1={MT+PH} x2={W-MR} y2={MT+PH} stroke={C.border} strokeWidth={1}/>
      {/* Legend */}
      <g transform={`translate(${ML+4},${MT})`}>
        <rect width={8} height={8} fill={C.accent} opacity={0.85} rx={1}/>
        <text x={11} y={7} fontSize={8} fill={C.muted}>Actual</text>
        <rect x={46} width={8} height={8} fill={C.accent} opacity={0.2} rx={1}/>
        <text x={57} y={7} fontSize={8} fill={C.muted}>Projected</text>
        <line x1={100} y1={4} x2={108} y2={4} stroke={C.green} strokeWidth={1.5} strokeDasharray="2,2" opacity={0.7}/>
        <text x={111} y={7} fontSize={8} fill={C.muted}>Target/segment</text>
      </g>
    </svg>
  );
}

// --- Day-of-Week Bar ----------------------------------------------------------
function DayOfWeekBar({totals}){
  const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const max=Math.max(...totals,1);
  return(
    <div style={{display:"flex",gap:4,alignItems:"flex-end",height:56}}>
      {DAYS.map((d,i)=>(
        <div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{width:"100%",borderRadius:"2px 2px 0 0",height:Math.max(3,(totals[i]/max)*42),background:totals[i]>0?C.accent:C.border,opacity:totals[i]>0?0.5+0.5*(totals[i]/max):1,transition:"height .4s"}}/>
          <div style={{fontSize:9,color:C.muted}}>{d}</div>
        </div>
      ))}
    </div>
  );
}

// --- Dual Donut Wheel ---------------------------------------------------------
function DualDonut({outerPct,innerPct,statusLabel,statusColor,size=180}){
  const cx=size/2,cy=size/2,outerR=size*.41,innerR=size*.28,sw=size*.09;
  const dash=(r,pct)=>{const c=2*Math.PI*r,f=Math.min(Math.max(pct,0),100)/100*c;return{da:`${f} ${c}`,off:-(c/4)};};
  const od=dash(outerR,outerPct),id2=dash(innerR,innerPct);
  const lines=statusLabel.split("|");
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position:"absolute",inset:0}}>
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={C.border} strokeWidth={sw}/>
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={C.border} strokeWidth={sw}/>
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={C.accent} strokeWidth={sw} strokeLinecap="round" strokeDasharray={od.da} strokeDashoffset={od.off}/>
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={C.blue} strokeWidth={sw} strokeLinecap="round" strokeDasharray={id2.da} strokeDashoffset={id2.off}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
        {lines.map((l,i)=>(
          <div key={i} style={{fontSize:size*.073,fontWeight:700,color:statusColor,textAlign:"center",fontFamily:"'Newsreader Variable',serif",lineHeight:1.2}}>{l}</div>
        ))}
      </div>
    </div>
  );
}

// --- Goal Analytics -----------------------------------------------------------
function GoalAnalytics({goal,books,sessions,settings,getSessionPageEquiv}){
  const now=new Date(),start=new Date(goal.startDate),end=new Date(goal.endDate);
  const totalDays=Math.max(1,(end-start)/86400000);
  const elapsedDays=Math.max(0,Math.min(totalDays,(now-start)/86400000));
  const remainingDays=Math.max(0,(end-now)/86400000);
  const unit=goal.type==="pages"?"pages":"books";
  const gs={...DEFAULT_GOAL_STATS,...(settings.goalStats||{})};

  const goalSessions=sessions.filter(s=>{const d=s.date.slice(0,10);return d>=goal.startDate&&d<=goal.endDate&&!s.isCorrection;});
  const perDay={};
  goalSessions.forEach(s=>{const d=s.date.slice(0,10);perDay[d]=(perDay[d]||0)+getSessionPageEquiv(s);});

  let completed=0;
  if(goal.type==="pages")completed=Object.values(perDay).reduce((a,b)=>a+b,0);
  else completed=books.filter(b=>{const dates=getBookDates(b,sessions);return dates.finishedAt&&dates.finishedAt>=goal.startDate&&dates.finishedAt<=goal.endDate;}).length;

  const percent=goal.target>0?Math.min(100,Math.round((completed/goal.target)*100)):0;
  const timePercent=Math.min(100,Math.round((elapsedDays/totalDays)*100));
  const remaining=Math.max(0,goal.target-completed);
  const overallRate=elapsedDays>0?completed/elapsedDays:0;
  const goalRate=goal.target/totalDays;
  const neededRate=remainingDays>0?remaining/remainingDays:Infinity;
  const aheadBy=goal.target>0?(completed/goal.target)-(elapsedDays/totalDays):0;
  const onTrack=aheadBy>=-0.05;
  const statusLabel=aheadBy>=0.1?"Ahead of|Schedule":onTrack?"On|Track":"Behind|Schedule";
  const statusColor=aheadBy>=0.1?C.green:onTrack?C.accent:C.red;

  const last7Start=new Date(now.getTime()-7*86400000).toISOString().slice(0,10);
  const prior7Start=new Date(now.getTime()-14*86400000).toISOString().slice(0,10);
  const last7Total=goalSessions.filter(s=>s.date.slice(0,10)>=last7Start).reduce((s,x)=>s+getSessionPageEquiv(x),0);
  const prior7Total=goalSessions.filter(s=>s.date.slice(0,10)>=prior7Start&&s.date.slice(0,10)<last7Start).reduce((s,x)=>s+getSessionPageEquiv(x),0);

  const getWeekKey=ds=>{const d=new Date(ds),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1);return new Date(new Date(ds).setDate(diff)).toISOString().slice(0,10);};
  const weeklyTotals={};
  Object.entries(perDay).forEach(([d,v])=>{const wk=getWeekKey(d);weeklyTotals[wk]=(weeklyTotals[wk]||0)+v;});
  const weekValues=Object.values(weeklyTotals);
  const bestWeek=weekValues.length?Math.max(...weekValues):0;
  const worstWeek=weekValues.length?Math.min(...weekValues):0;
  const avgWeekly=weekValues.length?Math.round(weekValues.reduce((a,b)=>a+b,0)/weekValues.length):0;
  const sessPerWeek=weekValues.length?(goalSessions.length/weekValues.length).toFixed(1):"-";
  const bestWeekDate=Object.entries(weeklyTotals).find(([,v])=>v===bestWeek)?.[0];
  const worstWeekDate=Object.entries(weeklyTotals).find(([,v])=>v===worstWeek)?.[0];

  const sessionDeltas=goalSessions.map(s=>getSessionPageEquiv(s)).filter(d=>d>0);
  const avgSession=sessionDeltas.length?Math.round(sessionDeltas.reduce((a,b)=>a+b,0)/sessionDeltas.length):0;
  const sortedD=[...sessionDeltas].sort((a,b)=>a-b);
  const medianSession=sortedD.length?sortedD[Math.floor(sortedD.length/2)]:0;
  const longestSession=sessionDeltas.length?Math.max(...sessionDeltas):0;
  const longestSessionDate=goalSessions.find(s=>getSessionPageEquiv(s)===longestSession)?.date?.slice(0,10);

  const dowTotals=[0,0,0,0,0,0,0];
  goalSessions.forEach(s=>{dowTotals[new Date(s.date.slice(0,10)).getDay()]+=getSessionPageEquiv(s);});
  const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const mostProductiveDow=dowTotals.indexOf(Math.max(...dowTotals));

  const activeDaySet=new Set(Object.keys(perDay).filter(d=>perDay[d]>0));
  let longestStreak=0,tempStreak=0,curStreak=0;
  const endD=new Date(Math.min(end,now));
  for(let d=new Date(start);d<=endD;d.setDate(d.getDate()+1)){
    const ds=d.toISOString().slice(0,10);
    if(activeDaySet.has(ds)){tempStreak++;longestStreak=Math.max(longestStreak,tempStreak);}else tempStreak=0;
  }
  for(let d=new Date(now),i=0;i<400;d.setDate(d.getDate()-1),i++){
    const ds=d.toISOString().slice(0,10);
    if(ds<goal.startDate)break;
    if(activeDaySet.has(ds))curStreak++;else break;
  }
  const totalElapsedInt=Math.floor(elapsedDays);
  const zeroDays=Math.max(0,totalElapsedInt-activeDaySet.size);
  const consistencyScore=totalElapsedInt>0?Math.round((activeDaySet.size/totalElapsedInt)*100):0;
  const avgPerActiveDay=activeDaySet.size>0?Math.round(completed/activeDaySet.size):0;

  const daysToFinish=overallRate>0?remaining/overallRate:null;
  const projFinish=daysToFinish!==null?new Date(now.getTime()+daysToFinish*86400000).toISOString().slice(0,10):null;
  const earlyLate=projFinish?Math.round((end-new Date(projFinish))/86400000):null;
  const projEndTotal=overallRate*totalDays;
  const projEndPct=goal.target>0?Math.min(200,Math.round((projEndTotal/goal.target)*100)):0;
  const minDailyNeeded=remainingDays>0?(remaining/remainingDays).toFixed(1):"0";
  const momentumRatio=prior7Total>0?last7Total/prior7Total:(last7Total>0?2:1);
  const momentum=momentumRatio>=1.1?"Increasing":momentumRatio<=0.9?"Declining":"Flat";
  const momentumColor=momentumRatio>=1.1?C.green:momentumRatio<=0.9?C.red:C.muted;
  const confidence=goalSessions.length>=15&&consistencyScore>=50?"High":goalSessions.length>=5?"Medium":"Low";
  const confColor=confidence==="High"?C.green:confidence==="Medium"?C.accent:C.red;
  const healthColor=aheadBy>=0.1?C.green:aheadBy<-0.2?C.red:C.accent;

  const finishedInGoal=books.filter(b=>{const dates=getBookDates(b,sessions);return dates.finishedAt&&dates.finishedAt>=goal.startDate&&dates.finishedAt<=goal.endDate;});
  const bookFinishTimes=finishedInGoal.map(b=>{const dates=getBookDates(b,sessions);return{book:b,days:dates.startedAt&&dates.finishedAt?Math.round((new Date(dates.finishedAt)-new Date(dates.startedAt))/86400000):null};}).filter(x=>x.days!==null).sort((a,b)=>a.days-b.days);
  const fastestBook=bookFinishTimes[0],slowestBook=bookFinishTimes[bookFinishTimes.length-1];
  const printPages=goalSessions.filter(s=>books.find(b=>b.id===s.bookId)?.format==="paged").reduce((sum,s)=>sum+getSessionPageEquiv(s),0);
  const printPct=completed>0?Math.round((printPages/completed)*100):0;
  const genreCounts={};
  finishedInGoal.forEach(b=>{if(b.genre)genreCounts[b.genre]=(genreCounts[b.genre]||0)+1;});
  const genreEntries=Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]);
  const top3Days=Object.entries(perDay).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const sortedUniqueDates=[...new Set(goalSessions.map(s=>s.date.slice(0,10)))].sort();
  let longestGap=0;
  for(let i=1;i<sortedUniqueDates.length;i++){const gap=Math.round((new Date(sortedUniqueDates[i])-new Date(sortedUniqueDates[i-1]))/86400000);if(gap>longestGap)longestGap=gap;}

  const RateCard=(label,rate,color)=>(
    <FlipCard height={104}
      front={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>{label}</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:24,color,lineHeight:1}}>{isFinite(rate)?rate.toFixed(1):"-"}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{unit}/day</div></>}
      back={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>{label}</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:24,color,lineHeight:1}}>{isFinite(rate)?Math.round(rate*7):"-"}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{unit}/week</div></>}
    />
  );

  return(
    <div>
      {/* -- CORE METRICS -- */}
      {gs.showCoreMetrics!==false&&(
        <>
          <div style={{display:"flex",gap:20,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <DualDonut outerPct={percent} innerPct={timePercent} statusLabel={statusLabel} statusColor={statusColor} size={180}/>
            {/* Ring legend */}
            <div style={{display:"flex",flexDirection:"column",gap:6,minWidth:140}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:C.accent,flexShrink:0}}/>
                <div><div style={{fontSize:12,color:C.text,fontWeight:600}}>{percent}% of {unit}</div><div style={{fontSize:11,color:C.muted}}>Goal Progress</div></div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:12,height:12,borderRadius:"50%",background:C.blue,flexShrink:0}}/>
                <div><div style={{fontSize:12,color:C.text,fontWeight:600}}>{timePercent}% of time</div><div style={{fontSize:11,color:C.muted}}>Time Elapsed</div></div>
              </div>
            </div>
            <div style={{flex:1,minWidth:200,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <StatCard label="Done" value={completed} sub={`of ${goal.target} ${unit}`}/>
              <FlipCard height={94}
                front={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Remaining</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:22,color:C.muted,lineHeight:1}}>{remaining}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{unit} left</div></>}
                back={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Remaining</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:22,color:C.blue,lineHeight:1}}>{Math.round(remainingDays)}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>days left</div></>}
              />
              <div style={{gridColumn:"1/-1",background:healthColor+"18",border:`1px solid ${healthColor}40`,borderRadius:6,padding:"12px 14px"}}>
                <div style={{fontSize:12,color:healthColor,fontFamily:"'Newsreader Variable',serif",lineHeight:1.4}}>
                  {librarianSays(aheadBy,consistencyScore,goal.id)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* -- RATE CARDS -- */}
      {gs.showRateStats!==false&&goalSessions.length>0&&(
        <>
          <SectionHead>Rate & Sessions <span style={{fontStyle:"italic",textTransform:"none",letterSpacing:0,fontSize:10}}>click cards to flip day/week</span></SectionHead>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:12}}>
            {RateCard("Current Rate (7d)",last7Total/7,C.accent)}
            {RateCard("Goal Rate",goalRate,C.blue)}
            {RateCard("Needed Rate",neededRate,neededRate<=overallRate?C.green:C.red)}
            <FlipCard height={104}
              front={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Avg Session</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:24,color:C.accent,lineHeight:1}}>{avgSession}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{unit}</div></>}
              back={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Median Session</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:24,color:C.accent,lineHeight:1}}>{medianSession}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{unit}</div></>}
            />
            <FlipCard height={104}
              front={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Best Week</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:24,color:C.green,lineHeight:1}}>{bestWeek}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{bestWeekDate||"-"}</div></>}
              back={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Worst Week</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:24,color:C.red,lineHeight:1}}>{worstWeek}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{worstWeekDate||"-"}</div></>}
            />
            <StatCard label="Avg Weekly" value={avgWeekly} sub={`${sessPerWeek} sess/wk`}/>
            <StatCard label="Longest Session" value={longestSession} sub={longestSessionDate||"-"}/>
          </div>
        </>
      )}

      {/* -- PROJECTIONS -- */}
      {gs.showProjections!==false&&(
        <>
          <SectionHead>Projections & Forecast</SectionHead>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:10}}>
            <StatCard label="Confidence" value={confidence} sub={`${goalSessions.length} sessions`} color={confColor}/>
            <StatCard label="Momentum" value={momentum} color={momentumColor}/>
            <StatCard label="Projected End %" value={`${projEndPct}%`} sub="at current rate" color={projEndPct>=100?C.green:C.red}/>
            <StatCard label="Min Daily Needed" value={minDailyNeeded} sub={`${unit}/day from today`} color={parseFloat(minDailyNeeded)<=overallRate?C.green:C.red}/>
          </div>
          {projFinish&&(
            <div style={{background:onTrack?C.green+"15":C.red+"15",border:`1px solid ${onTrack?C.green:C.red}40`,borderRadius:6,padding:14,marginBottom:10}}>
              <div style={{fontSize:13,color:onTrack?C.green:C.red,fontWeight:600}}>{onTrack?"On Track":"Behind Pace"}</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>At current pace: <span style={{color:C.text}}>{projFinish}</span>{earlyLate!==null&&<span style={{color:earlyLate>=0?C.green:C.red,marginLeft:6}}>({earlyLate>=0?`${earlyLate}d early`:`${Math.abs(earlyLate)}d late`})</span>}</div>
            </div>
          )}
          {/* Cumulative Line Chart */}
          {goalSessions.length>=2&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:16,marginBottom:10}}>
              <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Cumulative Progress</div>
              <CumulativeLineChart goal={goal} goalSessions={goalSessions} getSessionPageEquiv={getSessionPageEquiv} overallRate={overallRate}/>
            </div>
          )}
          {/* 12-Segment Bar Chart */}
          {totalDays>=12&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:16}}>
              <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Goal Breakdown (12 segments)</div>
              <SegmentBarChart goal={goal} goalSessions={goalSessions} getSessionPageEquiv={getSessionPageEquiv} overallRate={overallRate}/>
            </div>
          )}
        </>
      )}

      {/* -- TIME PATTERNS -- */}
      {gs.showTimePatterns!==false&&goalSessions.length>0&&(
        <>
          <SectionHead>Time Patterns & Streaks</SectionHead>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:10}}>
            <FlipCard height={104}
              front={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Current Streak</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:28,color:C.accent,lineHeight:1}}>{curStreak}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>days</div></>}
              back={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Best Streak</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:28,color:C.green,lineHeight:1}}>{longestStreak}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>days in goal</div></>}
            />
            <FlipCard height={104}
              front={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Consistency</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:28,color:consistencyScore>=60?C.green:consistencyScore>=30?C.accent:C.red,lineHeight:1}}>{consistencyScore}%</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>{activeDaySet.size} of {totalElapsedInt} days</div></>}
              back={<><div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:5}}>Zero Days</div><div style={{fontFamily:"'Newsreader Variable',serif",fontSize:28,color:C.muted,lineHeight:1}}>{zeroDays}</div><div style={{fontSize:12,color:C.muted,marginTop:3}}>days skipped</div></>}
            />
            <StatCard label="Avg/Active Day" value={avgPerActiveDay} sub="days you actually read"/>
            <StatCard label="Best Day of Week" value={DAYS[mostProductiveDow].slice(0,3)} sub={DAYS[mostProductiveDow]} color={C.green}/>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:14,marginBottom:8}}>
            <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Reading by Day of Week</div>
            <DayOfWeekBar totals={dowTotals}/>
          </div>
          {longestGap>1&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:12,fontSize:13,color:C.muted,marginBottom:8}}>Longest gap between sessions: <span style={{color:C.text}}>{longestGap} days</span></div>}
        </>
      )}

      {/* -- BOOK BREAKDOWN -- */}
      {gs.showBookBreakdown!==false&&finishedInGoal.length>0&&(
        <>
          <SectionHead>Book Breakdown</SectionHead>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:10}}>
            <StatCard label="Books Finished" value={finishedInGoal.length} sub="during goal" color={C.green}/>
            {fastestBook&&<StatCard label="Fastest Book" value={`${fastestBook.days}d`} sub={fastestBook.book.title.slice(0,22)} color={C.green}/>}
            {slowestBook&&slowestBook.book.id!==fastestBook?.book.id&&<StatCard label="Slowest Book" value={`${slowestBook.days}d`} sub={slowestBook.book.title.slice(0,22)} color={C.muted}/>}
            {completed>0&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:14}}>
                <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>Print vs Audio</div>
                <div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:6}}>
                  <div style={{height:"100%",width:`${printPct}%`,background:C.accent,borderRadius:3}}/>
                </div>
                <div style={{fontSize:12,color:C.muted}}><span style={{color:C.accent}}>Print {printPct}%</span> - <span style={{color:C.blue}}>Audio {100-printPct}%</span></div>
              </div>
            )}
          </div>
          {genreEntries.length>1&&(
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:14}}>
              <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:10}}>Genre Distribution</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {genreEntries.map(([g,c])=><div key={g} style={{background:C.accentDim,borderRadius:4,padding:"4px 10px",fontSize:12}}><span style={{color:C.accent}}>{g}</span> <span style={{color:C.muted}}>x{c}</span></div>)}
              </div>
            </div>
          )}
        </>
      )}

      {/* -- HIGHLIGHTS -- */}
      {gs.showMotivation!==false&&top3Days.length>0&&(
        <>
          <SectionHead>Reading Log Highlights</SectionHead>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:16}}>
            <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:12}}>Top 3 Most Productive Days</div>
            {top3Days.map(([date,pages],i)=>(
              <div key={date} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{fontSize:16,width:22,textAlign:"center"}}>{["1","2","3"][i]}</span>
                <span style={{fontSize:13,color:C.muted,width:86,flexShrink:0}}>{date}</span>
                <div style={{flex:1,height:5,background:C.border,borderRadius:2}}>
                  <div style={{height:"100%",width:`${(pages/top3Days[0][1])*100}%`,background:C.accent,borderRadius:2}}/>
                </div>
                <span style={{fontSize:13,color:C.accent,width:64,textAlign:"right",flexShrink:0}}>{pages} {unit.slice(0,2)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Goals Dashboard ---------------------------------------------------------
function getGoalSummary(goal, books, sessions, getSessionPageEquiv) {
  const now = todayStr();
  const start = new Date(goal.startDate);
  const end = new Date(goal.endDate);
  const totalDays = Math.max(1, (end - start) / 86400000);
  const elapsedDays = Math.max(0, Math.min(totalDays, (new Date() - start) / 86400000));
  const goalSessions = sessions.filter(s => {
    const d = s.date.slice(0, 10);
    return d >= goal.startDate && d <= goal.endDate && !s.isCorrection;
  });
  let completed = 0;
  if (goal.type === "pages") {
    completed = goalSessions.reduce((sum, session) => sum + getSessionPageEquiv(session), 0);
  } else {
    completed = books.filter(book => {
      const dates = getBookDates(book, sessions);
      return dates.finishedAt && dates.finishedAt >= goal.startDate && dates.finishedAt <= goal.endDate;
    }).length;
  }
  const percent = goal.target > 0 ? Math.min(100, Math.round((completed / goal.target) * 100)) : 0;
  const timePercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  const aheadBy = goal.target > 0 ? (completed / goal.target) - (elapsedDays / totalDays) : 0;
  const daysLeft = Math.max(0, Math.ceil((end - new Date()) / 86400000));
  return {
    completed,
    percent,
    timePercent,
    remaining: Math.max(0, goal.target - completed),
    unit: goal.type === "pages" ? "pages" : "books",
    isActive: goal.endDate >= now,
    daysLeft,
    status: aheadBy >= 0.1 ? "Ahead" : aheadBy >= -0.05 ? "On track" : "Behind",
    statusColor: aheadBy >= 0.1 ? C.green : aheadBy >= -0.05 ? C.accent : C.red,
  };
}

function GoalPicker({goals,selectedGoal,setSelectedGoal,getGoalSummary,onAddGoal}){
  const now=todayStr();
  const activeGoals=goals.filter(g=>g.endDate>=now);
  const pastGoals=goals.filter(g=>g.endDate<now);
  const GoalRow=({goal,muted=false})=>{
    const summary=getGoalSummary(goal);
    const active=selectedGoal?.id===goal.id;
    return(
      <button className={`bb-goal-row ${active?"is-active":""} ${muted?"is-muted":""}`} onClick={()=>setSelectedGoal(goal)}>
        <span>
          <strong>{goal.name}</strong>
          <small>{summary.completed} of {goal.target} {summary.unit}</small>
        </span>
        <span className="bb-goal-row-percent">{summary.percent}%</span>
      </button>
    );
  };
  return(
    <aside className="bb-goal-picker">
      <div className="bb-panel-heading">
        <div>
          <h3>Goals</h3>
          <p>{goals.length ? `${goals.length} reading plans` : "No plans yet"}</p>
        </div>
        <Btn icon={Plus} onClick={onAddGoal}>New</Btn>
      </div>
      <button className={`bb-goal-row ${!selectedGoal?"is-active":""}`} onClick={()=>setSelectedGoal(null)}>
        <span>
          <strong>All goals</strong>
          <small>Overview and active plans</small>
        </span>
      </button>
      {activeGoals.length>0&&<div className="bb-goal-group-label">Active</div>}
      {activeGoals.map(goal=><GoalRow key={goal.id} goal={goal}/>)}
      {pastGoals.length>0&&<div className="bb-goal-group-label">Past</div>}
      {pastGoals.map(goal=><GoalRow key={goal.id} goal={goal} muted/>)}
    </aside>
  );
}

function GoalOverview({goals,books,sessions,getGoalSummary,onSelectGoal,onAddGoal}){
  const activeGoals=goals.filter(goal=>getGoalSummary(goal).isActive);
  const finishedBooks=books.filter(b=>getBookStatus(b,sessions)==="finished").length;
  const avgProgress=goals.length?Math.round(goals.reduce((sum,goal)=>sum+getGoalSummary(goal).percent,0)/goals.length):0;
  return(
    <section className="bb-goal-overview">
      <div className="bb-page-head bb-page-head-compact">
        <div>
          <p className="bb-kicker">Goals Dashboard</p>
          <h2>Your reading plans, separated from settings.</h2>
          <p>Track pace, confidence, and book momentum without digging through preferences.</p>
        </div>
        <Btn icon={Plus} onClick={onAddGoal}>New goal</Btn>
      </div>
      <div className="bb-overview-grid">
        <StatCard label="Active goals" value={activeGoals.length}/>
        <StatCard label="Average progress" value={`${avgProgress}%`}/>
        <StatCard label="Finished books" value={finishedBooks}/>
        <StatCard label="Total sessions" value={sessions.length}/>
      </div>
      {goals.length===0?(
        <div className="bb-empty-state">
          <Target size={42} weight="duotone"/>
          <h3>Set a reading goal</h3>
          <p>Choose pages or finished books, add a date range, and the dashboard will track pace automatically.</p>
          <Btn icon={Plus} onClick={onAddGoal}>Create goal</Btn>
        </div>
      ):(
        <div className="bb-goal-card-grid">
          {goals.map(goal=>{
            const summary=getGoalSummary(goal);
            return(
              <button key={goal.id} className="bb-goal-summary-card" onClick={()=>onSelectGoal(goal)}>
                <div>
                  <span className="bb-status-chip" style={{color:summary.statusColor,borderColor:summary.statusColor+"55",background:summary.statusColor+"12"}}>{summary.status}</span>
                  <h3>{goal.name}</h3>
                  <p>{goal.startDate} to {goal.endDate}</p>
                </div>
                <div className="bb-goal-card-meter">
                  <strong>{summary.percent}%</strong>
                  <ProgressBar percent={summary.percent} h={7}/>
                  <span>{summary.completed} of {goal.target} {summary.unit}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function GoalDetailPanel({goal,books,sessions,settings,getSessionPageEquiv,onEditGoal,onDeleteGoal}){
  const[confirmId,setConfirmId]=useState(null);
  const summary=getGoalSummary(goal,books,sessions,getSessionPageEquiv);
  return(
    <section className="bb-goal-detail">
      <div className="bb-goal-detail-head">
        <div>
          <span className="bb-status-chip" style={{color:summary.statusColor,borderColor:summary.statusColor+"55",background:summary.statusColor+"12"}}>{summary.status}</span>
          <h2>{goal.name}</h2>
          <p>{goal.startDate} to {goal.endDate}. Target: {goal.target} {summary.unit}.</p>
        </div>
        <div className="bb-action-row">
          <Btn variant="ghost" icon={PencilSimple} onClick={()=>onEditGoal(goal)}>Edit</Btn>
          {confirmId===goal.id?(
            <>
              <Btn variant="danger" icon={Trash} onClick={()=>{onDeleteGoal(goal.id);setConfirmId(null);}}>Delete</Btn>
              <Btn variant="ghost" icon={X} onClick={()=>setConfirmId(null)}>Cancel</Btn>
            </>
          ):<Btn variant="danger" icon={Trash} onClick={()=>setConfirmId(goal.id)}>Delete</Btn>}
        </div>
      </div>
      <div className="bb-overview-grid bb-overview-grid-tight">
        <StatCard label="Progress" value={`${summary.percent}%`} sub={`${summary.completed} of ${goal.target}`}/>
        <StatCard label="Remaining" value={summary.remaining} sub={summary.unit}/>
        <StatCard label="Time elapsed" value={`${summary.timePercent}%`}/>
        <StatCard label="Days left" value={summary.daysLeft}/>
      </div>
      <div className="bb-analytics-shell">
        <GoalAnalytics goal={goal} books={books} sessions={sessions} settings={settings} getSessionPageEquiv={getSessionPageEquiv}/>
      </div>
    </section>
  );
}

function GoalsDashboardPage({goals,books,sessions,settings,selectedGoal,setSelectedGoal,getSessionPageEquiv,onAddGoal,onEditGoal,onDeleteGoal}){
  const summaryForGoal=goal=>getGoalSummary(goal,books,sessions,getSessionPageEquiv);
  return(
    <div className="bb-page-reveal">
      <div className="bb-goals-dashboard">
        <GoalPicker goals={goals} selectedGoal={selectedGoal} setSelectedGoal={setSelectedGoal} getGoalSummary={summaryForGoal} onAddGoal={onAddGoal}/>
        <main className="bb-goal-stage">
          {selectedGoal?(
            <GoalDetailPanel goal={selectedGoal} books={books} sessions={sessions} settings={settings} getSessionPageEquiv={getSessionPageEquiv} onEditGoal={onEditGoal} onDeleteGoal={onDeleteGoal}/>
          ):(
            <GoalOverview goals={goals} books={books} sessions={sessions} getGoalSummary={summaryForGoal} onSelectGoal={setSelectedGoal} onAddGoal={onAddGoal}/>
          )}
        </main>
      </div>
    </div>
  );
}

// --- Settings Page -----------------------------------------------------------
function LibrarySettingsPage({books,sessions,settings,onSettingsChange}){
  const[newGenre,setNewGenre]=useState("");
  const[newTag,setNewTag]=useState("");
  const genres=settings.genres||DEFAULT_GENRES;
  const allTags=settings.tags||DEFAULT_TAGS;
  const gs={...DEFAULT_GOAL_STATS,...(settings.goalStats||{})};
  const toggleStat=key=>onSettingsChange(p=>({...p,goalStats:{...DEFAULT_GOAL_STATS,...(p.goalStats||{}),[key]:!(p.goalStats?.[key]??true)}}));

  const updateGenreColor=(name,color)=>onSettingsChange(p=>({...p,genres:(p.genres||DEFAULT_GENRES).map(g=>g.name===name?{...g,color}:g)}));
  const addGenre=()=>{if(!newGenre.trim()||genres.find(g=>g.name===newGenre.trim()))return;onSettingsChange(p=>({...p,genres:[...(p.genres||DEFAULT_GENRES),{name:newGenre.trim(),color:"#4a3728",font:"'Newsreader Variable',serif"}]}));setNewGenre("");};
  const removeGenre=name=>onSettingsChange(p=>({...p,genres:(p.genres||DEFAULT_GENRES).filter(g=>g.name!==name)}));
  const addTag=()=>{if(!newTag.trim()||allTags.includes(newTag.trim()))return;onSettingsChange(p=>({...p,tags:[...(p.tags||DEFAULT_TAGS),newTag.trim()]}));setNewTag("");};
  const removeTag=tag=>onSettingsChange(p=>({...p,tags:(p.tags||DEFAULT_TAGS).filter(t=>t!==tag)}));

  return(
    <div className="bb-page-reveal">
      <div className="bb-page-head">
        <div>
          <p className="bb-kicker">Settings</p>
          <h2>Tune your library.</h2>
          <p>Reading preferences, goal modules, genres, and tags live here now.</p>
        </div>
      </div>
      <div className="bb-settings-layout">
        <section className="bb-settings-section">
          <div className="bb-panel-title-row"><SlidersHorizontal size={20} weight="duotone"/><h3>Reading preferences</h3></div>
              <Field label={`Pages per Minute (audiobooks) - ${settings.pagesPerMinute}`}>
                <input type="range" min=".5" max="5" step=".5" value={settings.pagesPerMinute} onChange={e=>onSettingsChange(p=>({...p,pagesPerMinute:parseFloat(e.target.value)}))} style={{width:"100%",accentColor:C.accent}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}><span>0.5</span><span>5.0</span></div>
              </Field>
              <Field label={`Projection Window - last ${settings.projectionWindow} days`}>
                <input type="range" min="3" max="30" step="1" value={settings.projectionWindow} onChange={e=>onSettingsChange(p=>({...p,projectionWindow:parseInt(e.target.value)}))} style={{width:"100%",accentColor:C.accent}}/>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted}}><span>3d</span><span>30d</span></div>
              </Field>
        </section>
        <section className="bb-settings-section">
          <div className="bb-panel-title-row"><Target size={20} weight="duotone"/><h3>Goal analytics sections</h3></div>
              {Object.entries(STAT_LABELS).map(([key,label])=>(
                <button key={key} className="bb-toggle-row" onClick={()=>toggleStat(key)}>
                  <span>{label}</span>
                  <span className={`bb-switch ${gs[key]?"is-on":""}`}><span/></span>
                </button>
              ))}
        </section>
        <section className="bb-settings-section">
          <div className="bb-panel-title-row"><Palette size={20} weight="duotone"/><h3>Genres</h3></div>
              <div style={{maxHeight:240,overflowY:"auto",marginBottom:10}}>
                {genres.map(g=>(
                  <div key={g.name} className="bb-edit-row">
                    <input type="color" value={g.color} onChange={e=>updateGenreColor(g.name,e.target.value)} style={{width:24,height:24,borderRadius:4,border:"none",cursor:"pointer",background:"none",padding:0,flexShrink:0}}/>
                    <span style={{flex:1,fontSize:13,color:C.text,fontFamily:g.font}}>{g.name}</span>
                    <button className="bb-icon-button" onClick={()=>removeGenre(g.name)} aria-label={`Remove ${g.name}`}><X size={14}/></button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Input value={newGenre} onChange={e=>setNewGenre(e.target.value)} placeholder="New genre name" onKeyDown={e=>e.key==="Enter"&&addGenre()} style={{flex:1}}/>
                <Btn icon={Plus} onClick={addGenre}>Add</Btn>
              </div>
        </section>
        <section className="bb-settings-section">
          <div className="bb-panel-title-row"><TagIcon size={20} weight="duotone"/><h3>Tags</h3></div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                {allTags.map(t=>(
                  <div key={t} className="bb-tag bb-tag-editable">
                    <span>{t}</span>
                    <button onClick={()=>removeTag(t)} aria-label={`Remove ${t}`}><X size={12}/></button>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Input value={newTag} onChange={e=>setNewTag(e.target.value)} placeholder="New tag" onKeyDown={e=>e.key==="Enter"&&addTag()} style={{flex:1}}/>
                <Btn icon={Plus} onClick={addTag}>Add</Btn>
              </div>
        </section>
        <section className="bb-settings-section bb-settings-section-wide">
          <div className="bb-panel-title-row"><CheckCircle size={20} weight="duotone"/><h3>Library snapshot</h3></div>
          <div className="bb-overview-grid">
            <StatCard label="Total books" value={books.length}/>
            <StatCard label="Finished" value={books.filter(b=>getBookStatus(b,sessions)==="finished").length}/>
            <StatCard label="Reading now" value={books.filter(b=>getBookStatus(b,sessions)==="reading").length}/>
            <StatCard label="Sessions" value={sessions.length}/>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Goal Form Modal ----------------------------------------------------------
function GoalFormModal({initial,onSave,onClose}){
  const[f,setF]=useState({name:"",startDate:todayStr(),endDate:"",type:"pages",target:"",...initial});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const submit=()=>{if(!f.name.trim()||!f.startDate||!f.endDate||!f.target)return alert("All fields required");onSave({...f,target:parseInt(f.target)||0});};
  return(
    <Modal onClose={onClose}>
      <ModalTitle>{initial?"Edit Goal":"New Goal"}</ModalTitle>
      <Field label="Goal Name"><Input value={f.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Summer Reading Challenge"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Field label="Start Date"><Input type="date" value={f.startDate} onChange={e=>set("startDate",e.target.value)}/></Field>
        <Field label="End Date"><Input type="date" value={f.endDate} onChange={e=>set("endDate",e.target.value)}/></Field>
      </div>
      <Field label="Goal Type">
        <div style={{display:"flex",gap:8}}>
          {[["pages","Pages Read"],["books","Books Finished"]].map(([val,lbl])=>(
            <button key={val} onClick={()=>set("type",val)} style={{flex:1,padding:"8px",background:f.type===val?C.accent:C.bg,color:f.type===val?C.bg:C.muted,border:`1px solid ${f.type===val?C.accent:C.border}`,borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontSize:14}}>{lbl}</button>
          ))}
        </div>
      </Field>
      <Field label={f.type==="pages"?"Target Pages":"Target Books"}><Input type="number" min="1" value={f.target} onChange={e=>set("target",e.target.value)} placeholder="e.g. 3000"/></Field>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={submit}>Save Goal</Btn>
      </div>
    </Modal>
  );
}

// --- App ----------------------------------------------------------------------
export default function App(){
  const[user,setUser]=useState(null);
  const[authReady,setAuthReady]=useState(false);
  const[tab,setTab]=useState("bookshelf");
  const[books,setBooks]=useState([]);
  const[sessions,setSessions]=useState([]);
  const[goals,setGoals]=useState([]);
  const[settings,setSettings]=useState({pagesPerMinute:1.5,projectionWindow:14,goalStats:DEFAULT_GOAL_STATS,genres:DEFAULT_GENRES,tags:DEFAULT_TAGS});
  const[loaded,setLoaded]=useState(false);
  const[saveState,setSaveState]=useState("idle");
  const[authError,setAuthError]=useState("");
  const[authBusy,setAuthBusy]=useState(false);
  const saveTimerRef=useRef(null);
  const skipNextSaveRef=useRef(false);
  const[addBookOpen,setAddBookOpen]=useState(false);
  const[editBookData,setEditBookData]=useState(null);
  const[detailBookData,setDetailBookData]=useState(null);
  const[addSessionOpen,setAddSessionOpen]=useState(false);
  const[sessionPrefill,setSessionPrefill]=useState(null);
  const[editSessionData,setEditSessionData]=useState(null);
  const[addGoalOpen,setAddGoalOpen]=useState(false);
  const[editGoalData,setEditGoalData]=useState(null);
  const[selectedGoal,setSelectedGoal]=useState(null);
  const[searchQuery,setSearchQuery]=useState("");
  const[celebrationBook,setCelebrationBook]=useState(null);
  const[showCelebration,setShowCelebration]=useState(false);
  const[editReviewBook,setEditReviewBook]=useState(null);

  useEffect(()=>{
    const unsubscribe=onAuthStateChanged(auth,nextUser=>{
      setUser(nextUser);
      if(nextUser)setAuthError("");
      setAuthReady(true);
    });
    return()=>unsubscribe();
  },[]);

  useEffect(()=>{
    getRedirectResult(auth).catch(error=>setAuthError(formatAuthError(error)));
  },[]);

  const handleGoogleSignIn=async()=>{
    setAuthError("");
    setAuthBusy(true);
    try{
      await signInWithPopup(auth,provider);
    }catch(error){
      if(shouldTryRedirectSignIn(error)){
        setAuthError(formatAuthError(error));
        try{
          await signInWithRedirect(auth,provider);
          return;
        }catch(redirectError){
          setAuthError(formatAuthError(redirectError));
        }
      }else{
        setAuthError(formatAuthError(error));
      }
    }finally{
      setAuthBusy(false);
    }
  };

  useEffect(()=>{
    if(!authReady)return;
    if(!user){
      setLoaded(false);
      setBooks([]);
      setSessions([]);
      setGoals([]);
      setSettings({pagesPerMinute:1.5,projectionWindow:14,goalStats:DEFAULT_GOAL_STATS,genres:DEFAULT_GENRES,tags:DEFAULT_TAGS});
      setSaveState("idle");
      skipNextSaveRef.current=false;
      return;
    }
    let cancelled=false;
    (async()=>{
      try{
        const data=await loadAppData(user.uid);
        if(cancelled)return;
        if(data){
          setBooks(data.books);
          setSessions(data.sessions);
          setGoals(data.goals);
          if(data?.settings)setSettings(p=>({...p,...data.settings}));
          saveLocalCache(user.uid, data);
        } else {
          const local=normalizeAppData(loadLocalCache(user.uid));
          if(local){
            setBooks(local.books);
            setSessions(local.sessions);
            setGoals(local.goals);
            if(local?.settings)setSettings(p=>({...p,...local.settings}));
          }
        }
      }catch(e){
        const local=normalizeAppData(loadLocalCache(user.uid));
        if(local){
          setBooks(local.books);
          setSessions(local.sessions);
          setGoals(local.goals);
          if(local?.settings)setSettings(p=>({...p,...local.settings}));
        }
      }finally{
        if(!cancelled){
          skipNextSaveRef.current=true;
          setLoaded(true);
        }
      }
    })();
    return()=>{cancelled=true;};
  },[authReady,user]);

  useEffect(()=>{
    if(!loaded||!user)return;
    if(skipNextSaveRef.current){
      skipNextSaveRef.current=false;
      return;
    }
    if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveLocalCache(user.uid,{books,sessions,goals,settings});
    saveTimerRef.current=setTimeout(()=>{
      saveAppData(user.uid,{books,sessions,goals,settings})
        .then(()=>setSaveState("saved"))
        .catch(()=>setSaveState("error"));
    },450);
    return()=>{
      if(saveTimerRef.current)clearTimeout(saveTimerRef.current);
    };
  },[books,sessions,goals,settings,loaded,user]);

  const addBook=b=>setBooks(p=>[...p,{...b,id:genId(),createdAt:new Date().toISOString()}]);
  const updateBook=(id,u)=>setBooks(p=>p.map(b=>b.id===id?{...b,...u}:b));
  const deleteBook=id=>{setBooks(p=>p.filter(b=>b.id!==id));setSessions(p=>p.filter(s=>s.bookId!==id));};

  const handleAddSession=s=>{
    const newSessions=[...sessions,{...s,id:genId()}];
    const newlyFinished=books.find(book=>getBookStatus(book,sessions)!=="finished"&&getBookStatus(book,newSessions)==="finished");
    setSessions(newSessions);
    if(newlyFinished){setCelebrationBook(newlyFinished);setShowCelebration(true);playFanfare();}
  };
  const updateSession=(id,u)=>setSessions(p=>p.map(s=>s.id===id?{...s,...u}:s));
  const deleteSession=id=>setSessions(p=>p.filter(s=>s.id!==id));

  const addGoal=g=>setGoals(p=>[...p,{...g,id:genId()}]);
  const updateGoal=(id,u)=>setGoals(p=>p.map(g=>g.id===id?{...g,...u}:g));
  const deleteGoal=id=>{setGoals(p=>p.filter(g=>g.id!==id));if(selectedGoal?.id===id)setSelectedGoal(null);};

  const getProgress=book=>getBookProgress(book,sessions);
  const getSessionDeltaFn=s=>getSessionDelta(s,sessions,books);
  const getSessionPageEquivFn=s=>sessionPageEquiv(s,sessions,books,settings.pagesPerMinute);
  const genres=settings.genres||DEFAULT_GENRES;

  useEffect(()=>{if(selectedGoal){const u=goals.find(g=>g.id===selectedGoal.id);if(u)setSelectedGoal(u);}},[goals]);

  if(!authReady)return(
    <div style={{background:C.bg,height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{fontFamily:"Newsreader Variable, Georgia, serif",fontSize:32,color:C.accent,letterSpacing:"-.03em"}}>Bob's Books</div>
      <div style={{fontSize:14,color:C.muted}}>Checking sign-in...</div>
    </div>
  );

  if(!user)return(
    <div className="bb-auth-shell">
      <div className="bb-auth-card">
        <BookOpenText size={42} weight="duotone"/>
        <div style={{fontFamily:"Newsreader Variable, Georgia, serif",fontSize:34,color:C.accent,letterSpacing:"-.04em",marginBottom:8}}>Bob's Books</div>
        <div style={{fontSize:14,color:C.muted,marginBottom:20}}>Sign in with Google to sync your library with Firebase.</div>
        {authError&&<div className="bb-auth-error" role="alert">{authError}</div>}
        <Btn onClick={handleGoogleSignIn} disabled={authBusy}>{authBusy?"Opening Google...":"Sign in with Google"}</Btn>
      </div>
    </div>
  );

  if(!loaded)return(
    <div style={{background:C.bg,height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{fontFamily:"Newsreader Variable, Georgia, serif",fontSize:32,color:C.accent,letterSpacing:"-.03em"}}>Bob's Books</div>
      <div style={{fontSize:14,color:C.muted}}>Opening your library...</div>
    </div>
  );

  return(
    <div style={{background:C.bg,minHeight:"100dvh",fontFamily:"Plus Jakarta Sans Variable, system-ui, sans-serif",color:C.text,display:"flex",flexDirection:"column",overflowX:"hidden"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        :root{--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px);}
        body{overflow-x:hidden;}
        ::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-track{background:${C.bg};}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
        button{cursor:pointer;}input,textarea,select{font-family:inherit;color:${C.text};}input[type=range]{cursor:pointer;}input[type=color]{cursor:pointer;}
        .bb-header{padding-top:var(--safe-top);}
        .bb-topbar{flex-wrap:wrap;gap:12px;align-items:center;}
        .bb-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
        .bb-search{flex:1 1 220px;min-width:160px;}
        .bb-tabs{flex-wrap:wrap;}
        @media (max-width:820px){
          .bb-topbar{flex-direction:column;align-items:stretch;}
          .bb-actions{width:100%;justify-content:space-between;}
          .bb-search{width:100%;}
        }
        @media (max-width:520px){
          .bb-actions{gap:6px;}
          .bb-tabs button{padding:8px 10px;font-size:12px;}
        }
      `}</style>

      {/* Header */}
      <header className="bb-header" style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 20px",position:"sticky",top:0,zIndex:50}}>
        <div style={{maxWidth:1120,margin:"0 auto"}}>
          <div className="bb-topbar" style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span className="bb-brand-mark"><BookOpenText size={24} weight="duotone"/></span>
              <div>
                <div style={{fontFamily:"Newsreader Variable, Georgia, serif",fontSize:22,color:C.accent,letterSpacing:"-.04em",lineHeight:1}}>Bob's Books</div>
                <div style={{fontSize:10,color:C.muted,letterSpacing:".08em"}}>Personal library</div>
              </div>
            </div>
            <div className="bb-actions" style={{display:"flex",alignItems:"center",gap:8}}>
              <label className="bb-search-wrap">
                <MagnifyingGlass size={16} weight="duotone"/>
                <input className="bb-search" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search books, authors, genres..."/>
              </label>
              <span style={{fontSize:11,color:C.muted,minWidth:68,textAlign:"right"}}>
                {saveState==="saving"?"Saving...":saveState==="saved"?"Saved":saveState==="error"?"Save error":""}
              </span>
              <Btn variant="small" icon={SignOut} onClick={()=>signOut(auth)}>Sign out</Btn>
            </div>
          </div>
          <nav className="bb-tabs" style={{display:"flex",gap:2,marginTop:4}} aria-label="Bob's Books sections">
            {[["bookshelf","Bookshelf",Books],["main","Reading Dashboard",ChartLineUp],["goals","Goals Dashboard",Target],["settings","Settings",GearSix]].map(([t,l,Icon])=>(
              <button key={t} onClick={()=>setTab(t)} className={`bb-tab-button ${tab===t?"is-active":""}`}>
                <Icon size={16} weight="duotone" aria-hidden="true"/>
                <span>{l}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="bb-main" style={{flex:1,padding:"24px 20px",maxWidth:1120,margin:"0 auto",width:"100%"}}>
        {tab==="bookshelf"&&(
          <BookshelfPage books={books} sessions={sessions} genres={genres} searchQuery={searchQuery}
            getProgress={getProgress}
            onAddBook={()=>setAddBookOpen(true)}
            onBookClick={b=>setDetailBookData(b)}
          />
        )}
        {tab==="main"&&(
          <MainPage books={books} sessions={sessions} settings={settings}
            getProgress={getProgress}
            getSessionDelta={getSessionDeltaFn}
            getSessionPageEquiv={getSessionPageEquivFn}
            onAddSession={()=>{setSessionPrefill(null);setAddSessionOpen(true);}}
            onEditSession={setEditSessionData}
            onDeleteSession={deleteSession}
            onBookClick={b=>setDetailBookData(b)}
          />
        )}
        {tab==="goals"&&(
          <GoalsDashboardPage goals={goals} books={books} sessions={sessions} settings={settings}
            selectedGoal={selectedGoal} setSelectedGoal={setSelectedGoal}
            getSessionPageEquiv={getSessionPageEquivFn}
            onAddGoal={()=>setAddGoalOpen(true)}
            onEditGoal={setEditGoalData}
            onDeleteGoal={deleteGoal}
          />
        )}
        {tab==="settings"&&(
          <LibrarySettingsPage books={books} sessions={sessions} settings={settings} onSettingsChange={setSettings}/>
        )}
      </main>

      {/* Modals */}
      {addBookOpen&&<BookFormModal title="Add Book" settings={settings} onSave={b=>{addBook(b);setAddBookOpen(false);}} onClose={()=>setAddBookOpen(false)}/>}
      {editBookData&&<BookFormModal title="Edit Book" initial={editBookData} settings={settings} onSave={b=>{updateBook(editBookData.id,b);setEditBookData(null);}} onClose={()=>setEditBookData(null)}/>}
      {detailBookData&&(
        <BookDetailModal
          book={books.find(b=>b.id===detailBookData.id)||detailBookData}
          sessions={sessions} settings={settings} genres={genres} getProgress={getProgress}
          onClose={()=>setDetailBookData(null)}
          onEdit={b=>{setEditBookData(b);setDetailBookData(null);}}
          onDelete={b=>{deleteBook(b.id);setDetailBookData(null);}}
          onAddSession={b=>{setSessionPrefill(b);setDetailBookData(null);setAddSessionOpen(true);}}
          onEditSession={setEditSessionData}
          onDeleteSession={deleteSession}
          onEditReview={()=>{setEditReviewBook(books.find(b=>b.id===detailBookData.id)||detailBookData);setDetailBookData(null);}}
        />
      )}
      {editReviewBook&&(
        <FinishCelebrationModal
          book={editReviewBook} sessions={sessions} genres={genres}
          onSave={({rating,review})=>{updateBook(editReviewBook.id,{rating,review});setEditReviewBook(null);}}
          onSkip={()=>setEditReviewBook(null)}
        />
      )}
      {addSessionOpen&&(
        <SessionFormModal books={books} prefillBook={sessionPrefill} sessions={sessions}
          onSave={s=>{handleAddSession(s);setAddSessionOpen(false);setSessionPrefill(null);}}
          onClose={()=>{setAddSessionOpen(false);setSessionPrefill(null);}}
        />
      )}
      {editSessionData&&(
        <SessionFormModal books={books} initial={editSessionData} sessions={sessions}
          onSave={s=>{updateSession(editSessionData.id,s);setEditSessionData(null);}}
          onClose={()=>setEditSessionData(null)}
        />
      )}
      {addGoalOpen&&<GoalFormModal onSave={g=>{addGoal(g);setAddGoalOpen(false);}} onClose={()=>setAddGoalOpen(false)}/>}
      {editGoalData&&<GoalFormModal initial={editGoalData} onSave={g=>{updateGoal(editGoalData.id,g);setEditGoalData(null);}} onClose={()=>setEditGoalData(null)}/>}

      {/* Celebration */}
      {showCelebration&&celebrationBook&&(
        <>
          <Confetti onDone={()=>{}}/>
          <FinishCelebrationModal
            book={celebrationBook} sessions={sessions} genres={genres}
            onSave={({rating,review})=>{updateBook(celebrationBook.id,{rating,review});setShowCelebration(false);setCelebrationBook(null);}}
            onSkip={()=>{setShowCelebration(false);setCelebrationBook(null);}}
          />
        </>
      )}
    </div>
  );
}
