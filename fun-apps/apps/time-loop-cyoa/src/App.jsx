import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { APP_VERSION, BUILD_DATE } from "./version";

/* ═══ CSS ═══════════════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Cinzel:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#c4903a44;border-radius:2px}
::selection{background:#c4903a33;color:#f5e6c8}
textarea,input,select{font-family:inherit;outline:none}
button{cursor:pointer;font-family:inherit;border:none;background:none}
@keyframes glow{0%,100%{text-shadow:0 0 20px #c4903a44}50%{text-shadow:0 0 40px #c4903a88,0 0 80px #c4903a22}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}
@keyframes strikeIn{from{width:0}to{width:100%}}
`;

/* ═══ CONSTANTS ══════════════════════════════════════════════════════════ */
const PASSWORD    = "P4t4t0z";
const DAY         = 86400000;
const D           = ago => Date.now() - ago * DAY;
const NW = 172, NH = 82, MINI = 30, MINI_ZOOM = 0.52;

const C = {
  bg:'#08080f', bg2:'#0e0d1a', bg3:'#141228',
  text:'#e2d5bc', textDim:'#8a7d68', textFaint:'#4a4438',
  gold:'#c4903a', goldDim:'#8a6428',
  rose:'#bf5b7a', green:'#4a9c72', blue:'#5b7fbf', purple:'#9b72bf',
  border:'rgba(255,255,255,0.07)',
};
const IST = {
  width:'100%', background:'rgba(255,255,255,0.05)',
  border:'1px solid rgba(255,255,255,0.1)', borderRadius:5,
  padding:'9px 12px', color:C.text, fontSize:14,
  fontFamily:"'Cormorant Garamond',serif", lineHeight:1.5,
};
const AUTHORS       = ['Birkley','Bray'];
const AUTHOR_COLORS = [C.gold, C.purple];
const TYPE_META = {
  start:  { color:'#4a9c72', label:'Start',  icon:'◆', desc:'The single entry point. There should be exactly one.' },
  scene:  { color:'#5b7fbf', label:'Scene',  icon:'◇', desc:'A moment or conversation — the main building blocks.' },
  hub:    { color:'#9b72bf', label:'Hub',    icon:'⬡', desc:'A convergence point where many paths meet.' },
  anchor: { color:'#c4903a', label:'Anchor', icon:'⊕', desc:'A narrative inevitability — must happen in some form.' },
  ending: { color:'#bf5b7a', label:'Ending', icon:'★', desc:'A terminal scene. Loops back to Page 1.' },
};
const LOOP_LBL    = { childBorn:'Child Born', clueLeft:'Clue Left', deathOccurred:'Death', loopRestarts:'Loop Restarts' };
const ALL_TAGS    = ['start','present_day','past','clue','machine','bertha','birth','marriage','death','loop','hub','anchor','escape','prophecy','cult'];
const ENDING_CATS = ["Become Part of the Loop","Alternative Escapes","Birth Bertha's Child","Marry Bertha","Do Not Marry Bertha","Train Yourself"];

/* ═══ HELPERS ════════════════════════════════════════════════════════════ */
const toRoman = n => {
  const r=[['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]];
  return r.reduce((s,[l,v])=>{while(n>=v){s+=l;n-=v;}return s;},'');
};
const renderText = t => t.split('\n\n').map((p,i)=><p key={i} style={{marginBottom:'1.4em',lineHeight:'1.75'}}>{p}</p>);
const fmtDate    = ts => new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'});
const dayKey     = ts => Math.floor(ts/DAY);
const wordCount  = t => (t||'').trim().split(/\s+/).filter(Boolean).length;
const getNodeText = node => {
  if (!node) return '';
  if (node.isMultiPage && Array.isArray(node.pages) && node.pages.length > 0) {
    return node.pages.map(p => (p?.text || '')).filter(Boolean).join('\n\n');
  }
  return node.text || '';
};
const normalizeNode = node => {
  if (!node) return node;
  return {
    ...node,
    choices: Array.isArray(node.choices) ? node.choices : [],
    tags: Array.isArray(node.tags) ? node.tags : [],
    position: node.position || { x: 0, y: 0 },
    isMultiPage: !!node.isMultiPage,
    pages: Array.isArray(node.pages) ? node.pages : [],
  };
};
const mkPage = (text = '', buttonLabel = 'Continue') => ({
  id: `p_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
  text,
  buttonLabel,
});
const stripUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined).filter((v) => v !== undefined);
  }
  if (value && typeof value === 'object') {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      if (v === undefined) return;
      out[k] = stripUndefined(v);
    });
    return out;
  }
  return value;
};

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(()=>fallbackCopy(text));
  } else { fallbackCopy(text); }
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText='position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch(_){}
  document.body.removeChild(ta);
}

/* ═══ STORY DATA ═════════════════════════════════════════════════════════ */
const STORY_SEED = {
  start:{ id:"start", title:"The Same Morning", type:"start", isStart:true, isEnding:false, createdAt:D(21), createdBy:"Vera",
    text:"The light through the curtains is the same light. The smell of coal smoke and damp stone is the same smell. Your hands, folded on the blanket, are older than you remember.\n\nThe date on the wall calendar stops your breath.\n\nYou have been here before.",
    choices:[{id:"c1",text:"Read the calendar more carefully",nextNodeId:"calendar"},{id:"c2",text:"Check under the floorboard",nextNodeId:"floorboard"},{id:"c3",text:"Go out into the street",nextNodeId:"street"}], tags:["start","present_day"], notes:"Opening node.", position:{x:340,y:40} },
  calendar:{ id:"calendar", title:"October 14th, Again", type:"scene", isStart:false, isEnding:false, createdAt:D(21), createdBy:"Jasper",
    text:"The year is wrong. It cannot be this year.\n\nIn the margin, in your own handwriting, someone has written: Find her first.",
    choices:[{id:"c1",text:"Go find Bertha",nextNodeId:"find_bertha"},{id:"c2",text:"Go to the machine in the basement",nextNodeId:"machine"}], tags:["clue","present_day"], notes:"", position:{x:100,y:210} },
  floorboard:{ id:"floorboard", title:"What You Left Yourself", type:"scene", isStart:false, isEnding:false, createdAt:D(20), createdBy:"Vera",
    text:"Under the loose board: a small tin. Inside: a photograph, a letter, and a brass key.\n\nThe letter says only: This time, don't go to the machine. Go to her instead. She is ready now.",
    choices:[{id:"c1",text:"Follow the letter — find Bertha",nextNodeId:"find_bertha"},{id:"c2",text:"Ignore it and go to the machine",nextNodeId:"machine"},{id:"c3",text:"Try the brass key on the locked door",nextNodeId:"locked_door"}], tags:["clue","hub","present_day"], notes:"Key branching hub.", position:{x:340,y:210} },
  street:{ id:"street", title:"The Empty Street", type:"scene", isStart:false, isEnding:false, createdAt:D(20), createdBy:"Jasper",
    text:"Only one figure stands at the far end: a woman in grey, watching you with an expression that might be recognition or grief.",
    choices:[{id:"c1",text:"Approach her",nextNodeId:"find_bertha"},{id:"c2",text:"Go back inside",nextNodeId:"floorboard"}], tags:["bertha","present_day"], notes:"", position:{x:580,y:210} },
  find_bertha:{ id:"find_bertha", title:"Bertha", type:"hub", isStart:false, isEnding:false, createdAt:D(17), createdBy:"Vera",
    text:"She is sitting on the low stone wall behind the church, waiting.\n\n\"You're earlier this time,\" she says. \"That's good. Last time you were too late.\"",
    choices:[{id:"c1",text:"Ask her: what do you know?",nextNodeId:"bertha_knows"},{id:"c2",text:"Ask her: how many times?",nextNodeId:"bertha_count"},{id:"c3",text:"Tell her: I think the loop can be broken",nextNodeId:"break_attempt"}], tags:["bertha","hub","anchor"], notes:"Central Bertha hub.", position:{x:220,y:390} },
  bertha_count:{ id:"bertha_count", title:"Uncountable", type:"scene", isStart:false, isEnding:false, createdAt:D(17), createdBy:"Jasper",
    text:"\"I stopped counting after forty,\" she says. \"You can survive anything if you stop asking how many times.\"",
    choices:[{id:"c1",text:"Listen — let her tell you everything",nextNodeId:"bertha_knows"}], tags:["bertha"], notes:"", position:{x:80,y:560} },
  bertha_knows:{ id:"bertha_knows", title:"What She Carries", type:"scene", isStart:false, isEnding:false, createdAt:D(16), createdBy:"Vera",
    text:"\"I know that I am the hinge. My child. The child I have not yet had.\"\n\nShe takes your hand.\n\n\"Help me make her. Or help me stop her.\"",
    choices:[{id:"c1",text:"Help her — stay and raise the child together",nextNodeId:"ending_loop_continues"},{id:"c2",text:"Stop the loop — go to the machine",nextNodeId:"machine"}], tags:["bertha","anchor","birth"], notes:"", position:{x:220,y:560} },
  machine:{ id:"machine", title:"The Basement", type:"anchor", isStart:false, isEnding:false, createdAt:D(10), createdBy:"Jasper",
    text:"The machine is already running.\n\nIt is always already running.\n\nYou understand the basics: it folds time. Tonight, you are here first.",
    choices:[{id:"c1",text:"Destroy it — finally, completely",nextNodeId:"ending_machine_destroyed"},{id:"c2",text:"Study the engravings before you act",nextNodeId:"study_machine"},{id:"c3",text:"Wait in the dark for whoever is coming",nextNodeId:"wait_machine"}], tags:["machine","anchor","hub"], notes:"Machine hub.", position:{x:580,y:390} },
  study_machine:{ id:"study_machine", title:"The Language of Loops", type:"scene", isStart:false, isEnding:false, createdAt:D(9), createdBy:"Vera",
    text:"It was not built to trap you. It was built to protect you. By someone who loved you very much.",
    choices:[{id:"c1",text:"Return to Bertha — you finally understand",nextNodeId:"bertha_knows"},{id:"c2",text:"Destroy the machine anyway",nextNodeId:"ending_machine_destroyed"}], tags:["machine","clue"], notes:"", position:{x:760,y:560} },
  wait_machine:{ id:"wait_machine", title:"In the Dark", type:"scene", isStart:false, isEnding:false, createdAt:D(9), createdBy:"Jasper",
    text:"The door opens. A child steps in and places her hand flat against the panel.\n\n\"You're supposed to go back upstairs. It's not your turn yet.\"",
    choices:[{id:"c1",text:"Ask her who she is",nextNodeId:"ending_the_child"},{id:"c2",text:"Go back upstairs, as she says",nextNodeId:"find_bertha"}], tags:["machine","birth","anchor"], notes:"The child appears.", position:{x:580,y:560} },
  locked_door:{ id:"locked_door", title:"The Other Room", type:"scene", isStart:false, isEnding:false, createdAt:D(10), createdBy:"Vera",
    text:"Notebooks, all in your handwriting. The last entry: She is pregnant. That's why the loop runs.",
    choices:[{id:"c1",text:"Go to Bertha immediately",nextNodeId:"break_attempt"},{id:"c2",text:"Read more notebooks",nextNodeId:"read_notebooks"}], tags:["clue","birth","anchor"], notes:"Brass key path.", position:{x:580,y:300} },
  read_notebooks:{ id:"read_notebooks", title:"A Century of Mornings", type:"scene", isStart:false, isEnding:false, createdAt:D(8), createdBy:"Vera",
    text:"The loop is not a trap. The loop is a library. You built it yourself. You are building it still.",
    choices:[{id:"c1",text:"Go to Bertha — with everything you've learned",nextNodeId:"break_attempt"}], tags:["clue","anchor"], notes:"", position:{x:760,y:390} },
  break_attempt:{ id:"break_attempt", title:"What You Tell Her", type:"anchor", isStart:false, isEnding:false, createdAt:D(2), createdBy:"Vera",
    text:"\"You built a time loop to protect me.\"\n\n\"I think so. Or I will. Or I did. The tense doesn't hold.\"\n\n\"So what are we choosing between?\"",
    choices:[{id:"c1",text:"Accept it — live inside the loop, raise the child",nextNodeId:"ending_loop_continues"},{id:"c2",text:"Refuse — let this one day end for good",nextNodeId:"ending_the_farewell"}], tags:["bertha","anchor","birth"], notes:"Climactic choice.", position:{x:340,y:700} },
  ending_loop_continues:{ id:"ending_loop_continues", title:"The Caretakers", type:"ending", isStart:false, isEnding:true, createdAt:D(1), createdBy:"Vera",
    text:"You stay. The child is born in June. She has your eyes and Bertha's patience.\n\n\"She's maintaining the machine,\" Bertha says one evening.\n\nThe loop continues. This was always its purpose.",
    choices:[], tags:["ending","birth","loop"], notes:"", position:{x:100,y:880},
    endingData:{ endingNumber:1, endingTitle:"The Caretakers", endingCategory:"Become Part of the Loop", summary:"You accept the loop and raise the child who maintains it.", loopConditions:{childBorn:true,clueLeft:true,deathOccurred:false,loopRestarts:true} } },
  ending_machine_destroyed:{ id:"ending_machine_destroyed", title:"After the Fire", type:"ending", isStart:false, isEnding:true, createdAt:D(1), createdBy:"Jasper",
    text:"The machine burns. The world lurches.\n\nSomething older is keeping you here now.",
    choices:[], tags:["ending","machine","loop"], notes:"", position:{x:620,y:880},
    endingData:{ endingNumber:2, endingTitle:"After the Fire", endingCategory:"Alternative Escapes", summary:"You destroy the machine — but the loop continues anyway.", loopConditions:{childBorn:false,clueLeft:false,deathOccurred:false,loopRestarts:true} } },
  ending_the_child:{ id:"ending_the_child", title:"Father", type:"ending", isStart:false, isEnding:true, createdAt:D(0), createdBy:"Vera",
    text:"\"I'm your daughter. My name is the name you chose. You haven't chosen it yet.\"\n\n\"Go back upstairs, Papa. The morning's almost ready.\"",
    choices:[], tags:["ending","birth","loop"], notes:"", position:{x:480,y:880},
    endingData:{ endingNumber:3, endingTitle:"Father", endingCategory:"Birth Bertha's Child", summary:"You meet your daughter in the basement.", loopConditions:{childBorn:true,clueLeft:false,deathOccurred:false,loopRestarts:true} } },
  ending_the_farewell:{ id:"ending_the_farewell", title:"One Last Morning", type:"ending", isStart:false, isEnding:true, createdAt:D(0), createdBy:"Jasper",
    text:"Together, you turn it off.\n\nThe morning comes.\n\nIt is new.",
    choices:[], tags:["ending","bertha","escape"], notes:"", position:{x:280,y:880},
    endingData:{ endingNumber:4, endingTitle:"One Last Morning", endingCategory:"Do Not Marry Bertha", summary:"You and Bertha end the loop together.", loopConditions:{childBorn:false,clueLeft:false,deathOccurred:false,loopRestarts:false} } },
};

const AUTHOR_REMAP = {
  Vera: "Birkley",
  Jasper: "Bray",
};

const NODES_COL = collection(db, "time-loop-cyoa-nodes");

/* ═══ SHARED COMPONENTS (top-level to avoid remount) ════════════════════ */
function Field({ label, children }) {
  return (
    <div style={{marginBottom:20}}>
      <label style={{display:'block',fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:'0.2em',color:C.textDim,textTransform:'uppercase',marginBottom:8}}>{label}</label>
      {children}
    </div>
  );
}

function SectionCard({ title, children, color }) {
  return (
    <div style={{background:C.bg3,border:`1px solid ${(color||C.gold)}22`,borderRadius:10,padding:'20px',marginBottom:16}}>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:10.5,color:color||C.gold,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:16,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>{title}</div>
      {children}
    </div>
  );
}

function StatRow({ label, value, sub, color }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,color:C.textDim}}>{label}</span>
      <div style={{textAlign:'right'}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:color||C.text}}>{value}</span>
        {sub&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>{sub}</div>}
      </div>
    </div>
  );
}

/* ═══ PASSWORD GATE ══════════════════════════════════════════════════════ */
function PasswordGate({ onUnlock, goBack }) {
  const [pw,setPw]=useState(''), [err,setErr]=useState(false), [shake,setShake]=useState(false);
  const attempt=()=>{ if(pw===PASSWORD){onUnlock();}else{setErr(true);setShake(true);setTimeout(()=>setShake(false),550);} };
  return (
    <div style={{minHeight:'100vh',paddingTop:54,display:'flex',alignItems:'center',justifyContent:'center',background:C.bg}}>
      <div style={{width:'min(400px,90vw)',animation:'fadeUp .4s ease both'}}>
        <div style={{textAlign:'center',marginBottom:34}}>
          <div style={{fontSize:42,marginBottom:12,opacity:.2,lineHeight:1}}>⌁</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:'0.4em',color:C.gold,textTransform:'uppercase',marginBottom:9,opacity:.8}}>Restricted Access</div>
          <h2 style={{fontFamily:"'Cinzel',serif",fontSize:22,color:C.text,fontWeight:500,letterSpacing:'0.08em'}}>Author's Chamber</h2>
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:15,color:C.textDim,marginTop:9,lineHeight:1.6}}>Only those who know the phrase may enter.</p>
        </div>
        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:10,padding:'24px',animation:shake?'shake 0.5s ease':'none'}}>
          <div style={{position:'relative',marginBottom:13}}>
            <input type="password" value={pw} autoFocus onChange={e=>{setPw(e.target.value);setErr(false);}} onKeyDown={e=>e.key==='Enter'&&attempt()} placeholder="Enter passphrase…"
              style={{...IST,paddingRight:48,fontSize:15,letterSpacing:'0.15em',border:`1px solid ${err?C.rose+'66':'rgba(255,255,255,0.1)'}`,borderRadius:7,background:'rgba(0,0,0,0.35)',transition:'border-color .2s'}}/>
            <button onClick={attempt} style={{position:'absolute',right:8,top:'50%',transform:'translateY(-50%)',width:32,height:32,borderRadius:5,background:C.gold,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,color:C.bg}}
              onMouseEnter={e=>e.currentTarget.style.background='#d4a04a'} onMouseLeave={e=>e.currentTarget.style.background=C.gold}>→</button>
          </div>
          {err&&<div style={{fontFamily:"'Cinzel',serif",fontSize:9.5,color:C.rose,letterSpacing:'0.1em',textAlign:'center'}}>Incorrect passphrase. The loop remains sealed.</div>}
        </div>
        <div style={{textAlign:'center',marginTop:16}}>
          <button onClick={goBack} style={{fontFamily:"'Cinzel',serif",fontSize:9.5,color:C.textFaint,letterSpacing:'0.15em',textTransform:'uppercase',transition:'color .2s'}}
            onMouseEnter={e=>e.currentTarget.style.color=C.textDim} onMouseLeave={e=>e.currentTarget.style.color=C.textFaint}>← Return to Story</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ TUTORIAL ═══════════════════════════════════════════════════════════ */
function TutModal({ onClose }) {
  return (
    <div style={{position:'fixed',inset:0,zIndex:999,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)',padding:16}}>
      <div style={{width:'min(600px,100%)',background:C.bg3,border:`1px solid ${C.gold}33`,borderRadius:12,padding:'34px 38px',animation:'modalIn .35s cubic-bezier(.22,1,.36,1) both',position:'relative',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${C.gold},transparent)`}}/>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:'0.35em',color:C.gold,textTransform:'uppercase',marginBottom:9,opacity:.8}}>Author's Guide</div>
        <h2 style={{fontFamily:"'Cinzel',serif",fontSize:18,color:C.text,marginBottom:7,fontWeight:500}}>Node Types</h2>
        <div style={{display:'flex',flexDirection:'column',gap:9,marginBottom:18}}>
          {Object.entries(TYPE_META).map(([type,{color,icon,label,desc}])=>(
            <div key={type} style={{display:'flex',gap:12,alignItems:'flex-start',background:'rgba(255,255,255,0.03)',border:`1px solid ${color}22`,borderLeft:`3px solid ${color}`,borderRadius:6,padding:'11px 14px'}}>
              <span style={{fontSize:15,color,lineHeight:1,marginTop:2,flexShrink:0}}>{icon}</span>
              <div><div style={{fontFamily:"'Cinzel',serif",fontSize:11,color,marginBottom:3,letterSpacing:'0.06em'}}>{label}</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13.5,color:C.textDim,lineHeight:1.65}}>{desc}</div></div>
            </div>
          ))}
        </div>
        <div style={{background:'rgba(196,144,58,0.06)',border:`1px solid ${C.gold}22`,borderRadius:8,padding:'11px 14px',marginBottom:18}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:'0.2em',color:C.gold,marginBottom:4}}>MAP TIPS</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13.5,color:C.textDim,lineHeight:1.6}}><strong style={{color:C.text}}>Single click</strong> selects a node. <strong style={{color:C.text}}>Double click</strong> opens the editor. Drag to reposition. Scroll to zoom.</div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:14,borderTop:`1px solid ${C.border}`}}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:12,color:C.textFaint}}>Reopen via ? in the toolbar.</span>
          <button onClick={onClose} style={{fontFamily:"'Cinzel',serif",fontSize:10.5,letterSpacing:'0.2em',color:C.bg,background:C.gold,borderRadius:5,padding:'10px 22px',textTransform:'uppercase',border:'none'}}
            onMouseEnter={e=>e.currentTarget.style.background='#d4a04a'} onMouseLeave={e=>e.currentTarget.style.background=C.gold}>Begin Writing</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ HEADER ═════════════════════════════════════════════════════════════ */
function Header({ mode, setMode, authUnlocked, found, totalEndings, loopN, curAuthorIdx, setCurAuthorIdx }) {
  return (
    <header style={{position:'fixed',top:0,left:0,right:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',height:54,background:`linear-gradient(180deg,${C.bg} 70%,transparent)`,borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontFamily:"'Cinzel',serif",fontSize:13,letterSpacing:'0.22em',color:C.gold,textTransform:'uppercase',animation:'glow 4s ease infinite'}}>The Loop</span>
      <nav style={{display:'flex',gap:3,background:'rgba(0,0,0,0.3)',borderRadius:8,padding:4,border:`1px solid ${C.border}`}}>
        {[['reader','Read'],['author','Write ✎'],['gallery','Endings']].map(([m,lbl])=>(
          <button key={m} onClick={()=>setMode(m)} style={{padding:'5px 13px',borderRadius:5,fontSize:11,letterSpacing:'0.08em',fontFamily:"'Cinzel',serif",color:mode===m?C.bg:C.textDim,background:mode===m?C.gold:'transparent',transition:'all .2s',fontWeight:mode===m?600:400}}>{lbl}</button>
        ))}
      </nav>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        {mode==='author'&&authUnlocked&&(
          <div style={{display:'flex',gap:3}}>
            {AUTHORS.map((a,i)=>(
              <button key={i} onClick={()=>setCurAuthorIdx(i)} style={{fontFamily:"'Cinzel',serif",fontSize:9.5,padding:'3px 9px',borderRadius:4,color:curAuthorIdx===i?C.bg:C.textFaint,background:curAuthorIdx===i?AUTHOR_COLORS[i]:'transparent',border:`1px solid ${curAuthorIdx===i?AUTHOR_COLORS[i]:C.border}`,cursor:'pointer',transition:'all .15s'}}>{a}</button>
            ))}
          </div>
        )}
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.textFaint}}>{found.size}/{totalEndings}</span>
        <span style={{fontFamily:"'Cinzel',serif",fontSize:11,color:C.gold,letterSpacing:'0.12em',animation:'glow 3s ease infinite'}}>Loop {toRoman(loopN)}</span>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:C.textFaint,letterSpacing:'0.08em'}}>v{APP_VERSION} - {BUILD_DATE}</span>
      </div>
    </header>
  );
}

/* ═══ READER ═════════════════════════════════════════════════════════════ */
function ReaderView({ curNode, fading, reachableSet, nodes, go, restart, pageIdx, setPageIdx }) {
  if (!curNode) {
    return (
      <div style={{minHeight:'100vh',paddingTop:80,paddingBottom:80,display:'flex',justifyContent:'center',alignItems:'center',background:C.bg}}>
        <div style={{width:'100%',maxWidth:520,padding:'0 24px',textAlign:'center',color:C.textFaint,fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic'}}>
          No story nodes yet. Switch to Author mode to create the first node.
        </div>
      </div>
    );
  }

  const pages = curNode.isMultiPage && Array.isArray(curNode.pages) && curNode.pages.length > 0 ? curNode.pages : null;
  const lastPageIdx = pages ? pages.length - 1 : 0;
  const safePageIdx = pages ? Math.min(pageIdx, lastPageIdx) : 0;
  const page = pages ? pages[safePageIdx] : null;
  const canAdvance = !!pages && safePageIdx < lastPageIdx;
  const showChoices = !pages || !canAdvance;
  const displayText = pages ? (page?.text || '') : (curNode.text || '');
  const nextLabel = page?.buttonLabel || 'Continue';

  return (
    <div style={{minHeight:'100vh',paddingTop:80,paddingBottom:80,display:'flex',justifyContent:'center',background:C.bg}}>
      <div style={{width:'100%',maxWidth:620,padding:'0 24px',opacity:fading?0:1,transform:fading?'translateY(12px)':'translateY(0)',transition:'opacity .28s,transform .28s',animation:'fadeUp .35s ease both'}}>
        <div style={{marginBottom:10}}><span style={{fontFamily:"'Cinzel',serif",fontSize:9.5,letterSpacing:'0.25em',color:TYPE_META[curNode?.type]?.color||C.textDim,textTransform:'uppercase'}}>{TYPE_META[curNode?.type]?.label}</span></div>
        <h1 style={{fontFamily:"'Cinzel',serif",fontSize:28,fontWeight:500,color:C.text,letterSpacing:'0.05em',marginBottom:36,lineHeight:1.3}}>{curNode?.title}</h1>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,color:C.text,marginBottom:48,opacity:.9}}>{renderText(displayText)}</div>

        {canAdvance&&(
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:40}}>
            <button onClick={()=>setPageIdx(i=>Math.min(i+1,lastPageIdx))}
              style={{display:'flex',alignItems:'flex-start',gap:16,padding:'15px 20px',width:'100%',background:'transparent',border:`1px solid ${C.border}`,borderLeft:`3px solid ${C.goldDim}`,borderRadius:4,color:C.text,fontSize:17,fontFamily:"'Cormorant Garamond',serif",textAlign:'left',cursor:'pointer',transition:'all .18s',lineHeight:1.5}}
              onMouseEnter={e=>{e.currentTarget.style.borderLeftColor=C.gold;e.currentTarget.style.background='rgba(196,144,58,0.08)';e.currentTarget.style.color='#f5e6c8';}}
              onMouseLeave={e=>{e.currentTarget.style.borderLeftColor=C.goldDim;e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.text;}}>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:C.goldDim,paddingTop:4,minWidth:16}}>→</span>
              <span style={{flex:1}}>{nextLabel}</span>
            </button>
          </div>
        )}

        {showChoices&&curNode?.choices?.length>0&&(
          <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:40}}>
            {curNode.choices.map((c,i)=>{
              const alive=reachableSet.has(c.nextNodeId),exists=!!nodes[c.nextNodeId],dead=!alive||!exists;
              return (
                <button key={c.id} onClick={()=>!dead&&go(c.nextNodeId)}
                  style={{display:'flex',alignItems:'flex-start',gap:16,padding:'15px 20px',width:'100%',background:'transparent',border:`1px solid ${dead?'rgba(255,255,255,0.04)':C.border}`,borderLeft:`3px solid ${dead?'rgba(255,255,255,0.05)':C.goldDim}`,borderRadius:4,color:dead?C.textFaint:C.text,fontSize:17,fontFamily:"'Cormorant Garamond',serif",textAlign:'left',cursor:dead?'not-allowed':'pointer',transition:'all .18s',lineHeight:1.5,opacity:dead?.38:1}}
                  onMouseEnter={e=>{if(!dead){e.currentTarget.style.borderLeftColor=C.gold;e.currentTarget.style.background='rgba(196,144,58,0.08)';e.currentTarget.style.color='#f5e6c8';}}}
                  onMouseLeave={e=>{if(!dead){e.currentTarget.style.borderLeftColor=C.goldDim;e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.text;}}}>
                  <span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:dead?C.textFaint:C.goldDim,paddingTop:4,minWidth:16}}>{i+1}</span>
                  <span style={{flex:1}}>{c.text}</span>
                  {dead&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint,alignSelf:'center',border:'1px solid rgba(255,255,255,0.07)',padding:'2px 7px',borderRadius:3,flexShrink:0}}>sealed</span>}
                </button>
              );
            })}
          </div>
        )}
        <div style={{display:'flex',justifyContent:'space-between',paddingTop:24,borderTop:`1px solid ${C.border}`}}>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>{curNode?.id}</span>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            {pages&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>Page {safePageIdx+1}/{pages.length}</span>}
            <button onClick={restart} style={{fontFamily:"'Cinzel',serif",fontSize:9.5,color:C.textFaint,letterSpacing:'0.15em',textTransform:'uppercase',transition:'color .2s'}}
            onMouseEnter={e=>e.currentTarget.style.color=C.textDim} onMouseLeave={e=>e.currentTarget.style.color=C.textFaint}>↺ Return to Page 1</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ ENDING ═════════════════════════════════════════════════════════════ */
function EndingView({ curNode, fading, restart, setMode }) {
  const ed=curNode?.endingData;
  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:C.bg,padding:'80px 24px 60px',opacity:fading?0:1,transition:'opacity .3s'}}>
      <div style={{maxWidth:560,width:'100%',textAlign:'center'}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:'0.4em',color:C.rose,textTransform:'uppercase',marginBottom:22,animation:'glow 3s ease infinite',filter:'hue-rotate(280deg)'}}>Ending {ed?.endingNumber?toRoman(ed.endingNumber):'—'}</div>
        <div style={{width:48,height:1,background:`linear-gradient(90deg,transparent,${C.rose},transparent)`,margin:'0 auto 24px'}}/>
        <h1 style={{fontFamily:"'Cinzel',serif",fontSize:32,fontWeight:600,color:C.text,marginBottom:13,letterSpacing:'0.08em',lineHeight:1.2}}>{curNode?.title}</h1>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:'0.25em',color:C.rose,marginBottom:38,opacity:.7,textTransform:'uppercase'}}>{ed?.endingCategory}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,color:C.text,marginBottom:42,textAlign:'left',opacity:.88,lineHeight:1.8}}>{renderText(getNodeText(curNode))}</div>
        <div style={{display:'flex',gap:13,justifyContent:'center',flexWrap:'wrap',marginBottom:28}}>
          <button onClick={restart} style={{fontFamily:"'Cinzel',serif",fontSize:10.5,letterSpacing:'0.2em',color:C.bg,background:C.gold,border:'none',borderRadius:4,padding:'12px 24px',textTransform:'uppercase'}}
            onMouseEnter={e=>e.currentTarget.style.background='#d4a04a'} onMouseLeave={e=>e.currentTarget.style.background=C.gold}>Begin Again</button>
          <button onClick={()=>setMode('gallery')} style={{fontFamily:"'Cinzel',serif",fontSize:10.5,letterSpacing:'0.2em',color:C.text,background:'transparent',border:`1px solid ${C.border}`,borderRadius:4,padding:'12px 24px',textTransform:'uppercase'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text;}}>View Endings</button>
        </div>
        {ed?.loopConditions&&(
          <div style={{display:'flex',gap:7,justifyContent:'center',marginTop:16,flexWrap:'wrap'}}>
            {Object.entries(ed.loopConditions).map(([k,v])=>(
              <span key={k} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,padding:'3px 9px',borderRadius:100,background:v?'rgba(196,144,58,0.14)':'rgba(255,255,255,0.03)',color:v?C.gold:C.textFaint,border:`1px solid ${v?C.goldDim+'44':'rgba(255,255,255,0.06)'}`}}>{v?'✓':'✗'} {LOOP_LBL[k]}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ GALLERY ════════════════════════════════════════════════════════════ */
function GalleryView({ nodes, found, totalEndings, loopN }) {
  return (
    <div style={{minHeight:'100vh',background:C.bg,padding:'92px 28px 60px'}}>
      <div style={{maxWidth:880,margin:'0 auto'}}>
        <h1 style={{fontFamily:"'Cinzel',serif",fontSize:22,color:C.text,letterSpacing:'0.15em',marginBottom:7,textAlign:'center'}}>Endings</h1>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:C.textDim,textAlign:'center',marginBottom:40,fontStyle:'italic'}}>{found.size} of {totalEndings} discovered · Loop {toRoman(loopN)}</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:13}}>
          {Object.values(nodes).filter(n=>n.isEnding).map(e=>{
            const d=found.has(e.id);
            return (
              <div key={e.id} style={{background:d?C.bg3:'rgba(255,255,255,0.02)',border:`1px solid ${d?C.rose+'33':C.border}`,borderRadius:8,padding:20,position:'relative',overflow:'hidden'}}>
                {d&&<div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${C.rose},transparent)`}}/>}
                <div style={{fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:'0.3em',color:d?C.rose:C.textFaint,marginBottom:6,textTransform:'uppercase'}}>{d?`Ending ${toRoman(e.endingData?.endingNumber||0)}`:'??? ??? ???'}</div>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:15,color:d?C.text:C.textFaint,marginBottom:6,filter:d?'none':'blur(6px)'}}>{e.title}</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:d?C.textDim:C.textFaint,fontStyle:'italic',filter:d?'none':'blur(4px)'}}>{d?(e.endingData?.summary||e.endingData?.endingCategory):'Not yet discovered'}</div>
                {d&&e.endingData?.loopConditions&&(
                  <div style={{display:'flex',gap:4,marginTop:10,flexWrap:'wrap'}}>
                    {Object.entries(e.endingData.loopConditions).filter(([,v])=>v).map(([k])=>(
                      <span key={k} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,padding:'2px 6px',borderRadius:100,background:'rgba(191,91,122,0.12)',color:C.rose,border:`1px solid ${C.rose}22`}}>{LOOP_LBL[k]}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══ ANALYTICS (Write subtab) ═══════════════════════════════════════════ */
function AnalyticsView({ nodes, found, totalEndings, loopN, curAuthorIdx, setCurAuthorIdx, onAddNode, reachableSet }) {
  const allNodes = Object.values(nodes);
  const today    = dayKey(Date.now());

  /* ── Word stats ── */
  const wordCounts = allNodes.map(n=>({id:n.id,title:n.title,wc:wordCount(getNodeText(n))}));
  const totalWords = wordCounts.reduce((a,x)=>a+x.wc,0);
  const avgWords   = allNodes.length ? Math.round(totalWords/allNodes.length) : 0;
  const maxWNode   = wordCounts.reduce((a,x)=>x.wc>a.wc?x:a,{wc:0,title:'—'});
  const minWNode   = wordCounts.reduce((a,x)=>x.wc<a.wc?x:a,{wc:Infinity,title:'—'});

  /* ── Journey stats — all paths from start to any ending via DFS ── */
  const allPaths = useMemo(()=>{
    const paths=[]; const endIds=new Set(allNodes.filter(n=>n.isEnding).map(n=>n.id));
    const dfs=(id,path,visited)=>{
      if(endIds.has(id)){paths.push([...path,id]);return;}
      if(visited.has(id))return;
      visited.add(id);
      (nodes[id]?.choices||[]).forEach(c=>{ if(c.nextNodeId&&nodes[c.nextNodeId]) dfs(c.nextNodeId,[...path,id],new Set(visited)); });
    };
    dfs('start',[],new Set()); return paths;
  },[nodes,allNodes]);

  const journeyLengths = allPaths.map(p=>p.length);
  const shortestJourney = journeyLengths.length ? Math.min(...journeyLengths) : 0;
  const longestJourney  = journeyLengths.length ? Math.max(...journeyLengths) : 0;
  const avgJourney      = journeyLengths.length ? (journeyLengths.reduce((a,x)=>a+x,0)/journeyLengths.length).toFixed(1) : '—';
  const uniquePaths     = allPaths.length;

  /* ── Unique endings reachable ── */
  const endingIds = new Set(allNodes.filter(n=>n.isEnding).map(n=>n.id));
  const reachableEndings = [...endingIds].filter(id=>reachableSet.has(id));

  /* ── Grayed nodes ── */
  const grayedNodes = allNodes.filter(n=>!reachableSet.has(n.id));

  /* ── Hubs (3+ inbound connections) ── */
  const inboundCount = {};
  allNodes.forEach(n=>n.choices.forEach(c=>{ if(c.nextNodeId) inboundCount[c.nextNodeId]=(inboundCount[c.nextNodeId]||0)+1; }));
  const hubs = allNodes.filter(n=>(inboundCount[n.id]||0)>=3);

  /* ── Timeline ── */
  const last28 = useMemo(()=>Array.from({length:28},(_,i)=>{
    const dk=today-(27-i), dn=allNodes.filter(n=>dayKey(n.createdAt)===dk);
    const obj={label:new Date(dk*DAY).toLocaleDateString('en-US',{month:'short',day:'numeric'}),total:dn.length};
    AUTHORS.forEach(a=>{obj[a]=dn.filter(n=>n.createdBy===a).length;});
    return obj;
  }),[allNodes,today]);
  const maxDay=Math.max(...last28.map(d=>d.total),1);
  const last7 =allNodes.filter(n=>n.createdAt>Date.now()-7*DAY).length;
  const prev7 =allNodes.filter(n=>n.createdAt>Date.now()-14*DAY&&n.createdAt<=Date.now()-7*DAY).length;
  const totalConns=allNodes.reduce((a,n)=>a+n.choices.length,0);
  const streak=useMemo(()=>{const ac=new Set(allNodes.map(n=>dayKey(n.createdAt)));let s=0,c=ac.has(today)?today:today-1;while(ac.has(c)){s++;c--;}return s;},[allNodes,today]);
  const bw=100/28;
  const authorData=AUTHORS.map((a,i)=>({name:a,count:allNodes.filter(n=>n.createdBy===a).length,color:AUTHOR_COLORS[i]}));
  const maxAC=Math.max(...authorData.map(d=>d.count),1);

  const SC=({label,value,sub,color})=>(
    <div style={{background:C.bg3,border:`1px solid ${(color||C.gold)}22`,borderRadius:10,padding:'16px 18px',flex:'1 1 110px',minWidth:100}}>
      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:23,fontWeight:500,color:color||C.gold,marginBottom:2,letterSpacing:'-0.02em'}}>{value}</div>
      <div style={{fontFamily:"'Cinzel',serif",fontSize:8.5,color:C.textDim,letterSpacing:'0.15em',textTransform:'uppercase',marginBottom:sub?2:0}}>{label}</div>
      {sub&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:C.textFaint}}>{sub}</div>}
    </div>
  );

  return (
    <div style={{overflowY:'auto',height:'100%',background:C.bg}}>
      <div style={{maxWidth:900,margin:'0 auto',padding:'20px 22px 60px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:C.text,fontWeight:500,letterSpacing:'0.08em'}}>Writing Dashboard</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:9,color:C.textFaint,letterSpacing:'0.12em'}}>WRITING AS</span>
            {AUTHORS.map((a,i)=>(
              <button key={i} onClick={()=>setCurAuthorIdx(i)} style={{fontFamily:"'Cinzel',serif",fontSize:9.5,letterSpacing:'0.08em',padding:'5px 11px',borderRadius:5,color:curAuthorIdx===i?C.bg:C.textDim,background:curAuthorIdx===i?AUTHOR_COLORS[i]:'transparent',border:`1px solid ${curAuthorIdx===i?AUTHOR_COLORS[i]:C.border}`,cursor:'pointer',transition:'all .15s'}}>{a}</button>
            ))}
          </div>
        </div>

        {/* Overview */}
        <div style={{display:'flex',gap:9,flexWrap:'wrap',marginBottom:16}}>
          <SC label="Nodes"       value={allNodes.length}  sub={`+${last7} this week`}   color={C.gold}/>
          <SC label="Connections" value={totalConns}        sub={`${(totalConns/Math.max(allNodes.length,1)).toFixed(1)} avg/node`} color={C.blue}/>
          <SC label="Endings"     value={totalEndings}      sub={`${found.size} discovered`} color={C.rose}/>
          <SC label="Paths"       value={uniquePaths}       sub={`to any ending`}          color={C.purple}/>
          <SC label="🔥 Streak"  value={`${streak}d`}      sub={`+${last7>=prev7?'↑':'↓'} vs last wk`} color={streak>=3?C.gold:C.textDim}/>
        </div>

        {/* Timeline */}
        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:10,padding:'18px',marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:C.text,letterSpacing:'0.1em'}}>Activity — Last 28 Days</div>
            <div style={{display:'flex',gap:12}}>{AUTHORS.map((a,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:2,background:AUTHOR_COLORS[i]}}/><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textDim}}>{a}</span></div>)}</div>
          </div>
          <svg viewBox="0 0 100 52" preserveAspectRatio="none" style={{width:'100%',height:100,display:'block'}}>
            {[0,.5,1].map(f=><line key={f} x1="0" y1={46*(1-f)} x2="100" y2={46*(1-f)} stroke="rgba(255,255,255,0.05)" strokeWidth="0.3"/>)}
            {last28.map((d,i)=>{const x=i*bw+bw*.1,w=bw*.8;let yOff=46;return AUTHORS.map((a,ai)=>{const h=(d[a]/maxDay)*46;if(!h)return null;yOff-=h;return <rect key={ai} x={x} y={yOff} width={w} height={h} fill={AUTHOR_COLORS[ai]} opacity=".82" rx=".4"/>;});})}
            {last28.filter((_,i)=>i%7===0||i===27).map((d)=>{const i=last28.indexOf(d);return <text key={i} x={i*bw+bw*.5} y={51} textAnchor="middle" fontSize="3.5" fill={C.textFaint} fontFamily="monospace">{d.label}</text>;})}
          </svg>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
          {/* Words */}
          <SectionCard title="Words" color={C.blue}>
            <StatRow label="Total words" value={totalWords.toLocaleString()}/>
            <StatRow label="Average per node" value={avgWords}/>
            <StatRow label="Most words" value={maxWNode.wc} sub={maxWNode.title}/>
            <StatRow label="Fewest words" value={minWNode.wc===Infinity?0:minWNode.wc} sub={minWNode.title}/>
            <StatRow label="Ending nodes" value={wordCounts.filter(x=>nodes[x.id]?.isEnding).reduce((a,x)=>a+x.wc,0)} sub="words total"/>
          </SectionCard>

          {/* Journeys */}
          <SectionCard title="Journeys" color={C.purple}>
            <StatRow label="Unique paths to endings" value={uniquePaths}/>
            <StatRow label="Shortest journey" value={shortestJourney} sub="nodes"/>
            <StatRow label="Longest journey" value={longestJourney} sub="nodes"/>
            <StatRow label="Average length" value={avgJourney} sub="nodes"/>
            <StatRow label="Reachable endings" value={`${reachableEndings.length}/${totalEndings}`}/>
          </SectionCard>

          {/* Grayed nodes */}
          <SectionCard title="Sealed Nodes" color={C.rose}>
            {grayedNodes.length===0
              ? <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:14,color:C.textFaint}}>No dead ends — every node reaches an ending ✓</div>
              : grayedNodes.map(n=>(
                <div key={n.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13.5,color:C.textDim}}>{n.title}</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.rose}}>{n.id}</span>
                </div>
              ))
            }
          </SectionCard>

          {/* Hubs */}
          <SectionCard title="Hubs (3+ inbound)" color={TYPE_META.hub.color}>
            {hubs.length===0
              ? <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:14,color:C.textFaint}}>No nodes with 3+ inbound connections yet.</div>
              : hubs.map(n=>(
                <div key={n.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:13.5,color:C.textDim}}>{n.title}</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:TYPE_META.hub.color}}>↓{inboundCount[n.id]||0}</span>
                </div>
              ))
            }
          </SectionCard>

          {/* Unique Endings */}
          <SectionCard title="Unique Endings" color={C.rose}>
            {Object.values(nodes).filter(n=>n.isEnding).map(n=>{
              const pathsToThis=allPaths.filter(p=>p[p.length-1]===n.id);
              return (
                <div key={n.id} style={{padding:'6px 0',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span style={{fontFamily:"'Cinzel',serif",fontSize:10.5,color:found.has(n.id)?C.rose:C.textFaint}}>{found.has(n.id)?'★ ':''}{n.title}</span>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.textDim}}>{pathsToThis.length} path{pathsToThis.length!==1?'s':''}</span>
                  </div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8.5,color:C.textFaint,marginTop:2}}>{n.endingData?.endingCategory||'—'}</div>
                </div>
              );
            })}
          </SectionCard>

          {/* By Author */}
          <SectionCard title="By Author" color={C.gold}>
            {authorData.map(({name,count,color})=>(
              <div key={name} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:C.textDim}}>{name}</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color}}>{count} nodes · {wordCounts.filter(x=>nodes[x.id]?.createdBy===name).reduce((a,x)=>a+x.wc,0)} words</span></div>
                <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2}}><div style={{height:'100%',width:`${(count/maxAC)*100}%`,background:color,borderRadius:2,transition:'width .6s ease'}}/></div>
              </div>
            ))}
          </SectionCard>
        </div>

        <div style={{marginTop:14,background:`linear-gradient(135deg,rgba(196,144,58,0.06),rgba(155,114,191,0.06))`,border:`1px solid ${C.gold}22`,borderRadius:10,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,color:C.textDim,fontStyle:'italic'}}>{allNodes.length<20?`${20-allNodes.length} nodes until a solid foundation.`:allNodes.length<40?`${40-allNodes.length} until a complex web.`:'A rich, tangled loop. The story breathes.'}</div>
          <button onClick={onAddNode} style={{fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:'0.15em',color:C.bg,background:C.gold,borderRadius:5,padding:'10px 18px',textTransform:'uppercase',border:'none',flexShrink:0}}
            onMouseEnter={e=>e.currentTarget.style.background='#d4a04a'} onMouseLeave={e=>e.currentTarget.style.background=C.gold}>+ Add Node</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ NOTES VIEW ═════════════════════════════════════════════════════════ */
const mkNote = (title='Untitled Note') => ({ id:'note_'+Date.now()+Math.random(), title, checkboxMode:false, items:[] });
const mkItem = text => ({ id:'item_'+Date.now()+Math.random(), text, checked:false });

function NotesView() {
  const [notes, setNotes]     = useState([mkNote('Story Notes')]);
  const [selNote, setSelNote] = useState(0);
  const [newTitle, setNewTitle] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  const note = notes[selNote] || notes[0];

  const updateNote = fn => setNotes(ns => ns.map((n,i)=>i===selNote?fn(n):n));

  const addItem = () => {
    const text = inputVal.trim(); if(!text) return;
    updateNote(n=>({...n, items:[...n.items, mkItem(text)]}));
    setInputVal('');
    inputRef.current?.focus();
  };

  const toggleCheck = id => updateNote(n=>({...n, items:n.items.map(it=>it.id===id?{...it,checked:!it.checked}:it)}));
  const deleteItem  = id => updateNote(n=>({...n, items:n.items.filter(it=>it.id!==id)}));
  const editItem    = (id,text) => updateNote(n=>({...n, items:n.items.map(it=>it.id===id?{...it,text}:it)}));

  const sortedItems = note ? [...(note.items||[]).filter(i=>!i.checked), ...(note.items||[]).filter(i=>i.checked)] : [];

  const addNote = () => {
    const t=newTitle.trim()||'Untitled Note';
    setNotes(ns=>[...ns,mkNote(t)]);
    setSelNote(notes.length);
    setAddingNote(false); setNewTitle('');
  };

  const deleteNote = i => {
    setNotes(ns=>ns.filter((_,j)=>j!==i));
    setSelNote(s=>Math.max(0,s>=i?s-1:s));
  };

  return (
    <div style={{display:'flex',height:'100%',background:C.bg}}>
      {/* Sidebar */}
      <div style={{width:200,flexShrink:0,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',background:C.bg2,overflow:'hidden'}}>
        <div style={{padding:'12px 10px 8px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:9.5,color:C.textDim,letterSpacing:'0.15em',textTransform:'uppercase'}}>Notes</span>
          <button onClick={()=>setAddingNote(true)} style={{width:22,height:22,borderRadius:4,background:C.gold+'22',border:`1px solid ${C.gold}44`,color:C.gold,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>e.currentTarget.style.background=C.gold+'44'} onMouseLeave={e=>e.currentTarget.style.background=C.gold+'22'}>+</button>
        </div>
        {addingNote&&(
          <div style={{padding:'8px 10px',borderBottom:`1px solid ${C.border}`}}>
            <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addNote();if(e.key==='Escape'){setAddingNote(false);setNewTitle('');}}} placeholder="Note title…" autoFocus
              style={{...IST,padding:'5px 8px',fontSize:12,marginBottom:6}}/>
            <div style={{display:'flex',gap:5}}>
              <button onClick={addNote} style={{flex:1,padding:'4px',background:C.gold,borderRadius:4,color:C.bg,fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:'0.08em'}}>Create</button>
              <button onClick={()=>{setAddingNote(false);setNewTitle('');}} style={{flex:1,padding:'4px',background:'transparent',border:`1px solid ${C.border}`,borderRadius:4,color:C.textDim,fontFamily:"'Cinzel',serif",fontSize:9}}>Cancel</button>
            </div>
          </div>
        )}
        <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
          {notes.map((n,i)=>(
            <div key={n.id} onClick={()=>setSelNote(i)}
              style={{padding:'8px 10px',cursor:'pointer',borderLeft:`3px solid ${selNote===i?C.gold:'transparent'}`,background:selNote===i?'rgba(255,255,255,0.06)':'transparent',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:6}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:selNote===i?C.text:C.textDim,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{n.title}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.textFaint,marginTop:2}}>{n.items.length} item{n.items.length!==1?'s':''} · {n.checkboxMode?'☑ tasks':'✎ text'}</div>
              </div>
              {notes.length>1&&<button onClick={e=>{e.stopPropagation();deleteNote(i);}} style={{fontSize:11,color:C.textFaint,opacity:.5,flexShrink:0,lineHeight:1}} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='.5'}>✕</button>}
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      {note&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {/* Note header */}
          <div style={{padding:'10px 18px',borderBottom:`1px solid ${C.border}`,background:C.bg2,display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
            <input value={note.title} onChange={e=>updateNote(n=>({...n,title:e.target.value}))}
              style={{flex:1,background:'transparent',border:'none',fontFamily:"'Cinzel',serif",fontSize:14,color:C.text,letterSpacing:'0.06em'}}/>
            {/* Checkbox toggle */}
            <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',flexShrink:0}}>
              <div style={{width:32,height:18,borderRadius:9,background:note.checkboxMode?C.gold:'rgba(255,255,255,0.1)',position:'relative',transition:'background .2s',border:`1px solid ${note.checkboxMode?C.gold:C.border}`}}
                onClick={()=>updateNote(n=>({...n,checkboxMode:!n.checkboxMode}))}>
                <div style={{position:'absolute',top:2,left:note.checkboxMode?15:2,width:12,height:12,borderRadius:'50%',background:note.checkboxMode?C.bg:C.textDim,transition:'left .2s'}}/>
              </div>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:9,color:note.checkboxMode?C.gold:C.textDim,letterSpacing:'0.12em',textTransform:'uppercase'}}>Tasks</span>
            </label>
          </div>

          {/* Items list */}
          <div style={{flex:1,overflowY:'auto',padding:'16px 18px'}}>
            {sortedItems.length===0&&(
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:16,color:C.textFaint,textAlign:'center',marginTop:60,opacity:.6}}>
                {note.checkboxMode?'Add tasks below…':'Start writing below…'}
              </div>
            )}
            {sortedItems.map(item=>(
              <div key={item.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'7px 0',borderBottom:`1px solid ${C.border}`,opacity:item.checked?.5:1,transition:'opacity .2s'}}>
                {note.checkboxMode&&(
                  <button onClick={()=>toggleCheck(item.id)}
                    style={{width:16,height:16,borderRadius:3,border:`1.5px solid ${item.checked?C.gold:C.border}`,background:item.checked?C.gold:'transparent',flexShrink:0,marginTop:3,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
                    {item.checked&&<span style={{fontSize:9,color:C.bg,lineHeight:1}}>✓</span>}
                  </button>
                )}
                <div style={{flex:1,minWidth:0,position:'relative'}}>
                  <textarea value={item.text} onChange={e=>editItem(item.id,e.target.value)}
                    style={{width:'100%',background:'transparent',border:'none',fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:item.checked?C.textFaint:C.text,lineHeight:1.6,resize:'none',overflow:'hidden',textDecoration:item.checked?'line-through':'none'}}
                    rows={1} onInput={e=>{e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}}/>
                </div>
                <button onClick={()=>deleteItem(item.id)} style={{fontSize:10,color:C.textFaint,opacity:.4,flexShrink:0,marginTop:4,lineHeight:1}} onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='.4'}>✕</button>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{padding:'12px 18px',borderTop:`1px solid ${C.border}`,background:C.bg2,display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
            {note.checkboxMode&&<div style={{width:16,height:16,borderRadius:3,border:`1.5px solid ${C.border}`,background:'transparent',flexShrink:0}}/>}
            <input ref={inputRef} value={inputVal} onChange={e=>setInputVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addItem()} placeholder={note.checkboxMode?'Add task… (Enter to add)':'Add note… (Enter to add)'}
              style={{...IST,flex:1,padding:'7px 10px',fontSize:14,borderRadius:6,fontFamily:"'Cormorant Garamond',serif"}}/>
            <button onClick={addItem} style={{fontFamily:"'Cinzel',serif",fontSize:9.5,letterSpacing:'0.1em',padding:'7px 14px',border:'none',borderRadius:5,color:C.bg,background:C.gold,flexShrink:0}}
              onMouseEnter={e=>e.currentTarget.style.background='#d4a04a'} onMouseLeave={e=>e.currentTarget.style.background=C.gold}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ MAP VIEW ═══════════════════════════════════════════════════════════ */
function MapView({ nodes, setNodes, sel, setSel, setEditNode, setATab, reachableSet, totalEndings, copyFlash, copyContext, confirmDiscard, commitNodePosition }) {
  const [pan,  setPan]    = useState({ x:60, y:60 });
  const [zoom, setZoom]   = useState(0.86);
  const [cursor, setCursor] = useState('grab');

  const dragRef    = useRef(null);
  const panRef     = useRef(null);
  const zoomRef    = useRef(zoom);
  const nodesRef   = useRef(nodes);
  const commitRef  = useRef(commitNodePosition);
  const lastClickRef  = useRef({ id:null, time:0 });
  const mouseDownRef  = useRef(null); // {x,y,time}
  useEffect(()=>{ zoomRef.current=zoom; },[zoom]);
  useEffect(()=>{ nodesRef.current=nodes; },[nodes]);
  useEffect(()=>{ commitRef.current=commitNodePosition; },[commitNodePosition]);
  const outerRef = useRef(null);

  /* BFS node numbering */
  const nodeNums = useMemo(()=>{
    const nums={},visited=new Set(),queue=['start']; let n=1;
    while(queue.length){ const id=queue.shift(); if(visited.has(id)||!nodes[id])continue; visited.add(id); nums[id]=n++; nodes[id].choices.forEach(c=>{ if(c.nextNodeId&&!visited.has(c.nextNodeId))queue.push(c.nextNodeId); }); }
    Object.keys(nodes).forEach(id=>{ if(!nums[id]) nums[id]=n++; });
    return nums;
  },[nodes]);

  /* Edges */
  const edges = useMemo(()=>{
    const list=[];
    Object.values(nodes).forEach(n=>{
      const pairCount={};
      n.choices.forEach(c=>{ if(c.nextNodeId){ const k=`${n.id}>${c.nextNodeId}`; pairCount[k]=(pairCount[k]||0)+1; } });
      const pairIdx={};
      const missingChoices = n.choices.filter(c=>c.nextNodeId && !nodes[c.nextNodeId]);
      n.choices.forEach(c=>{
        if(!c.nextNodeId)return;
        const k=`${n.id}>${c.nextNodeId}`,tot=pairCount[k]||1,idx=pairIdx[k]||0; pairIdx[k]=(pairIdx[k]||0)+1;
        const missing=!nodes[c.nextNodeId];
        let toPos=null;
        if(missing){
          const mi=missingChoices.indexOf(c);
          const mTot=missingChoices.length||1;
          const angle=Math.PI/2 + (mi-(mTot-1)/2)*0.55;
          const dist=160;
          toPos={x:n.position.x+Math.cos(angle)*dist,y:n.position.y+Math.sin(angle)*dist};
        }
        list.push({from:n.id,to:c.nextNodeId,dead:missing||!reachableSet.has(c.nextNodeId),missing,toPos,_idx:idx,_tot:tot});
      });
    });
    return list;
  },[nodes,reachableSet]);

  const mini = zoom < MINI_ZOOM;

  /* Path builder — edge-to-edge for both mini circles and full cards */
  const mkPath = (fId, tId, idx, tot, tPos) => {
    const fn=nodes[fId];
    const tn=nodes[tId] || (tPos ? { position: tPos } : null);
    if(!fn||!tn)return null;
    const z=zoom; // use render-cycle zoom, not stale ref

    let sx,sy,ex,ey;
    if(mini){
      // circles: connect from the edge of source toward target, land at target edge
      const r  = MINI/2;
      const cx1 = fn.position.x*z+pan.x + r;
      const cy1 = fn.position.y*z+pan.y + r;
      const cx2 = tn.position.x*z+pan.x + r;
      const cy2 = tn.position.y*z+pan.y + r;
      const angle = Math.atan2(cy2-cy1, cx2-cx1);
      sx = cx1 + r * Math.cos(angle);
      sy = cy1 + r * Math.sin(angle);
      // pull back from target center by radius so arrowhead tip lands on circle edge
      ex = cx2 - r * Math.cos(angle);
      ey = cy2 - r * Math.sin(angle);
    } else {
      // full card: connect at rectangle edge based on angle
      const nw=NW*z, nh=NH*z;
      const hw=nw/2, hh=nh/2;
      const cx1 = fn.position.x*z+pan.x + hw;
      const cy1 = fn.position.y*z+pan.y + hh;
      const cx2 = tn.position.x*z+pan.x + hw;
      const cy2 = tn.position.y*z+pan.y + hh;
      const dx = cx2 - cx1;
      const dy = cy2 - cy1;
      const norm = Math.max(Math.abs(dx)/hw, Math.abs(dy)/hh, 0.001);
      sx = cx1 + dx / norm;
      sy = cy1 + dy / norm;
      ex = cx2 - dx / norm;
      ey = cy2 - dy / norm;
    }

    const dx = ex - sx;
    const dy = ey - sy;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const spread=(idx-(tot-1)/2)*14*z;
    const osx = sx + px * spread;
    const osy = sy + py * spread;
    const oex = ex + px * spread;
    const oey = ey + py * spread;
    const curve = Math.min(120, Math.max(26, Math.hypot(dx, dy) * 0.25));
    const c1x = osx + dx * 0.25 + px * curve;
    const c1y = osy + dy * 0.25 + py * curve;
    const c2x = oex - dx * 0.25 + px * curve;
    const c2y = oey - dy * 0.25 + py * curve;
    return `M${osx},${osy} C${c1x},${c1y} ${c2x},${c2y} ${oex},${oey}`;
  };

  /* Window drag/pan listeners */
  useEffect(()=>{
    const onMove=e=>{
      if(dragRef.current){
        const {id,sx,sy,ox,oy}=dragRef.current, z=zoomRef.current;
        const dx=(e.clientX-sx)/z, dy=(e.clientY-sy)/z;
        setNodes(p=>({...p,[id]:{...p[id],position:{x:ox+dx,y:oy+dy}}}));
      } else if(panRef.current){
        const {mx,my,px,py}=panRef.current;
        setPan({x:px+(e.clientX-mx),y:py+(e.clientY-my)});
      }
    };
    const onUp=(e)=>{
      const drag=dragRef.current;
      if(drag && e){
        const z=zoomRef.current;
        const dx=(e.clientX-drag.sx)/z, dy=(e.clientY-drag.sy)/z;
        const dist=Math.hypot(e.clientX-drag.sx, e.clientY-drag.sy);
        if(dist>=5){
          const pos={x:drag.ox+dx,y:drag.oy+dy};
          setNodes(p=>({...p,[drag.id]:{...p[drag.id],position:pos}}));
          if(commitRef.current) commitRef.current(drag.id,pos);
        } else {
          const pos={x:drag.ox,y:drag.oy};
          setNodes(p=>({...p,[drag.id]:{...p[drag.id],position:pos}}));
        }
      }
      dragRef.current=null; panRef.current=null; setCursor('grab');
      requestAnimationFrame(()=>{ mouseDownRef.current=null; });
    };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    return()=>{ window.removeEventListener('mousemove',onMove); window.removeEventListener('mouseup',onUp); };
  },[]);

  useEffect(()=>{
    const el=outerRef.current; if(!el)return;
    const h=e=>{ e.preventDefault(); setZoom(z=>Math.min(2.2,Math.max(0.16,z-e.deltaY*0.0013))); };
    el.addEventListener('wheel',h,{passive:false});
    return()=>el.removeEventListener('wheel',h);
  },[]);

  const onBgDown=e=>{
    if(e.button!==0||e.target.closest('[data-nc]'))return;
    panRef.current={mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y};
    setCursor('grabbing');
  };

  /* Per-node pointer handlers: drag vs click vs double-click */
  const onNodeDown=(e,n)=>{
    e.stopPropagation();
    mouseDownRef.current={x:e.clientX,y:e.clientY,time:Date.now()};
    dragRef.current={id:n.id,sx:e.clientX,sy:e.clientY,ox:n.position.x,oy:n.position.y};
    setCursor('grabbing');
  };

  const onNodeUp=(e,n)=>{
    const md=mouseDownRef.current; if(!md)return;
    const dist=Math.hypot(e.clientX-md.x,e.clientY-md.y);
    const dt=Date.now()-md.time;
    if(dist<5&&dt<300){
      // treat as click; check for double-click
      const now=Date.now(), last=lastClickRef.current;
      const switching = sel !== n.id;
      if (switching && confirmDiscard && !confirmDiscard()) {
        return;
      }
      if(last.id===n.id&&now-last.time<400){
        // double click → open editor
        setSel(n.id); setEditNode(normalizeNode(nodesRef.current[n.id])); setATab('nodes');
        lastClickRef.current={id:null,time:0};
      } else {
        // single click → just select
        setSel(n.id);
        setEditNode(normalizeNode(nodesRef.current[n.id]));
        lastClickRef.current={id:n.id,time:now};
      }
    }
  };

  const nw=NW*zoom, nh=NH*zoom;
  const arrowScale = mini ? 0.75 : Math.min(1.35, Math.max(0.9, zoom));
  const arrowW = 8 * arrowScale;
  const arrowH = 6 * arrowScale;
  const deadArrowW = 6 * arrowScale;
  const deadArrowH = 4.5 * arrowScale;
  const baseStroke = mini ? 0.9 : Math.max(1.1, 1.3 * Math.min(1.6, zoom));
  const glowStroke = baseStroke + (mini ? 0.9 : 1.8);
  const dash = `${Math.max(4, 6 * arrowScale)},${Math.max(3, 4 * arrowScale)}`;

  return (
    <div ref={outerRef} onMouseDown={onBgDown} style={{position:'relative',width:'100%',height:'100%',overflow:'hidden',cursor,
      background:`repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,0.016) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,0.016) 40px),radial-gradient(ellipse at 25% 30%,rgba(196,144,58,0.05) 0%,transparent 55%),${C.bg2}`}}>

      {/* SVG edges */}
      <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:1}} overflow="visible">
        <defs>
          {Object.entries(TYPE_META).map(([t,{color}])=>(
            <marker key={t} id={`arr-${t}`} markerWidth={arrowW} markerHeight={arrowH} refX={arrowW} refY={arrowH/2} orient="auto" markerUnits="userSpaceOnUse">
              <path d={`M0,0 L0,${arrowH} L${arrowW},${arrowH/2} z`} fill={color} opacity="0.92"/>
            </marker>
          ))}
          <marker id="arr-dead" markerWidth={deadArrowW} markerHeight={deadArrowH} refX={deadArrowW} refY={deadArrowH/2} orient="auto" markerUnits="userSpaceOnUse">
            <path d={`M0,0 L0,${deadArrowH} L${deadArrowW},${deadArrowH/2} z`} fill="#555" opacity="0.6"/>
          </marker>
        </defs>
        {edges.map((e,i)=>{
          const path=mkPath(e.from,e.to,e._idx,e._tot,e.toPos); if(!path)return null;
          const ft=nodes[e.from]?.type||'scene', isSel=sel===e.from||sel===e.to;
          const col=e.missing?C.rose:(e.dead?'#3a3a50':TYPE_META[ft]?.color||C.textDim);
          const mainOpacity = e.dead ? 0.32 : isSel ? 0.9 : 0.55;
          const glowOpacity = e.dead ? 0.08 : isSel ? 0.2 : 0.12;
          return (
            <g key={i}>
              <path d={path} fill="none"
                stroke={col}
                strokeWidth={glowStroke}
                strokeOpacity={glowOpacity}
                strokeDasharray={(e.dead||e.missing)?dash:undefined}
                strokeLinecap="round"
              />
              <path d={path} fill="none"
                stroke={col}
                strokeWidth={baseStroke}
                strokeOpacity={mainOpacity}
                strokeDasharray={(e.dead||e.missing)?dash:undefined}
                strokeLinecap="round"
                markerEnd={(e.dead||e.missing)?'url(#arr-dead)':`url(#arr-${ft})`}
              />
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {Object.values(nodes).map(n=>{
        const meta=TYPE_META[n.type]||TYPE_META.scene;
        const isSel=sel===n.id, copied=copyFlash===n.id;
        const num=nodeNums[n.id]||'?';
        const x=n.position.x*zoom+pan.x, y=n.position.y*zoom+pan.y;

        /* Mini node */
        if(mini){
          return (
            <div key={n.id} data-nc="1"
              onMouseDown={e=>onNodeDown(e,n)} onMouseUp={e=>onNodeUp(e,n)}
              title={`#${num} ${n.title} (double-click to edit)`}
              style={{position:'absolute',left:x,top:y,width:MINI,height:MINI,borderRadius:'50%',zIndex:isSel?5:2,
                background:`${meta.color}1e`,border:`2px solid ${meta.color}${isSel?'ee':'88'}`,
                display:'flex',alignItems:'center',justifyContent:'center',
                boxShadow:isSel?`0 0 0 3px ${meta.color}44,0 4px 14px rgba(0,0,0,0.6)`:'none',
                cursor:'pointer',userSelect:'none',transition:'box-shadow .15s'}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:700,color:meta.color,lineHeight:1}}>{n.isEnding?'★':num}</span>
            </div>
          );
        }

        /* Full card */
        const inbound=edges.filter(e=>e.to===n.id).length;
        return (
          <div key={n.id} data-nc="1"
            onMouseDown={e=>onNodeDown(e,n)} onMouseUp={e=>onNodeUp(e,n)}
            title="Click to select · Double-click to edit"
            style={{position:'absolute',left:x,top:y,width:nw,minHeight:nh,zIndex:isSel?5:2,
              background:isSel?`linear-gradient(135deg,rgba(28,26,50,.98),rgba(18,16,38,.99))`:`rgba(10,9,20,0.95)`,
              border:`1px solid ${isSel?meta.color+'99':meta.color+'28'}`,
              borderTop:`2.5px solid ${meta.color}${isSel?'dd':'55'}`,
              borderRadius:Math.max(4,7*zoom),
              padding:`${Math.max(6,10*zoom)}px ${Math.max(7,12*zoom)}px`,
              boxShadow:isSel?`0 0 0 2px ${meta.color}22,0 14px 40px rgba(0,0,0,0.7)`:'0 4px 16px rgba(0,0,0,0.5)',
              cursor:'pointer',userSelect:'none',transition:'box-shadow .2s,border-color .2s'}}>
            <div style={{position:'absolute',top:0,right:0,width:Math.max(2,3*zoom),bottom:0,background:`${meta.color}12`,borderRadius:`0 ${7*zoom}px ${7*zoom}px 0`}}/>
            <div style={{position:'absolute',top:Math.max(4,6*zoom),right:Math.max(5,8*zoom),fontFamily:"'JetBrains Mono',monospace",fontSize:Math.max(7,8*zoom),color:meta.color,opacity:.5,fontWeight:600}}>#{num}</div>
            <div style={{display:'flex',alignItems:'center',gap:Math.max(3,5*zoom),marginBottom:Math.max(3,4*zoom),paddingRight:20*zoom}}>
              <span style={{fontSize:Math.max(9,10*zoom),color:meta.color,lineHeight:1}}>{meta.icon}</span>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:Math.max(7,8.5*zoom),color:meta.color,letterSpacing:'0.07em',textTransform:'uppercase',opacity:.85,flex:1}}>{meta.label}</span>
              {n.isStart&&<span style={{fontFamily:"'Cinzel',serif",fontSize:Math.max(5,6.5*zoom),color:C.green,background:'rgba(74,156,114,0.2)',padding:`1px ${3*zoom}px`,borderRadius:2}}>START</span>}
              {n.isEnding&&<span style={{fontSize:Math.max(8,10*zoom),color:C.rose,lineHeight:1}}>★</span>}
            </div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:Math.max(9,11*zoom),color:isSel?C.text:C.textDim,fontWeight:isSel?500:400,lineHeight:1.3,marginBottom:Math.max(3,4*zoom),overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{n.title}</div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:Math.max(7,8*zoom),color:C.textFaint,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'60%'}}>{n.id}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:Math.max(7,8*zoom),color:C.textFaint}}>
                <span style={{color:meta.color+'88'}}>↓{inbound}</span>{' '}<span style={{color:meta.color+'66'}}>→{n.choices.length}</span>
              </span>
            </div>
            {isSel&&zoom>0.58&&(
              <button data-nc="1" onClick={e=>{e.stopPropagation();copyContext(n.id);}}
                style={{position:'absolute',bottom:Math.max(4,5*zoom),right:Math.max(4,6*zoom),fontFamily:"'Cinzel',serif",fontSize:Math.max(7,8*zoom),padding:`${2*zoom}px ${5*zoom}px`,border:`1px solid ${copied?C.green:C.purple}55`,borderRadius:3*zoom,color:copied?C.green:C.purple,background:copied?'rgba(74,156,114,0.15)':'rgba(155,114,191,0.12)',cursor:'pointer',letterSpacing:'0.05em',transition:'all .2s',zIndex:6}}>
                {copied?'✓ Copied':'⊕ Copy'}
              </button>
            )}
          </div>
        );
      })}

      {/* Controls */}
      <div style={{position:'absolute',bottom:16,right:16,zIndex:10,display:'flex',flexDirection:'column',gap:4}}>
        {[['+',()=>setZoom(z=>Math.min(2.2,z+0.18))],['−',()=>setZoom(z=>Math.max(0.16,z-0.18))],['⊡',()=>{setZoom(0.86);setPan({x:60,y:60});}]].map(([l,fn])=>(
          <button key={l} onClick={fn} style={{width:30,height:30,borderRadius:6,background:'rgba(8,8,15,0.92)',border:`1px solid ${C.border}`,color:C.textDim,fontSize:l==='⊡'?13:18,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s',fontFamily:'monospace'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold+'66';e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textDim;}}>{l}</button>
        ))}
      </div>

      {/* Legend */}
      <div style={{position:'absolute',top:12,right:16,zIndex:10,background:'rgba(6,6,12,0.92)',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',backdropFilter:'blur(10px)'}}>
        <div style={{fontFamily:"'Cinzel',serif",fontSize:7.5,letterSpacing:'0.2em',color:C.textFaint,marginBottom:6,textTransform:'uppercase'}}>Types</div>
        {Object.entries(TYPE_META).map(([t,{color,label,icon}])=>(
          <div key={t} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
            <span style={{fontSize:9.5,color}}>{icon}</span>
            <span style={{fontFamily:"'Cinzel',serif",fontSize:8,color,letterSpacing:'0.05em'}}>{label}</span>
          </div>
        ))}
        <div style={{borderTop:`1px solid ${C.border}`,marginTop:6,paddingTop:6,fontFamily:"'JetBrains Mono',monospace",fontSize:7,color:C.textFaint,lineHeight:1.8}}>
          #n = BFS order<br/>★ = ending<br/>{mini?'↑ zoom for detail':'↓ zoom for mini'}
        </div>
      </div>

      {/* Stats */}
      <div style={{position:'absolute',top:12,left:12,zIndex:10,background:'rgba(6,6,12,0.9)',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',backdropFilter:'blur(10px)'}}>
        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint,lineHeight:2}}>
          <div><span style={{color:C.textDim}}>{Object.keys(nodes).length}</span> nodes</div>
          <div><span style={{color:C.textDim}}>{edges.length}</span> connections</div>
          <div><span style={{color:C.rose}}>{totalEndings}</span> endings</div>
          <div><span style={{color:edges.filter(e=>e.dead).length>0?'#555':C.green}}>{edges.filter(e=>e.dead).length}</span> dead ends</div>
        </div>
      </div>

      <div style={{position:'absolute',bottom:16,left:'50%',transform:'translateX(-50%)',zIndex:10,fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:11,color:C.textFaint,pointerEvents:'none',whiteSpace:'nowrap',background:'rgba(6,6,12,0.7)',padding:'4px 12px',borderRadius:20}}>
        {mini?'Mini view (circles = #BFS) · Scroll ↑ for detail':'Click to select · Double-click to edit · Drag to move · Scroll to zoom'}
      </div>
    </div>
  );
}

/* ═══ AUTHOR VIEW ════════════════════════════════════════════════════════ */
function AuthorView({ nodes, setNodes, sel, setSel, editNode, setEditNode, q, setQ, aTab, setATab, reachableSet, copyFlash, copyContext, renameNodeId, playtestFrom, addNode, setShowTut, curAuthor, curAuthorIdx, setCurAuthorIdx, found, totalEndings, hasUnsaved, confirmDiscard, commitNodePosition, persistNode, removeNodeRemote }) {

  const [editingId,setEditingId]=useState(false);
  const [newId,setNewId]=useState('');
  const [idErr,setIdErr]=useState('');
  const [saveState, setSaveState] = useState({ saving: false, error: null });
  const [autoSaveState, setAutoSaveState] = useState({ saving: false, error: null, savedAt: null });
  const autoSaveRef = useRef(null);
  const selectNode = id => {
    if (!id) return;
    if (sel !== id && confirmDiscard && !confirmDiscard()) return;
    const node = nodes[id];
    if (!node) return;
    setSel(id);
    setEditNode(normalizeNode(node));
    setEditingId(false);
  };

  const startIdEdit  = ()=>{ setNewId(editNode?.id||''); setEditingId(true); setIdErr(''); };
  const cancelIdEdit = ()=>{ setEditingId(false); setIdErr(''); };
  const commitIdEdit = ()=>{
    const t=newId.trim().replace(/\s+/g,'_');
    if(!t){setIdErr('ID cannot be empty');return;}
    if(t===editNode?.id){setEditingId(false);return;}
    if(nodes[t]){setIdErr('That ID is already taken');return;}
    if(!/^[a-zA-Z0-9_-]+$/.test(t)){setIdErr('Only letters, numbers, _ and - allowed');return;}
    if(renameNodeId(editNode.id,t)){setEditNode(p=>({...p,id:t}));setEditingId(false);setIdErr('');}
    else setIdErr('Rename failed');
  };

  const allNodes=Object.values(nodes);
  const filtered=allNodes.filter(n=>!q||n.title.toLowerCase().includes(q.toLowerCase())||n.id.toLowerCase().includes(q.toLowerCase())||(n.tags||[]).some(t=>t.includes(q.toLowerCase())));
  const filteredByMap = useMemo(() => {
    const list=[...filtered];
    return list.sort((a,b)=> {
      const ay=a.position?.y ?? 0, by=b.position?.y ?? 0;
      if(ay!==by) return ay-by;
      const ax=a.position?.x ?? 0, bx=b.position?.x ?? 0;
      if(ax!==bx) return ax-bx;
      return a.title.localeCompare(b.title);
    });
  }, [filtered]);
  const issues=(()=>{
    const iss=[];
    allNodes.forEach(n=>{
      if(!n.isEnding&&n.choices.length===0)iss.push({type:'warn',node:n.id,msg:`"${n.title}" has no choices`});
      n.choices.forEach(c=>{ if(!c.nextNodeId||!nodes[c.nextNodeId])iss.push({type:'error',node:n.id,msg:`"${n.title}" → "${c.text||'(empty)'}" → missing "${c.nextNodeId}"`}); });
      if(n.isEnding&&!n.endingData?.endingCategory)iss.push({type:'warn',node:n.id,msg:`Ending "${n.title}" has no category`});
    });
    const starts=allNodes.filter(n=>n.isStart);
    if(starts.length!==1)iss.push({type:'error',node:'',msg:`Expected 1 start node, found ${starts.length}`});
    return iss;
  })();

  const isCopied=copyFlash===sel;
  const canSave = hasUnsaved && !saveState.saving && !autoSaveState.saving;
  const showSave = hasUnsaved && (autoSaveState.error || saveState.error);
  const saveEdit=()=>{
    if(!editNode)return;
    if(autoSaveRef.current){ clearTimeout(autoSaveRef.current); autoSaveRef.current=null; }
    const next=normalizeNode(editNode);
    setSaveState({ saving: true, error: null });
    Promise.resolve(persistNode(next))
      .then(()=>{
        setNodes(p=>({...p,[next.id]:{...p[next.id],...next}}));
        setSaveState({ saving: false, error: null });
        setAutoSaveState(s=>({ ...s, error: null, savedAt: Date.now() }));
      })
      .catch((err)=>setSaveState({ saving: false, error: err?.message||'Save failed' }));
  };
  useEffect(() => {
    if (!editNode || !hasUnsaved || saveState.saving) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      const next = normalizeNode(editNode);
      setAutoSaveState(s => ({ ...s, saving: true, error: null }));
      Promise.resolve(persistNode(next))
        .then(() => {
          setNodes(p => ({ ...p, [next.id]: { ...p[next.id], ...next } }));
          setAutoSaveState({ saving: false, error: null, savedAt: Date.now() });
        })
        .catch((err) => setAutoSaveState({ saving: false, error: err?.message || 'Auto-save failed', savedAt: null }));
    }, 700);
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [editNode, hasUnsaved, saveState.saving, persistNode, setNodes]);
  useEffect(() => {
    setAutoSaveState(s => ({ ...s, error: null, savedAt: null }));
  }, [editNode?.id]);
  const delNode =id=>{ if(id==='start')return; setNodes(p=>{const n={...p};delete n[id];return n;}); removeNodeRemote(id); if(sel===id){setSel(null);setEditNode(null);} };
  const isValidNodeId = id => /^[a-zA-Z0-9_-]+$/.test(id);
  const createNodeFromChoice = (rawId, choiceIndex = 0) => {
    const id=(rawId||'').trim();
    if(!id || nodes[id] || !isValidNodeId(id)) return;
    const base = editNode || nodes[sel];
    const basePos = base?.position || { x: 300, y: 300 };
    const nn={
      id,
      title:id.replace(/_/g,' '),
      type:'scene',
      isStart:false,
      isEnding:false,
      createdAt:Date.now(),
      createdBy:curAuthor,
      text:'Write your scene here.',
      choices:[],
      tags:[],
      notes:'',
      position:{ x: basePos.x + 260, y: basePos.y + 80 + choiceIndex * 120 },
      isMultiPage:false,
      pages:[],
    };
    setNodes(p=>({...p,[id]:nn}));
    persistNode(nn);
  };
  const toggleMulti = checked => {
    setEditNode(n => {
      if (!n) return n;
      const pages = Array.isArray(n.pages) ? [...n.pages] : [];
      if (checked && pages.length === 0) {
        pages.push(mkPage(n.text || ''));
      }
      if (!checked && pages.length > 0) {
        const firstText = pages[0]?.text || n.text || '';
        return { ...n, isMultiPage: false, text: firstText, pages };
      }
      return { ...n, isMultiPage: checked, pages };
    });
  };
  const addPage = () => {
    setEditNode(n => {
      if (!n) return n;
      const pages = Array.isArray(n.pages) ? [...n.pages] : [];
      pages.push(mkPage());
      return { ...n, isMultiPage: true, pages };
    });
  };
  const updatePage = (idx, patch) => {
    setEditNode(n => {
      if (!n) return n;
      const pages = Array.isArray(n.pages) ? [...n.pages] : [];
      const cur = pages[idx] || mkPage();
      pages[idx] = { ...cur, ...patch };
      return { ...n, pages };
    });
  };
  const removePage = idx => {
    setEditNode(n => {
      if (!n) return n;
      const pages = (Array.isArray(n.pages) ? n.pages : []).filter((_,i)=>i!==idx);
      return { ...n, pages };
    });
  };
  const quickText = useMemo(() => {
    if (!editNode) return '';
    if (editNode.isMultiPage) {
      return editNode.pages?.[0]?.text || '';
    }
    return editNode.text || '';
  }, [editNode]);
  const updateQuickText = (value) => {
    setEditNode(n => {
      if (!n) return n;
      if (n.isMultiPage) {
        const pages = Array.isArray(n.pages) ? [...n.pages] : [];
        if (pages.length === 0) pages.push(mkPage(''));
        pages[0] = { ...pages[0], text: value };
        return { ...n, pages };
      }
      return { ...n, text: value };
    });
  };
  const setQuickType = (t) => {
    setEditNode(n => ({
      ...n,
      type:t,
      isEnding:t==='ending',
      isStart:t==='start',
      endingData:t==='ending'?(n.endingData||{endingNumber:0,endingTitle:'',endingCategory:'',summary:'',loopConditions:{childBorn:false,clueLeft:false,deathOccurred:false,loopRestarts:true}}):n.endingData
    }));
  };
  useEffect(() => {
    if (aTab !== 'map') return;
    if (!sel || !nodes[sel]) return;
    if (!editNode || editNode.id !== sel) {
      setEditNode(normalizeNode(nodes[sel]));
    }
  }, [aTab, sel, nodes, editNode, setEditNode]);

  // Sub-tabs including analytics and notes
  const TABS = [['nodes','Nodes'],['map','Map ⬡'],['endings','End'],['notes','Notes ✎'],['analytics','Stats'],['validate',`Issues${issues.length?` (${issues.length})`:''}`]];

  return (
    <div style={{display:'flex',height:'calc(100vh - 54px)',marginTop:54,background:C.bg,overflow:'hidden'}}>

      {/* ─── Sidebar ─── */}
      <div style={{width:240,flexShrink:0,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',background:C.bg2,overflow:'hidden'}}>
        {aTab!=='notes'&&aTab!=='analytics'&&(
          <div style={{padding:'10px 10px 8px',borderBottom:`1px solid ${C.border}`}}>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search nodes…"
              style={{...IST,padding:'7px 10px',fontSize:12,fontFamily:"'JetBrains Mono',monospace"}}/>
          </div>
        )}
        <div style={{padding:'6px 7px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:2,flexWrap:'wrap'}}>
          {TABS.map(([t,l])=>(
            <button key={t} onClick={()=>setATab(t)}
              style={{flex:'1 1 auto',padding:'5px 2px',borderRadius:4,fontSize:8,fontFamily:"'Cinzel',serif",letterSpacing:'0.04em',
                color:aTab===t?C.bg:C.textDim,
                background:aTab===t?(t==='map'?C.purple:t==='notes'?C.blue:t==='analytics'?C.green:C.gold):'transparent',
                border:`1px solid ${aTab===t?(t==='map'?C.purple:t==='notes'?C.blue:t==='analytics'?C.green:C.gold):C.border}`,
                transition:'all .15s',cursor:'pointer',whiteSpace:'nowrap'}}>{l}</button>
          ))}
        </div>

        {aTab==='nodes'&&(
          <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
            {filteredByMap.map(n=>{
              const dead=n.choices.length>0&&n.choices.every(c=>!reachableSet.has(c.nextNodeId));
              return (
                <div key={n.id} onClick={()=>selectNode(n.id)}
                  style={{padding:'8px 11px',cursor:'pointer',borderLeft:`3px solid ${sel===n.id?(TYPE_META[n.type]?.color||C.gold):'transparent'}`,background:sel===n.id?'rgba(255,255,255,0.06)':'transparent',transition:'all .15s',borderBottom:`1px solid ${C.border}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
                    <span style={{fontSize:9.5,color:TYPE_META[n.type]?.color||C.textDim}}>{TYPE_META[n.type]?.icon||'◇'}</span>
                    <span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:sel===n.id?C.text:C.textDim,fontWeight:sel===n.id?500:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{n.title}</span>
                    {dead&&<span style={{fontSize:8,color:'#666',flexShrink:0}}>⚠</span>}
                  </div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.textFaint,paddingLeft:15,display:'flex',gap:7}}>
                    <span>{n.id}</span>
                    <span style={{color:AUTHOR_COLORS[AUTHORS.indexOf(n.createdBy)]||C.textDim,opacity:.8}}>{n.createdBy}</span>
                  </div>
                </div>
              );
            })}
            <div style={{padding:'8px 10px'}}>
              <button onClick={addNode} style={{width:'100%',padding:'7px',border:`1px dashed ${C.goldDim}`,borderRadius:5,color:C.goldDim,fontSize:10,fontFamily:"'Cinzel',serif",letterSpacing:'0.1em',cursor:'pointer',background:'transparent',transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.goldDim;e.currentTarget.style.color=C.goldDim;}}>+ New Node</button>
            </div>
          </div>
        )}

        {aTab==='map'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:12,padding:14,overflowY:'auto'}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:9.5,letterSpacing:'0.2em',color:C.purple,textTransform:'uppercase'}}>Quick Edit</div>
            {editNode?(
              <>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>id: {editNode.id}</div>
                <div>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:8.5,letterSpacing:'0.16em',color:C.textFaint,textTransform:'uppercase',marginBottom:6}}>Title</div>
                  <input value={editNode.title||''} onChange={e=>setEditNode(n=>({...n,title:e.target.value}))} style={{...IST,padding:'6px 9px',fontSize:12}}/>
                </div>
                <div>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:8.5,letterSpacing:'0.16em',color:C.textFaint,textTransform:'uppercase',marginBottom:6}}>Type</div>
                  <select value={editNode.type||'scene'} onChange={e=>setQuickType(e.target.value)} style={{...IST,padding:'6px 9px',fontSize:12}}>
                    {Object.entries(TYPE_META).map(([t,{label}])=>(
                      <option key={t} value={t}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{fontFamily:"'Cinzel',serif",fontSize:8.5,letterSpacing:'0.16em',color:C.textFaint,textTransform:'uppercase',marginBottom:6}}>
                    {editNode.isMultiPage?'Page 1 Text':'Story Text'}
                  </div>
                  <textarea value={quickText} onChange={e=>updateQuickText(e.target.value)} rows={6}
                    style={{...IST,resize:'vertical',fontFamily:"'Cormorant Garamond',serif",fontSize:15,lineHeight:1.6}}/>
                  {editNode.isMultiPage&&(
                    <div style={{marginTop:6,fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>Multi-page node: editing page 1 only.</div>
                  )}
                </div>
                <button onClick={()=>setATab('nodes')}
                  style={{alignSelf:'flex-start',padding:'6px 10px',border:`1px solid ${C.purple}55`,borderRadius:5,color:C.purple,fontSize:9.5,fontFamily:"'Cinzel',serif",letterSpacing:'0.08em',background:'transparent',cursor:'pointer'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purple;e.currentTarget.style.color=C.purple;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.purple+'55';e.currentTarget.style.color=C.purple;}}>Open Full Editor</button>
              </>
            ):(
              <div style={{display:'flex',flexDirection:'column',gap:8,color:C.textFaint,fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:13}}>
                <div>Select a node to edit.</div>
                <div style={{fontSize:9.5,fontStyle:'normal',fontFamily:"'JetBrains Mono',monospace",lineHeight:1.9,opacity:.8}}>click → select<br/>double-click → edit<br/>drag → move<br/>scroll → zoom</div>
              </div>
            )}
            <div style={{marginTop:'auto',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint,opacity:.8}}>Auto-saves as you type.</div>
              <button onClick={addNode} style={{width:'100%',padding:'7px',border:`1px dashed ${C.goldDim}`,borderRadius:5,color:C.goldDim,fontSize:10,fontFamily:"'Cinzel',serif",letterSpacing:'0.1em',cursor:'pointer',background:'transparent'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.goldDim;e.currentTarget.style.color=C.goldDim;}}>+ New Node</button>
            </div>
          </div>
        )}

        {aTab==='endings'&&(
          <div style={{flex:1,overflowY:'auto',padding:'4px 0'}}>
            {allNodes.filter(n=>n.isEnding).map(n=>(
              <div key={n.id} onClick={()=>selectNode(n.id)} style={{padding:'8px 11px',cursor:'pointer',borderLeft:`3px solid ${sel===n.id?C.rose:'transparent'}`,background:sel===n.id?'rgba(255,255,255,0.06)':'transparent',borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:found.has(n.id)?C.rose:C.textDim,marginBottom:2}}>{found.has(n.id)?'★ ':''}{n.endingData?.endingTitle||n.title}</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.textFaint}}>{n.endingData?.endingCategory||'—'}</div>
              </div>
            ))}
          </div>
        )}

        {aTab==='notes'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:18,color:C.textFaint,fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:13,textAlign:'center',gap:8}}>
            <div style={{fontSize:26,opacity:.2,color:C.blue}}>✎</div>
            <div>Notes are in the main panel.</div>
          </div>
        )}

        {aTab==='analytics'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:18,color:C.textFaint,fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:13,textAlign:'center',gap:8}}>
            <div style={{fontSize:26,opacity:.2,color:C.green}}>◈</div>
            <div>Dashboard is in the main panel.</div>
          </div>
        )}

        {aTab==='validate'&&(
          <div style={{flex:1,overflowY:'auto',padding:'7px'}}>
            {issues.length===0
              ?<div style={{padding:18,textAlign:'center',color:C.textDim,fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:14}}>No issues ✓</div>
              :issues.map((iss,i)=>(
                <div key={i} onClick={()=>iss.node&&selectNode(iss.node)}
                  style={{padding:'8px 9px',marginBottom:4,borderRadius:5,background:iss.type==='error'?'rgba(191,91,122,0.1)':'rgba(196,144,58,0.08)',border:`1px solid ${iss.type==='error'?C.rose+'33':C.gold+'22'}`,cursor:iss.node?'pointer':'default'}}>
                  <div style={{fontSize:8,fontFamily:"'Cinzel',serif",color:iss.type==='error'?C.rose:C.gold,letterSpacing:'0.1em',marginBottom:2}}>{iss.type.toUpperCase()}</div>
                  <div style={{fontSize:11,color:C.textDim,fontFamily:"'Cormorant Garamond',serif",lineHeight:1.5}}>{iss.msg}</div>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* ─── Main panel ─── */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Toolbar */}
        <div style={{display:'flex',alignItems:'center',gap:7,padding:'8px 14px',borderBottom:`1px solid ${C.border}`,background:C.bg2,flexShrink:0}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:'0.15em',color:C.textFaint,textTransform:'uppercase'}}>
            {aTab==='map'?'Node Map':aTab==='notes'?'Notes':aTab==='analytics'?'Dashboard':sel&&nodes[sel]?`Editing: ${nodes[sel].title}`:'Select a node'}
          </span>
          <div style={{flex:1}}/>
          <button onClick={()=>setShowTut(true)} title="Guide" style={{width:26,height:26,borderRadius:5,background:'transparent',border:`1px solid ${C.border}`,color:C.textDim,fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold+'66';e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textDim;}}>?</button>
          {sel&&nodes[sel]&&aTab!=='notes'&&aTab!=='analytics'&&(<>
            <button onClick={()=>copyContext(sel)} style={{fontFamily:"'Cinzel',serif",fontSize:9.5,letterSpacing:'0.08em',padding:'5px 11px',border:`1px solid ${isCopied?C.green+'66':C.purple+'55'}`,borderRadius:4,color:isCopied?C.green:C.purple,background:isCopied?'rgba(74,156,114,0.1)':'rgba(155,114,191,0.08)',cursor:'pointer',transition:'all .2s'}}>{isCopied?'✓ Copied!':'⊕ Copy Context'}</button>
            <button onClick={()=>playtestFrom(sel)} style={{fontFamily:"'Cinzel',serif",fontSize:9.5,letterSpacing:'0.1em',padding:'5px 11px',border:`1px solid ${C.goldDim}`,borderRadius:4,color:C.gold,background:'transparent',cursor:'pointer',transition:'all .15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(196,144,58,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>▶ Playtest</button>
            {showSave&&(
              <button onClick={saveEdit} disabled={!canSave}
                style={{fontFamily:"'Cinzel',serif",fontSize:9.5,letterSpacing:'0.1em',padding:'5px 11px',border:'none',borderRadius:4,color:C.bg,background:C.gold,cursor:!canSave?'not-allowed':'pointer',transition:'all .15s',opacity:!canSave?0.55:1}}
                onMouseEnter={e=>{if(canSave)e.currentTarget.style.background='#d4a04a';}} onMouseLeave={e=>{e.currentTarget.style.background=C.gold;}}>Save Changes</button>
            )}
            {autoSaveState.saving&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>Auto-saving...</span>}
            {!hasUnsaved&&autoSaveState.savedAt&&!saveState.saving&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>Auto-saved</span>}
            {saveState.saving&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>Saving...</span>}
            {saveState.error&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.rose,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{saveState.error}</span>}
            {autoSaveState.error&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.rose,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{autoSaveState.error}</span>}
            {!editNode?.isStart&&<button onClick={()=>delNode(sel)} style={{fontFamily:"'Cinzel',serif",fontSize:9.5,letterSpacing:'0.1em',padding:'5px 11px',border:`1px solid ${C.rose}44`,borderRadius:4,color:C.rose,background:'transparent',cursor:'pointer',transition:'all .15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(191,91,122,0.1)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>Delete</button>}
          </>)}
        </div>

        {/* Content */}
        {aTab==='map'&&<div style={{flex:1,overflow:'hidden'}}><MapView nodes={nodes} setNodes={setNodes} sel={sel} setSel={setSel} setEditNode={setEditNode} setATab={setATab} reachableSet={reachableSet} totalEndings={totalEndings} copyFlash={copyFlash} copyContext={copyContext} confirmDiscard={confirmDiscard} commitNodePosition={commitNodePosition}/></div>}
        {aTab==='notes'&&<div style={{flex:1,overflow:'hidden'}}><NotesView/></div>}
        {aTab==='analytics'&&<AnalyticsView nodes={nodes} found={found} totalEndings={totalEndings} loopN={1} curAuthorIdx={curAuthorIdx} setCurAuthorIdx={setCurAuthorIdx} onAddNode={addNode} reachableSet={reachableSet}/>}

        {(aTab==='nodes'||aTab==='endings'||aTab==='validate')&&(
          <div style={{flex:1,overflowY:'auto',padding:'22px'}}>
            {editNode?(
              <div style={{maxWidth:700,margin:'0 auto'}}>
                {isCopied&&<div style={{background:'rgba(74,156,114,0.08)',border:`1px solid ${C.green}33`,borderRadius:7,padding:'9px 14px',marginBottom:18,fontFamily:"'Cormorant Garamond',serif",fontSize:13,color:C.green}}>✓ Context copied — paste into Claude for writing help.</div>}

                {/* Node ID */}
                <div style={{marginBottom:20}}>
                  <label style={{display:'block',fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:'0.2em',color:C.textDim,textTransform:'uppercase',marginBottom:8}}>Node ID</label>
                  {editingId?(
                    <div>
                      <div style={{display:'flex',gap:8,marginBottom:4}}>
                        <input value={newId} autoFocus onChange={e=>{setNewId(e.target.value.replace(/\s/g,'_'));setIdErr('');}} onKeyDown={e=>{if(e.key==='Enter')commitIdEdit();if(e.key==='Escape')cancelIdEdit();}}
                          style={{...IST,fontFamily:"'JetBrains Mono',monospace",fontSize:13,flex:1,borderColor:idErr?C.rose+'66':'rgba(255,255,255,0.1)'}}/>
                        <button onClick={commitIdEdit} style={{fontFamily:"'Cinzel',serif",fontSize:10,padding:'0 13px',borderRadius:4,color:C.bg,background:C.green,border:'none',cursor:'pointer',flexShrink:0}}>Rename</button>
                        <button onClick={cancelIdEdit} style={{fontFamily:"'Cinzel',serif",fontSize:10,padding:'0 11px',borderRadius:4,color:C.textDim,background:'transparent',border:`1px solid ${C.border}`,cursor:'pointer',flexShrink:0}}>Cancel</button>
                      </div>
                      {idErr&&<div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.rose,marginBottom:4}}>{idErr}</div>}
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textFaint}}>All inbound links updated automatically.</div>
                    </div>
                  ):(
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:C.text,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:5,padding:'8px 12px',flex:1}}>{editNode.id}</div>
                      <button onClick={startIdEdit} style={{fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:'0.1em',padding:'8px 13px',border:`1px solid ${C.border}`,borderRadius:5,color:C.textDim,background:'transparent',cursor:'pointer',transition:'all .15s',flexShrink:0}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold+'66';e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textDim;}}>✎ Rename</button>
                    </div>
                  )}
                </div>

                <Field label="Title">
                  <input value={editNode.title} onChange={e=>setEditNode(n=>({...n,title:e.target.value}))} style={IST}/>
                </Field>

                <Field label="Type">
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {Object.entries(TYPE_META).map(([t,{color,label,icon}])=>(
                      <button key={t} onClick={()=>setEditNode(n=>({...n,type:t,isEnding:t==='ending',isStart:t==='start',endingData:t==='ending'?(n.endingData||{endingNumber:0,endingTitle:'',endingCategory:'',summary:'',loopConditions:{childBorn:false,clueLeft:false,deathOccurred:false,loopRestarts:true}}):n.endingData}))}
                        style={{padding:'5px 12px',borderRadius:4,fontSize:10,fontFamily:"'Cinzel',serif",letterSpacing:'0.08em',color:editNode.type===t?C.bg:color,background:editNode.type===t?color:'transparent',border:`1px solid ${color}55`,cursor:'pointer',transition:'all .15s'}}>{icon} {label}</button>
                    ))}
                  </div>
                </Field>

                <Field label="Story Mode">
                  <label style={{display:'flex',alignItems:'center',gap:8,fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.textDim}}>
                    <input type="checkbox" checked={!!editNode.isMultiPage} onChange={e=>toggleMulti(e.target.checked)} style={{accentColor:C.gold}}/>
                    Multi-page node (pacing)
                  </label>
                </Field>

                {!editNode.isMultiPage&&(
                  <Field label="Story Text">
                    <textarea value={editNode.text} onChange={e=>setEditNode(n=>({...n,text:e.target.value}))} rows={8}
                      style={{...IST,resize:'vertical',fontFamily:"'Cormorant Garamond',serif",fontSize:17,lineHeight:1.7}}/>
                  </Field>
                )}

                {editNode.isMultiPage&&(
                  <Field label="Pages">
                    <div style={{display:'flex',flexDirection:'column',gap:12}}>
                      {(editNode.pages||[]).length===0&&(
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:13,color:C.textFaint}}>No pages yet. Add the first page below.</div>
                      )}
                      {(editNode.pages||[]).map((p,i)=>(
                        <div key={p.id||i} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${C.border}`,borderRadius:6,padding:10}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.textFaint}}>Page {i+1}</span>
                            <button onClick={()=>removePage(i)} style={{fontSize:10,color:C.rose,opacity:.7,cursor:'pointer'}}>Remove</button>
                          </div>
                          <textarea value={p.text||''} onChange={e=>updatePage(i,{text:e.target.value})} rows={6}
                            style={{...IST,resize:'vertical',fontFamily:"'Cormorant Garamond',serif",fontSize:16,lineHeight:1.7,marginBottom:8}}/>
                          <input value={p.buttonLabel||''} onChange={e=>updatePage(i,{buttonLabel:e.target.value})} placeholder="Next button text"
                            style={{...IST,fontFamily:"'JetBrains Mono',monospace",fontSize:11}}/>
                        </div>
                      ))}
                      <button onClick={addPage}
                        style={{padding:'7px',border:`1px dashed ${C.goldDim}44`,borderRadius:5,color:C.textDim,fontSize:10.5,fontFamily:"'Cinzel',serif",letterSpacing:'0.08em',cursor:'pointer',background:'transparent'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.goldDim;e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.goldDim+'44';e.currentTarget.style.color=C.textDim;}}>+ Add Page</button>
                    </div>
                  </Field>
                )}

                {!editNode.isEnding&&(
                  <Field label="Choices">
                    <div style={{display:'flex',flexDirection:'column',gap:7}}>
                      {editNode.choices.map((c,i)=>{
                        const targetId=(c.nextNodeId||'').trim();
                        const exists=!!nodes[targetId];
                        const alive=reachableSet.has(targetId);
                        const canCreate=!!targetId&&!exists&&isValidNodeId(targetId);
                        return (
                          <div key={c.id} style={{display:'flex',gap:7,alignItems:'center',background:(!alive&&exists)?'rgba(255,80,80,0.04)':'rgba(255,255,255,0.03)',border:`1px solid ${(!alive&&exists)?C.rose+'22':C.border}`,borderRadius:6,padding:'8px 10px'}}>
                            <span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:C.goldDim,minWidth:14}}>{i+1}</span>
                            <input value={c.text} onChange={e=>{const ch=[...editNode.choices];ch[i]={...c,text:e.target.value};setEditNode(n=>({...n,choices:ch}));}} placeholder="Choice text" style={{flex:2,...IST,padding:'4px 8px'}}/>
                            <span style={{fontSize:10,color:C.textFaint,flexShrink:0}}>→</span>
                            <input value={c.nextNodeId} onChange={e=>{const ch=[...editNode.choices];ch[i]={...c,nextNodeId:e.target.value};setEditNode(n=>({...n,choices:ch}));}} placeholder="node_id"
                              style={{flex:1,...IST,padding:'4px 8px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,borderColor:(!exists&&targetId)?C.rose+'66':'rgba(255,255,255,0.1)'}}/>
                            {canCreate&&(
                              <button onClick={()=>createNodeFromChoice(targetId,i)}
                                style={{padding:'3px 7px',border:`1px solid ${C.goldDim}55`,borderRadius:4,fontSize:9,fontFamily:"'Cinzel',serif",letterSpacing:'0.08em',color:C.goldDim,background:'transparent',cursor:'pointer',flexShrink:0}}
                                onMouseEnter={e=>{e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.goldDim+'55';e.currentTarget.style.color=C.goldDim;}}>+ Create</button>
                            )}
                            {(!alive&&exists)&&<span title="Dead end" style={{color:C.rose,fontSize:10,flexShrink:0}}>⚠</span>}
                            <button onClick={()=>{const ch=editNode.choices.filter((_,j)=>j!==i);setEditNode(n=>({...n,choices:ch}));}}
                              style={{color:C.rose,fontSize:13,padding:'0 3px',opacity:.6,cursor:'pointer',flexShrink:0,background:'transparent'}}>✕</button>
                          </div>
                        );
                      })}
                      <button onClick={()=>setEditNode(n=>({...n,choices:[...n.choices,{id:'c'+Date.now(),text:'',nextNodeId:''}]}))}
                        style={{padding:'7px',border:`1px dashed ${C.goldDim}44`,borderRadius:5,color:C.textDim,fontSize:10.5,fontFamily:"'Cinzel',serif",letterSpacing:'0.08em',cursor:'pointer',background:'transparent'}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.goldDim;e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.goldDim+'44';e.currentTarget.style.color=C.textDim;}}>+ Add Choice</button>
                    </div>
                  </Field>
                )}

                {editNode.isEnding&&editNode.endingData&&(
                  <Field label="Ending Details">
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',gap:8}}>
                        <input value={editNode.endingData.endingNumber||''} onChange={e=>setEditNode(n=>({...n,endingData:{...n.endingData,endingNumber:parseInt(e.target.value)||0}}))} placeholder="#" style={{width:66,...IST}}/>
                        <input value={editNode.endingData.endingTitle||''} onChange={e=>setEditNode(n=>({...n,endingData:{...n.endingData,endingTitle:e.target.value}}))} placeholder="Ending Title" style={{flex:1,...IST}}/>
                      </div>
                      <select value={editNode.endingData.endingCategory||''} onChange={e=>setEditNode(n=>({...n,endingData:{...n.endingData,endingCategory:e.target.value}}))} style={IST}>
                        <option value="">Select category…</option>
                        {ENDING_CATS.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                      <textarea value={editNode.endingData.summary||''} onChange={e=>setEditNode(n=>({...n,endingData:{...n.endingData,summary:e.target.value}}))} placeholder="Summary (for gallery)" rows={2} style={{...IST,resize:'vertical'}}/>
                      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:4}}>
                        {Object.entries(LOOP_LBL).map(([k,lbl])=>(
                          <label key={k} style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,color:editNode.endingData.loopConditions?.[k]?C.gold:C.textFaint}}>
                            <input type="checkbox" checked={editNode.endingData.loopConditions?.[k]||false}
                              onChange={e=>setEditNode(n=>({...n,endingData:{...n.endingData,loopConditions:{...(n.endingData.loopConditions||{}),[k]:e.target.checked}}}))}
                              style={{accentColor:C.gold}}/>{lbl}
                          </label>
                        ))}
                      </div>
                    </div>
                  </Field>
                )}

                <Field label="Tags">
                  <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                    {ALL_TAGS.map(t=>(
                      <button key={t} onClick={()=>setEditNode(n=>({...n,tags:(n.tags||[]).includes(t)?(n.tags||[]).filter(x=>x!==t):[...(n.tags||[]),t]}))}
                        style={{padding:'3px 9px',borderRadius:100,fontSize:9.5,fontFamily:"'JetBrains Mono',monospace",color:(editNode.tags||[]).includes(t)?C.bg:C.textFaint,background:(editNode.tags||[]).includes(t)?C.gold:'transparent',border:`1px solid ${(editNode.tags||[]).includes(t)?C.gold:C.border}`,cursor:'pointer',transition:'all .12s'}}>{t}</button>
                    ))}
                  </div>
                </Field>

                <Field label="Notes">
                  <textarea value={editNode.notes||''} onChange={e=>setEditNode(n=>({...n,notes:e.target.value}))} rows={2} placeholder="Author notes (not shown to players)"
                    style={{...IST,resize:'vertical',fontStyle:'italic',opacity:.8}}/>
                </Field>

                <div style={{paddingTop:14,borderTop:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:C.textFaint}}>
                    by <span style={{color:AUTHOR_COLORS[AUTHORS.indexOf(editNode.createdBy)]||C.textDim}}>{editNode.createdBy||'Unknown'}</span>
                    {editNode.createdAt&&<> · {fmtDate(editNode.createdAt)}</>}
                  </div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:reachableSet.has(editNode.id)?C.green:C.rose}}>
                    {reachableSet.has(editNode.id)?'✓ reaches ending':'⚠ no path to ending'}
                  </div>
                </div>
              </div>
            ):(
              <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:C.textFaint,fontFamily:"'Cormorant Garamond',serif",fontStyle:'italic',fontSize:17,gap:12,paddingBottom:80}}>
                <div style={{fontSize:32,opacity:.14}}>⌘</div>
                Select a node to edit
                <div style={{fontSize:13,opacity:.6}}>or open <strong style={{fontFamily:"'Cinzel',serif",fontStyle:'normal',color:C.purple+'55'}}>Map ⬡</strong> for the full structure</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ ROOT APP ═══════════════════════════════════════════════════════════ */
export default function App() {
  const [mode,         setMode]         = useState('reader');
  const [nodes,        setNodes]        = useState({});
  const [nodeId,       setNodeId]       = useState('start');
  const [found,        setFound]        = useState(new Set());
  const [loopN,        setLoopN]        = useState(1);
  const [fading,       setFading]       = useState(false);
  const [showEnd,      setShowEnd]      = useState(false);
  const [sel,          setSel]          = useState(null);
  const [q,            setQ]            = useState('');
  const [editNode,     setEditNode]     = useState(null);
  const [aTab,         setATab]         = useState('nodes');
  const [showTut,      setShowTut]      = useState(false);
  const [tutSeen,      setTutSeen]      = useState(false);
  const [curAuthorIdx, setCurAuthorIdx] = useState(0);
  const [authUnlocked, setAuthUnlocked] = useState(false);
  const [copyFlash,    setCopyFlash]    = useState(null);
  const [pageIdx,      setPageIdx]      = useState(0);

  const curNode      = nodes[nodeId];
  const totalEndings = Object.values(nodes).filter(n=>n.isEnding).length;
  const curAuthor    = AUTHORS[curAuthorIdx];
  const hasUnsaved   = useMemo(() => {
    if (!editNode) return false;
    const base = nodes[editNode.id];
    if (!base) return false;
    const clean = n => {
      if (!n) return n;
      const { position, updatedAt, ...rest } = normalizeNode(n);
      return rest;
    };
    return JSON.stringify(clean(base)) !== JSON.stringify(clean(editNode));
  }, [editNode, nodes]);
  const confirmDiscard = useCallback(() => {
    if (!hasUnsaved) return true;
    return window.confirm("You have unsaved changes. Switching nodes will discard them. Continue?");
  }, [hasUnsaved]);

  useEffect(() => {
    const unsub = onSnapshot(NODES_COL, (snap) => {
      const map = {};
      snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const createdBy = AUTHOR_REMAP[data.createdBy] || data.createdBy || AUTHORS[0];
        map[docSnap.id] = normalizeNode({ ...data, id: docSnap.id, createdBy });
      });
      setNodes(map);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (nodes[nodeId]) return;
    const fallbackId = nodes.start ? "start" : Object.keys(nodes)[0];
    if (fallbackId) setNodeId(fallbackId);
  }, [nodes, nodeId]);

  useEffect(() => {
    setPageIdx(0);
  }, [nodeId]);

  useEffect(() => {
    if (sel && !nodes[sel]) {
      setSel(null);
      setEditNode(null);
    }
  }, [nodes, sel]);

  useEffect(()=>{ if(mode==='author'&&authUnlocked&&!tutSeen){setShowTut(true);setTutSeen(true);} },[mode,authUnlocked]);

  const reachableSet = useMemo(()=>{
    const reach=new Set(Object.values(nodes).filter(n=>n.isEnding).map(n=>n.id));
    let changed=true;
    while(changed){ changed=false; Object.values(nodes).forEach(n=>{ if(!reach.has(n.id)&&n.choices.some(c=>reach.has(c.nextNodeId))){ reach.add(n.id); changed=true; } }); }
    return reach;
  },[nodes]);

  const getShortestPath = useCallback((targetId)=>{
    if(targetId==='start')return[{nodeId:'start',choiceTaken:null}];
    const queue=[{path:[{nodeId:'start',choiceTaken:null}]}],visited=new Set(['start']);
    while(queue.length){
      const{path}=queue.shift(),last=path[path.length-1],n=nodes[last.nodeId]; if(!n)continue;
      for(const c of n.choices){ if(!c.nextNodeId)continue; const np=[...path,{nodeId:c.nextNodeId,choiceTaken:c.text}]; if(c.nextNodeId===targetId)return np; if(!visited.has(c.nextNodeId)){visited.add(c.nextNodeId);queue.push({path:np});} }
    }
    return null;
  },[nodes]);

  const copyContext = useCallback((targetId)=>{
    const path=getShortestPath(targetId),target=nodes[targetId]; if(!target)return;
    let out=`=== AI WRITING CONTEXT: "${target.title}" ===\nStory: The Loop · Type: ${target.type}\n`;
    if(path){
      out+=`Shortest path: ${path.length} steps\n\n${'─'.repeat(50)}\n\n`;
      path.forEach((step,i)=>{ const n=nodes[step.nodeId];if(!n)return; const isTgt=step.nodeId===targetId; const nodeText=getNodeText(n); out+=`[${i+1}] ${n.title.toUpperCase()} (${n.type})${isTgt?' ← WRITE HERE':''}\n${nodeText}\n`; if(!isTgt&&path[i+1])out+=`\n→ CHOICE: "${path[i+1].choiceTaken}"\n`; out+='\n'; });
      out+=`${'─'.repeat(50)}\nWriting for: "${target.title}".\n`;
      if(target.choices.length>0){out+='Available exits:\n';target.choices.forEach((c,i)=>{out+=`  ${i+1}. "${c.text}" → ${c.nextNodeId}\n`;});}
    } else { out+=`\n(Node unreachable from start)\n\n${getNodeText(target)}\n`; }
    out+='\n=== END CONTEXT ===';
    copyToClipboard(out);
    setCopyFlash(targetId); setTimeout(()=>setCopyFlash(null),2200);
  },[nodes,getShortestPath]);

  const persistNode = useCallback((node) => {
    if (!node || !node.id) return Promise.resolve();
    const payload = stripUndefined({ ...node, id: node.id, updatedAt: serverTimestamp() });
    return setDoc(doc(db, "time-loop-cyoa-nodes", node.id), payload, { merge: true });
  }, []);

  const removeNodeRemote = useCallback((id) => {
    if (!id) return Promise.resolve();
    return deleteDoc(doc(db, "time-loop-cyoa-nodes", id)).catch(() => undefined);
  }, []);

  const commitNodePosition = useCallback((id, position) => {
    if (!id || !position) return;
    setDoc(doc(db, "time-loop-cyoa-nodes", id), { position, updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
  }, []);

  const renameNodeId = useCallback((oldId,newId)=>{
    if(!newId||newId===oldId||nodes[newId])return false;
    const updated={};
    Object.values(nodes).forEach(n=>{ const rn={...n,id:n.id===oldId?newId:n.id,choices:n.choices.map(c=>({...c,nextNodeId:c.nextNodeId===oldId?newId:c.nextNodeId}))}; updated[rn.id]=rn; });
    setNodes(updated); if(sel===oldId)setSel(newId); if(nodeId===oldId)setNodeId(newId);
    Object.values(updated).forEach(n=>persistNode(n));
    removeNodeRemote(oldId);
    return true;
  },[nodes,sel,nodeId,persistNode,removeNodeRemote]);

  const go          = useCallback((id)=>{ if(!nodes[id])return; setFading(true); setTimeout(()=>{ setNodeId(id); if(nodes[id]?.isEnding){setFound(f=>new Set([...f,id]));setShowEnd(true);}else setShowEnd(false); setFading(false); },300); },[nodes]);
  const restart     = useCallback(()=>{ setFading(true); setTimeout(()=>{ const nextId = nodes.start ? 'start' : Object.keys(nodes)[0]; if(nextId) setNodeId(nextId); setShowEnd(false); setLoopN(l=>l+1); setFading(false); },400); },[nodes]);
  const playtestFrom= useCallback((id)=>{ setNodeId(id); setShowEnd(nodes[id]?.isEnding||false); setMode('reader'); setFading(false); },[nodes]);
  const addNode     = useCallback(()=>{
    if (confirmDiscard && !confirmDiscard()) return;
    const isFirst = Object.keys(nodes).length === 0;
    const id = isFirst ? 'start' : `node_${Date.now()}`;
    const nn={id,title:isFirst?'Start':'New Scene',type:isFirst?'start':'scene',isStart:isFirst,isEnding:false,createdAt:Date.now(),createdBy:curAuthor,text:'Write your scene here.',choices:[],tags:[],notes:'',position:{x:300,y:300},isMultiPage:false,pages:[]};
    setNodes(p=>({...p,[id]:nn})); persistNode(nn); setEditNode(normalizeNode(nn)); setSel(id); setATab('nodes'); setMode('author'); if(isFirst)setNodeId(id);
  },[curAuthor,nodes,confirmDiscard,persistNode]);

  return (
    <div style={{background:C.bg,minHeight:'100vh',color:C.text,fontFamily:"'Cormorant Garamond',serif"}}>
      <style>{GLOBAL_CSS}</style>
      <Header mode={mode} setMode={setMode} authUnlocked={authUnlocked} found={found} totalEndings={totalEndings} loopN={loopN} curAuthorIdx={curAuthorIdx} setCurAuthorIdx={setCurAuthorIdx}/>

      {mode==='reader'&&!showEnd&&<ReaderView curNode={curNode} fading={fading} reachableSet={reachableSet} nodes={nodes} go={go} restart={restart} pageIdx={pageIdx} setPageIdx={setPageIdx}/>}
      {mode==='reader'&&showEnd&&<EndingView curNode={curNode} fading={fading} restart={restart} setMode={setMode}/>}

      {mode==='author'&&!authUnlocked&&<PasswordGate onUnlock={()=>setAuthUnlocked(true)} goBack={()=>setMode('reader')}/>}
      {mode==='author'&&authUnlocked&&(
        <AuthorView nodes={nodes} setNodes={setNodes} sel={sel} setSel={setSel} editNode={editNode} setEditNode={setEditNode} q={q} setQ={setQ} aTab={aTab} setATab={setATab} reachableSet={reachableSet} copyFlash={copyFlash} copyContext={copyContext} renameNodeId={renameNodeId} playtestFrom={playtestFrom} addNode={addNode} setShowTut={setShowTut} curAuthor={curAuthor} curAuthorIdx={curAuthorIdx} setCurAuthorIdx={setCurAuthorIdx} found={found} totalEndings={totalEndings} hasUnsaved={hasUnsaved} confirmDiscard={confirmDiscard} commitNodePosition={commitNodePosition} persistNode={persistNode} removeNodeRemote={removeNodeRemote}/>
      )}

      {mode==='gallery'&&<GalleryView nodes={nodes} found={found} totalEndings={totalEndings} loopN={loopN}/>}

      {showTut&&<TutModal onClose={()=>setShowTut(false)}/>}
    </div>
  );
}
