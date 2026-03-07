import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { auth, db, provider } from "./firebase";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   EMOJI DEFINITIONS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const ED = {
  grin:         { e:"ðŸ˜€", n:"Grin",         bp:0, tags:["basic","yellow","face"],               play:false, req:null, rt:null, rules:"The default starter piece. Exists to be upgraded or transformed.", onp:null },
  upside_down:  { e:"ðŸ™ƒ", n:"Upside Down",  bp:0, tags:["yellow","face","upside_down"],          play:true,  req:null, rt:null, rules:"Low-value setup piece. Enables ðŸ¥´ Woozy payoff when placed.", onp:null },
  sick:         { e:"ðŸ¤§", n:"Sick",          bp:0, tags:["yellow","face","sick"],                 play:true,  req:null, rt:null, rules:"On Play: Choose another slot in your army â€” it becomes ðŸ˜€ Grin. Cannot target itself.", onp:"sick" },
  heart:        { e:"â¤ï¸",n:"Heart",         bp:1, tags:["heart","red"],                          play:true,  req:null, rt:null, rules:"Simple 1-point card. Gets +1 from ðŸ’œ Purple Heart.", onp:null },
  purple_heart: { e:"ðŸ’œ", n:"Purple Heart", bp:0, tags:["heart","purple"],                       play:true,  req:null, rt:null, rules:"Ongoing: Other hearts in your army gain +1 point each. Does not buff itself.", onp:null },
  black_heart:  { e:"ðŸ–¤", n:"Black Heart",  bp:3, tags:["heart","black"],                        play:true,  req:null, rt:null, rules:"Ongoing: Neither player may play any heart emoji while this is on the board.", onp:null },
  fire:         { e:"ðŸ”¥", n:"Fire",          bp:3, tags:["fire","red"],                           play:true,  req:null, rt:null, rules:"Solid 3-point mid-range piece. Future-proofed against the water package.", onp:null },
  cool:         { e:"ðŸ˜Ž", n:"Cool",          bp:2, tags:["yellow","face","cool"],                 play:true,  req:"two_non_basic",       rt:"Req: â‰¥2 non-basic emojis in your army",          rules:"Requires 2+ non-basic emojis in your army to play.", onp:null },
  laugh:        { e:"ðŸ˜‚", n:"Laugh",         bp:3, tags:["yellow","face","laugh"],                play:true,  req:"opp_two_zero",        rt:"Req: Opponent has â‰¥2 zero-point emojis",         rules:"Requires opponent has 2+ emojis with 0 base points.", onp:null },
  kiss:         { e:"ðŸ˜˜", n:"Kiss",          bp:2, tags:["yellow","face","kiss"],                 play:true,  req:"across_4plus",        rt:"Req: Must face a â‰¥4bp opposing emoji",           rules:"Must be placed facing a â‰¥4bp emoji. Ongoing: The opposing lane emoji scores half (rounded up).", onp:null },
  dizzy:        { e:"ðŸ˜µâ€ðŸ’«",n:"Dizzy",      bp:3, tags:["yellow","face","dizzy"],                play:true,  req:"two_non_yellow",      rt:"Req: â‰¥2 non-yellow colors in your army",         rules:"Requires 2+ non-yellow colors in army. On Play: Swap your Left and Right emojis.", onp:"swap" },
  melt:         { e:"ðŸ« ", n:"Melt",          bp:0, tags:["yellow","face","melt"],                 play:true,  req:null, rt:null, rules:"On Play: This emoji locks itself until the end of your opponent's next turn.", onp:"selflock" },
  wild:         { e:"ðŸ¤ª", n:"Wild",          bp:0, tags:["yellow","face","wild"],                 play:true,  req:null, rt:null, rules:"On Play: All ðŸ˜€ Grin in your army become ðŸ™ƒ Upside Down.", onp:"wild" },
  woozy:        { e:"ðŸ¥´", n:"Woozy",         bp:2, tags:["yellow","face","upside_down_payoff"],   play:true,  req:"replace_upside",      rt:"Req: Must replace a ðŸ™ƒ Upside Down",             rules:"Must replace an Upside Down ðŸ™ƒ to play. Direct payoff for the ðŸ™ƒ package.", onp:null },
  angel:        { e:"ðŸ˜‡", n:"Angel",         bp:2, tags:["yellow","face","holy"],                 play:true,  req:"yellow_and_colored",  rt:"Req: â‰¥1 yellow + â‰¥1 colored emoji in army",     rules:"Requires 1+ yellow and 1+ colored emoji. Ongoing: All opposing ðŸ˜ˆ Devil score 0.", onp:null },
  devil:        { e:"ðŸ˜ˆ", n:"Devil",         bp:5, tags:["purple","face","devil"],                play:true,  req:"opp_3col_no_devil",   rt:"Req: Opponent â‰¥3 unique colors. Only 1 ðŸ˜ˆ total", rules:"Highest base value. Req: opponent has 3+ unique colors. Only 1 ðŸ˜ˆ may exist on the entire board.", onp:null },
};

const PIDS   = Object.entries(ED).filter(([,v])=>v.play).map(([k])=>k);
const NYC    = ["red","purple","black"];
const ALLC   = ["yellow","red","purple","black"];
const LANES  = ["Left","Mid","Right"];
const LSHORT = ["L","M","R"];
const LOBBY_COLLECTION = "emoji-battle-lobbies";
const CHAT_LIMIT = 60;

const makeLobbyCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

const normalizeCode = (value) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const getPlayerName = (user) => {
  if (!user) return "Player";
  if (user.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user.email) return user.email.split("@")[0];
  return "Player";
};

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   GAME LOGIC
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const mkSlot = (id="grin") => ({ eid:id, locked:false, lu:null });
const hBlocked = as => as.some(a=>a.some(s=>s.eid==="black_heart"));
const dExists  = as => as.some(a=>a.some(s=>s.eid==="devil"));
const getColors = army => { const cs=new Set(); army.forEach(s=>ED[s.eid].tags.forEach(t=>{ if(ALLC.includes(t)) cs.add(t); })); return cs; };
const canRepl  = (slot,t) => !slot.locked || (slot.lu!==null && t>slot.lu);
const getAP    = gs => gs.ct%2;
const getRound = gs => Math.floor(gs.ct/2)+1;

function checkGlobal(as, pid, eid) {
  const def=ED[eid], mine=as[pid], opp=as[1-pid];
  if (def.tags.includes("heart") && hBlocked(as)) return "Hearts blocked â€” ðŸ–¤ is on the board.";
  const r=def.req; if (!r) return null;
  if (r==="two_non_basic" && mine.filter(s=>s.eid!=="grin").length<2) return "Need â‰¥2 non-basic emojis in your army.";
  if (r==="opp_two_zero" && opp.filter(s=>ED[s.eid].bp===0).length<2) return "Opponent needs â‰¥2 zero-point emojis.";
  if (r==="two_non_yellow") {
    const cs=new Set(); mine.forEach(s=>ED[s.eid].tags.forEach(t=>{ if(NYC.includes(t)) cs.add(t); }));
    if (cs.size<2) return "Need â‰¥2 non-yellow colors in your army.";
  }
  if (r==="yellow_and_colored") {
    if (!mine.some(s=>ED[s.eid].tags.includes("yellow"))) return "Need â‰¥1 yellow emoji.";
    if (!mine.some(s=>NYC.some(c=>ED[s.eid].tags.includes(c)))) return "Need â‰¥1 colored emoji.";
  }
  if (r==="opp_3col_no_devil") {
    if (dExists(as)) return "Only 1 ðŸ˜ˆ may exist on the board.";
    if (getColors(opp).size<3) return "Opponent needs â‰¥3 unique colors.";
  }
  return null;
}

function checkSlot(as, pid, eid, si) {
  const def=ED[eid], mine=as[pid], opp=as[1-pid], r=def.req;
  if (r==="across_4plus" && ED[opp[si].eid].bp<4) return `${ED[opp[si].eid].n} has <4 base pts.`;
  if (r==="replace_upside" && mine[si].eid!=="upside_down") return "Must replace a ðŸ™ƒ Upside Down.";
  return null;
}

function getOffers(gs) {
  const pid=getAP(gs), {as,ct}=gs;
  return PIDS.map(id=>{
    const ge=checkGlobal(as,pid,id);
    if (ge) return {id,ok:false,reason:ge};
    for (let s=0;s<3;s++) { if (!canRepl(as[pid][s],ct)) continue; if (!checkSlot(as,pid,id,s)) return {id,ok:true,reason:null}; }
    if ([0,1,2].every(s=>!canRepl(as[pid][s],ct))) return {id,ok:false,reason:"All your slots are locked."};
    for (let s=0;s<3;s++) { if (!canRepl(as[pid][s],ct)) continue; const se=checkSlot(as,pid,id,s); if (se) return {id,ok:false,reason:se}; }
    return {id,ok:false,reason:"No valid slot."};
  });
}

function slotErr(gs, eid, si) {
  const pid=getAP(gs);
  if (!canRepl(gs.as[pid][si],gs.ct)) return "Slot is locked ðŸ”’";
  const ge=checkGlobal(gs.as,pid,eid); if (ge) return ge;
  return checkSlot(gs.as,pid,eid,si);
}

function calcScores(as) {
  return as.map((army,p)=>{
    const opp=as[1-p];
    const lanes=army.map((sl,s)=>{
      const def=ED[sl.eid]; let base=def.bp,buff=0,supp=false,suppMsg=null,half=false;
      if (def.tags.includes("heart")&&sl.eid!=="purple_heart"&&army.some(x=>x.eid==="purple_heart")) buff+=1;
      if (sl.eid==="devil"&&opp.some(x=>x.eid==="angel")) { supp=true; suppMsg="ðŸ˜‡ Angel suppresses ðŸ˜ˆ"; }
      let fin=supp?0:base+buff;
      if (!supp&&opp[s].eid==="kiss") { fin=Math.ceil(fin/2); half=true; }
      return {eid:sl.eid,e:def.e,name:def.n,base,buff,supp,suppMsg,half,fin};
    });
    return {lanes,total:lanes.reduce((a,l)=>a+l.fin,0)};
  });
}

function applyMove(gs, eid, si) {
  const s=JSON.parse(JSON.stringify(gs)); const pid=getAP(s); const def=ED[eid]; const evts=[];
  for (let p=0;p<2;p++) for (let sl=0;sl<3;sl++) { const slot=s.as[p][sl]; if (slot.locked&&slot.lu!==null&&s.ct>slot.lu) { slot.locked=false; slot.lu=null; } }
  s.as[pid][si]=mkSlot(eid);
  s.hist.push({turn:s.ct,pid,eid,si});
  if (def.onp==="wild") {
    let cnt=0; for (let sl=0;sl<3;sl++) if (s.as[pid][sl].eid==="grin"&&sl!==si) { s.as[pid][sl].eid="upside_down"; cnt++; }
    if (cnt>0) evts.push(`ðŸ¤ª Wild transformed ${cnt} ðŸ˜€ â†’ ðŸ™ƒ`);
  }
  if (def.onp==="swap") {
    const tmp=s.as[pid][0]; s.as[pid][0]=s.as[pid][2]; s.as[pid][2]=tmp;
    evts.push("ðŸ˜µâ€ðŸ’« Dizzy swapped Left â†” Right positions");
  }
  if (def.onp==="selflock") { s.as[pid][si].locked=true; s.as[pid][si].lu=s.ct+1; evts.push("ðŸ«  Melt locked until end of opponent's next turn"); }
  evts.forEach(e=>s.log.push(e));
  if (def.onp==="sick") { s.pend={type:"sick",pid,si}; s.phase="ec"; }
  else { s.ct+=1; if (s.ct>=10) { s.phase="ended"; s.sc=calcScores(s.as); s.winner=s.sc[0].total>s.sc[1].total?0:s.sc[1].total>s.sc[0].total?1:-1; } else s.phase="sel"; }
  return s;
}

function applySick(gs, tsi) {
  const s=JSON.parse(JSON.stringify(gs)); const {pid}=s.pend;
  const from=s.as[pid][tsi].eid; s.as[pid][tsi]=mkSlot("grin");
  s.log.push(`ðŸ¤§ Sick reset ${ED[from].e} ${ED[from].n} â†’ ðŸ˜€ Grin`);
  s.pend=null; s.ct+=1;
  if (s.ct>=10) { s.phase="ended"; s.sc=calcScores(s.as); s.winner=s.sc[0].total>s.sc[1].total?0:s.sc[1].total>s.sc[0].total?1:-1; } else s.phase="sel";
  return s;
}

function initGame(p1,p2) {
  return { players:[{name:p1||"Player 1"},{name:p2||"Player 2"}], as:[[mkSlot(),mkSlot(),mkSlot()],[mkSlot(),mkSlot(),mkSlot()]], ct:0, phase:"sel", hist:[], log:[], sc:null, pend:null };
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   STYLES
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap');`;
const C = { bg:"#08080f", surf:"#13132b", hi:"#1e1e40", border:"#2a2a55", accent:"#f5c518", accent2:"#ff7043", text:"#f0f0ff", muted:"#7070a0", ok:"#4ade80", err:"#f87171", lock:"#a78bfa" };
const card = (extra={}) => ({ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:14, ...extra });

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SHARED COMPONENTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function Btn({ children, onClick, color, outline, disabled, sm, style={} }) {
  const bg = disabled ? "#1a1a3a" : outline ? "transparent" : (color||C.accent);
  const fg = disabled ? C.muted : outline ? (color||C.accent) : "#000";
  const border = outline ? `2px solid ${color||C.accent}` : "none";
  return (
    <button onClick={onClick} disabled={disabled} style={{ background:bg, color:fg, border, borderRadius:10, padding:sm?"8px 16px":"12px 26px", fontSize:sm?13:15, fontWeight:800, cursor:disabled?"not-allowed":"pointer", fontFamily:"Nunito, sans-serif", opacity:disabled?0.6:1, transition:"all 0.15s", letterSpacing:0.5, ...style }}>
      {children}
    </button>
  );
}

function SlotCard({ slot, big, selected, dim, highlight, onClick, label, showLock }) {
  const def = ED[slot.eid];
  const isLocked = slot.locked;
  const border = selected ? `2px solid ${C.accent}` : highlight ? `2px solid ${C.ok}` : `1px solid ${isLocked ? C.lock : C.border}`;
  const bg = selected ? "#2a2a10" : highlight ? "#0a2a0a" : C.surf;
  return (
    <div onClick={onClick} style={{ background:bg, border, borderRadius:12, padding:big?"14px 10px":"10px 8px", textAlign:"center", cursor:onClick?"pointer":"default", minWidth:big?72:58, position:"relative", transition:"all 0.15s", boxShadow:selected?`0 0 12px ${C.accent}55`:"none" }}>
      {label && <div style={{ fontSize:10, color:C.muted, fontWeight:700, marginBottom:2, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>}
      <div style={{ fontSize:big?34:26 }}>{def.e}</div>
      <div style={{ fontSize:big?11:9, color:C.muted, fontWeight:700, marginTop:2 }}>{def.bp}pt{def.bp!==1?"s":""}</div>
      {isLocked && showLock && <div style={{ position:"absolute", top:-6, right:-6, fontSize:13, background:C.lock, borderRadius:20, padding:"1px 5px" }}>ðŸ”’</div>}
    </div>
  );
}

function EmojiOfferCard({ eid, offer, selected, onClick, onInfo }) {
  const def=ED[eid];
  const dim = !offer.ok;
  const selBg = selected ? "#2a2710" : C.surf;
  const selBorder = selected ? `2px solid ${C.accent}` : dim ? `1px solid ${C.border}` : `1px solid ${C.border}`;
  return (
    <div style={{ position:"relative" }}>
      <div onClick={!dim ? onClick : undefined} style={{ background:selBg, border:selBorder, borderRadius:11, padding:"8px 6px", textAlign:"center", cursor:dim?"not-allowed":"pointer", opacity:dim?0.4:1, transition:"all 0.12s", boxShadow:selected?`0 0 10px ${C.accent}60`:"none" }}>
        <div style={{ fontSize:26 }}>{def.e}</div>
        <div style={{ fontSize:9, color:C.text, fontWeight:700, lineHeight:1.2, marginTop:1 }}>{def.n}</div>
        <div style={{ fontSize:10, color:C.accent, fontWeight:800 }}>{def.bp}pt</div>
      </div>
      <div onClick={onInfo} style={{ position:"absolute", top:-4, right:-4, width:16, height:16, borderRadius:8, background:C.hi, border:`1px solid ${C.border}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:C.muted, fontWeight:700 }}>i</div>
    </div>
  );
}

function TooltipModal({ eid, onClose }) {
  if (!eid) return null;
  const def=ED[eid];
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"#000000bb", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.surf, border:`1px solid ${C.border}`, borderRadius:18, padding:24, maxWidth:340, width:"100%" }}>
        <div style={{ fontSize:52, textAlign:"center" }}>{def.e}</div>
        <div style={{ fontSize:22, fontWeight:800, color:C.text, textAlign:"center", fontFamily:"Fredoka One" }}>{def.n}</div>
        <div style={{ fontSize:22, color:C.accent, fontWeight:800, textAlign:"center", margin:"4px 0 12px" }}>{def.bp} point{def.bp!==1?"s":""}</div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>TAGS: {def.tags.join(" Â· ")}</div>
        {def.rt && <div style={{ background:"#ff700320", border:`1px solid ${C.accent2}40`, borderRadius:8, padding:"8px 10px", fontSize:13, color:C.accent2, marginBottom:10, fontWeight:600 }}>{def.rt}</div>}
        <div style={{ fontSize:14, color:C.text, lineHeight:1.6 }}>{def.rules}</div>
        <Btn onClick={onClose} sm style={{ marginTop:16, width:"100%" }}>Close</Btn>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MENU SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function MenuScreen({ onPlay, onRulebook, onSettings, onMultiplayer }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Nunito, sans-serif" }}>
      <div style={{ marginBottom:8, fontSize:72 }}>âš”ï¸</div>
      <h1 style={{ fontFamily:"Fredoka One", fontSize:52, color:C.accent, margin:0, letterSpacing:2, textShadow:`0 0 40px ${C.accent}60` }}>EMOJI BATTLE!</h1>
      <p style={{ color:C.muted, fontSize:14, margin:"8px 0 40px", letterSpacing:1, textTransform:"uppercase" }}>Fast 1v1 â€¢ 5 Rounds â€¢ Strategy</p>
      <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:300 }}>
        <Btn onClick={onPlay} style={{ width:"100%", fontSize:18, padding:"16px 0" }}>âš”ï¸ New Match</Btn>
        <Btn onClick={onMultiplayer} style={{ width:"100%", fontSize:18, padding:"16px 0" }} color={C.accent2}>ðŸŒ Multiplayer</Btn>
        <Btn onClick={onRulebook} outline style={{ width:"100%" }}>ðŸ“– Rulebook & Emoji Index</Btn>
        <Btn onClick={onSettings} outline color={C.muted} style={{ width:"100%" }}>âš™ï¸ Settings</Btn>
      </div>
      <div style={{ marginTop:40, display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
        {["ðŸ˜€","ðŸ™ƒ","ðŸ¤§","â¤ï¸","ðŸ’œ","ðŸ–¤","ðŸ”¥","ðŸ˜Ž","ðŸ˜‚","ðŸ˜˜","ðŸ˜µâ€ðŸ’«","ðŸ« ","ðŸ¤ª","ðŸ¥´","ðŸ˜‡","ðŸ˜ˆ"].map((e,i)=>(
          <span key={i} style={{ fontSize:22, opacity:0.4 }}>{e}</span>
        ))}
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SETUP SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function SetupScreen({ onBack, onStart }) {
  const [p1,setP1]=useState("Player 1");
  const [p2,setP2]=useState("Player 2");
  const inp = (val,set) => (
    <input value={val} onChange={e=>set(e.target.value)} maxLength={16} style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", color:C.text, fontSize:16, fontFamily:"Nunito", fontWeight:700, width:"100%", outline:"none", boxSizing:"border-box" }} />
  );
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Nunito, sans-serif" }}>
      <div style={{ maxWidth:380, width:"100%" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.muted, fontSize:14, cursor:"pointer", marginBottom:20, fontFamily:"Nunito", fontWeight:700 }}>â† Back</button>
        <h2 style={{ fontFamily:"Fredoka One", fontSize:34, color:C.accent, margin:"0 0 6px" }}>New Match</h2>
        <p style={{ color:C.muted, fontSize:13, margin:"0 0 30px" }}>Pass-and-play â€” share one device</p>
        <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
          <div>
            <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Player 1 Name</div>
            {inp(p1,setP1)}
          </div>
          <div>
            <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Player 2 Name</div>
            {inp(p2,setP2)}
          </div>
          <div style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:12, padding:14, fontSize:13, color:C.muted, marginTop:4 }}>
            <strong style={{ color:C.text }}>Rules at a glance:</strong><br/>
            Each player manages 3 emoji slots over 5 rounds. Replace one slot per turn. Highest total score wins!
          </div>
          <Btn onClick={()=>onStart(p1||"Player 1",p2||"Player 2")} style={{ width:"100%", fontSize:17, padding:"14px 0", marginTop:6 }}>âš”ï¸ Start Match!</Btn>
        </div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PASS SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function PassScreen({ name, onReady }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Nunito, sans-serif", textAlign:"center" }}>
      <div style={{ fontSize:60, marginBottom:16 }}>ðŸ«´</div>
      <h2 style={{ fontFamily:"Fredoka One", fontSize:32, color:C.text, margin:"0 0 8px" }}>Pass the device</h2>
      <p style={{ color:C.accent, fontSize:22, fontWeight:800, margin:"0 0 12px" }}>{name}</p>
      <p style={{ color:C.muted, fontSize:14, margin:"0 0 40px" }}>Your turn is up. Hand it over!</p>
      <Btn onClick={onReady} style={{ fontSize:18, padding:"14px 36px" }}>I'm Ready ðŸ‘€</Btn>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SICK EFFECT CHOOSER MODAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function SickModal({ gs, onChoose }) {
  const {pid,si:sickSi}=gs.pend;
  const army=gs.as[pid];
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }}>
      <div style={{ background:C.surf, border:`1px solid ${C.accent}`, borderRadius:18, padding:24, maxWidth:340, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:8 }}>ðŸ¤§</div>
        <div style={{ fontFamily:"Fredoka One", fontSize:22, color:C.text, marginBottom:8 }}>Sick Effect</div>
        <div style={{ fontSize:14, color:C.muted, marginBottom:20 }}>Choose another slot in your army to reset to ðŸ˜€ Grin:</div>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          {army.map((slot,i)=>{
            if (i===sickSi) return <div key={i} style={{ opacity:0.3 }}><SlotCard slot={slot} big label={LSHORT[i]} /></div>;
            return <div key={i} onClick={()=>onChoose(i)} style={{ cursor:"pointer" }}><SlotCard slot={slot} big label={LSHORT[i]} highlight /></div>;
          })}
        </div>
        <div style={{ fontSize:12, color:C.muted, marginTop:14 }}>Tap a slot to reset it. (Cannot target ðŸ¤§ itself.)</div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   GAME SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function GameScreen({ gs, onMove, onSick, onEndGame, readOnly, waitingFor }) {
  const [selEmoji,setSelEmoji]=useState(null);
  const [selSlot,setSelSlot]=useState(null);
  const [tooltip,setTooltip]=useState(null);
  const [errMsg,setErrMsg]=useState(null);

  const pid=getAP(gs); const round=getRound(gs);
  const pname=gs.players[pid].name; const oppid=1-pid;
  const oppname=gs.players[oppid].name;
  const offers=getOffers(gs);

  function pickEmoji(eid) {
    if (readOnly) return;
    setSelEmoji(eid); setSelSlot(null); setErrMsg(null);
  }
  function pickSlot(si) {
    if (readOnly) return;
    if (!selEmoji) { setErrMsg("Pick an emoji first!"); return; }
    const err=slotErr(gs,selEmoji,si);
    if (err) { setErrMsg(err); return; }
    setSelSlot(si); setErrMsg(null);
  }
  function confirmPlay() {
    if (readOnly) return;
    if (selEmoji===null||selSlot===null) return;
    onMove(selEmoji,selSlot);
    setSelEmoji(null); setSelSlot(null); setErrMsg(null);
  }
  function cancel() { setSelEmoji(null); setSelSlot(null); setErrMsg(null); }

  const showConfirm = selEmoji!==null && selSlot!==null;
  const recentLog = gs.log.slice(-4).reverse();
  const turnLabel = readOnly && waitingFor ? `Waiting for ${waitingFor}` : `${pname}'s Turn`;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, display:"flex", flexDirection:"column", maxWidth:520, margin:"0 auto" }}>
      {/* TOP BAR */}
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontFamily:"Fredoka One", fontSize:18, color:C.accent }}>âš”ï¸ EB!</span>
        <span style={{ fontSize:13, fontWeight:700, color:C.muted }}>Round <strong style={{color:C.text}}>{round}</strong> / 5</span>
        <span style={{ fontSize:12, fontWeight:800, color:readOnly?C.muted:C.accent2, background:readOnly?"#242443":"#ff704320", padding:"4px 10px", borderRadius:20 }}>
          {turnLabel}
        </span>
        <button onClick={onEndGame} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12, fontFamily:"Nunito", fontWeight:700 }}>âœ• Quit</button>
      </div>

      {/* OPPONENT PANEL */}
      <div style={{ padding:"12px 16px 8px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>ðŸ‘¤ {oppname}</div>
        <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
          {gs.as[oppid].map((slot,i)=>(
            <SlotCard key={i} slot={slot} big label={LSHORT[i]} showLock />
          ))}
        </div>
      </div>

      {/* VS DIVIDER */}
      <div style={{ display:"flex", alignItems:"center", padding:"6px 16px", gap:8 }}>
        <div style={{ flex:1, height:1, background:C.border }} />
        <span style={{ fontSize:11, color:C.muted, fontWeight:700, letterSpacing:2 }}>VS</span>
        <div style={{ flex:1, height:1, background:C.border }} />
      </div>

      {/* MY PANEL */}
      <div style={{ padding:"8px 16px 12px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:8 }}>
          {gs.as[pid].map((slot,i)=>{
            const selectable = selEmoji!==null && canRepl(slot,gs.ct);
            const err = selEmoji ? slotErr(gs,selEmoji,i) : null;
            return (
            <SlotCard key={i} slot={slot} big selected={selSlot===i} highlight={selectable&&!err} label={LSHORT[i]} showLock onClick={!readOnly ? ()=>pickSlot(i) : undefined} />
          );
        })}
      </div>
        <div style={{ fontSize:12, color:C.muted, fontWeight:700, textAlign:"center", textTransform:"uppercase", letterSpacing:1 }}>ðŸ‘¤ {pname}</div>
      </div>

      {/* SELECTION STATUS / CONFIRM BAR */}
      {showConfirm ? (
        <div style={{ margin:"10px 16px", background:"#1a1a10", border:`1px solid ${C.accent}`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:22 }}>{ED[selEmoji].e}</span>
          <span style={{ flex:1, fontSize:13, color:C.text, fontWeight:600 }}>Play <strong>{ED[selEmoji].n}</strong> into <strong>{LANES[selSlot]}</strong> slot</span>
          <Btn onClick={confirmPlay} style={{ padding:"8px 16px" }} sm>âœ“ Confirm</Btn>
          <Btn onClick={cancel} outline color={C.muted} sm>âœ•</Btn>
        </div>
      ) : (
        <div style={{ margin:"10px 16px 4px", minHeight:44, display:"flex", alignItems:"center" }}>
          {selEmoji!==null ? (
            <div style={{ fontSize:13, color:C.accent, fontWeight:700 }}>
              {ED[selEmoji].e} <strong>{ED[selEmoji].n}</strong> selected â€” tap a slot above
            </div>
          ) : (
            <div style={{ fontSize:13, color:C.muted }}>Choose an emoji to play â†“</div>
          )}
          {errMsg && <div style={{ marginLeft:"auto", fontSize:12, color:C.err, fontWeight:700, maxWidth:180, textAlign:"right" }}>{errMsg}</div>}
        </div>
      )}

      {readOnly && (
        <div style={{ margin:"0 16px 6px", fontSize:12, color:C.muted, fontWeight:700 }}>
          Waiting for {waitingFor || "opponent"} to moveâ€¦
        </div>
      )}

      {/* OFFER TRAY */}
      <div style={{ padding:"4px 16px 12px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:7 }}>
          {offers.map(of=>(
            <EmojiOfferCard key={of.id} eid={of.id} offer={of} selected={selEmoji===of.id} onClick={!readOnly ? ()=>pickEmoji(of.id) : undefined} onInfo={()=>setTooltip(of.id)} />
          ))}
        </div>
      </div>

      {/* EVENT LOG */}
      {recentLog.length>0 && (
        <div style={{ margin:"0 16px 16px", background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
          <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Recent Events</div>
          {recentLog.map((e,i)=>(
            <div key={i} style={{ fontSize:12, color:C.muted, padding:"2px 0", borderBottom:i<recentLog.length-1?`1px solid ${C.border}`:"none" }}>â€¢ {e}</div>
          ))}
        </div>
      )}

      {tooltip && <TooltipModal eid={tooltip} onClose={()=>setTooltip(null)} />}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RESULTS SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function ResultsScreen({ gs, onRematch, onMenu }) {
  const [tab,setTab]=useState("breakdown");
  const sc=gs.sc;
  const w=gs.winner; // 0 or 1 for winner index, -1 for draw
  const titleColor = w===-1?C.accent:C.ok;
  const titleText  = w===-1?"ðŸ¤ DRAW!":("ðŸ† "+gs.players[w].name+" Wins!");
  // Build effect messages
  const effects=[];
  for (let p=0;p<2;p++) {
    const sc_p=sc[p];
    if (gs.as[p].some(s=>s.eid==="purple_heart")) {
      const boosted=sc_p.lanes.filter(l=>l.buff>0);
      boosted.forEach(l=>effects.push(`ðŸ’œ Purple Heart gave ${l.e} ${l.name} +${l.buff} point${l.buff>1?"s":""} (${gs.players[p].name})`));
    }
    sc_p.lanes.forEach(l=>{ if (l.supp) effects.push(`${l.suppMsg} â€” ${l.e} ${l.name} scored 0 (${gs.players[p].name})`); });
    const opp=gs.as[1-p];
    sc_p.lanes.forEach((l,s)=>{ if (l.half) effects.push(`ðŸ˜˜ Kiss halved ${l.e} ${l.name} â†’ ${l.fin} pts (${gs.players[p].name}, lane ${LANES[s]})`); });
  }
  const tabBtn = (id,label) => (
    <button onClick={()=>setTab(id)} style={{ flex:1, padding:"10px 0", background:tab===id?C.hi:"transparent", border:"none", borderBottom:tab===id?`2px solid ${C.accent}`:"2px solid transparent", color:tab===id?C.text:C.muted, fontFamily:"Nunito", fontWeight:700, fontSize:13, cursor:"pointer" }}>{label}</button>
  );
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, maxWidth:520, margin:"0 auto" }}>
      {/* HEADER */}
      <div style={{ padding:"32px 20px 20px", textAlign:"center", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontFamily:"Fredoka One", fontSize:38, color:titleColor, marginBottom:8, textShadow:`0 0 30px ${titleColor}60` }}>{titleText}</div>
        <div style={{ display:"flex", justifyContent:"center", gap:32, marginTop:12 }}>
          {[0,1].map(p=>(
            <div key={p} style={{ textAlign:"center" }}>
              <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:1 }}>{gs.players[p].name}</div>
              <div style={{ fontFamily:"Fredoka One", fontSize:42, color:p===w?C.ok:C.text }}>{sc[p].total}</div>
              <div style={{ fontSize:11, color:C.muted }}>points</div>
            </div>
          ))}
        </div>
      </div>

      {/* TABS */}
      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}` }}>
        {tabBtn("breakdown","Lane Breakdown")}
        {tabBtn("effects","Effects")}
        {tabBtn("log","Move Log")}
      </div>

      <div style={{ padding:"16px 16px 100px" }}>
        {tab==="breakdown" && (
          <div>
            {[0,1].map(p=>(
              <div key={p} style={{ marginBottom:16, ...card() }}>
                <div style={{ fontWeight:800, fontSize:14, marginBottom:10, color:p===w?C.ok:C.text }}>
                  {p===w?"ðŸ† ":""}{gs.players[p].name} â€” <span style={{color:C.accent}}>{sc[p].total} pts</span>
                </div>
                {sc[p].lanes.map((l,s)=>(
                  <div key={s} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:s<2?`1px solid ${C.border}`:"none" }}>
                    <div style={{ fontSize:11, color:C.muted, width:20, fontWeight:700 }}>{LSHORT[s]}</div>
                    <div style={{ fontSize:20 }}>{l.e}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{l.name}</div>
                      <div style={{ fontSize:10, color:C.muted }}>
                        {l.base}bp
                        {l.buff>0&&<span style={{color:C.ok}}> +{l.buff} buff</span>}
                        {l.supp&&<span style={{color:C.err}}> suppressed</span>}
                        {l.half&&<span style={{color:C.accent2}}> halved</span>}
                      </div>
                    </div>
                    <div style={{ fontFamily:"Fredoka One", fontSize:20, color:l.fin>0?C.accent:C.muted }}>{l.fin}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {tab==="effects" && (
          <div>
            {effects.length===0
              ? <div style={{color:C.muted,fontSize:14,textAlign:"center",marginTop:20}}>No special effects this match.</div>
              : effects.map((e,i)=>(
                  <div key={i} style={{ ...card({marginBottom:8}), fontSize:13, lineHeight:1.6 }}>â€¢ {e}</div>
                ))}
          </div>
        )}
        {tab==="log" && (
          <div>
            {gs.hist.map((m,i)=>{
              const def=ED[m.eid];
              return (
                <div key={i} style={{ ...card({marginBottom:8}), display:"flex", gap:10, alignItems:"center" }}>
                  <div style={{fontSize:22}}>{def.e}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:C.text}}>{gs.players[m.pid].name} played {def.n}</div>
                    <div style={{fontSize:11,color:C.muted}}>Round {Math.floor(m.turn/2)+1} Â· {LANES[m.si]} slot</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:520, background:C.bg, borderTop:`1px solid ${C.border}`, padding:16, display:"flex", gap:10 }}>
        <Btn onClick={onRematch} style={{ flex:1 }}>ðŸ” Rematch</Btn>
        <Btn onClick={onMenu} outline style={{ flex:1 }}>ðŸ  Menu</Btn>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RULEBOOK SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function RulebookScreen({ onBack }) {
  const [tab,setTab]=useState("rules");
  const [tooltip,setTooltip]=useState(null);
  const tabBtn=(id,label)=>(<button onClick={()=>setTab(id)} style={{flex:1,padding:"10px 0",background:tab===id?C.hi:"transparent",border:"none",borderBottom:tab===id?`2px solid ${C.accent}`:"2px solid transparent",color:tab===id?C.text:C.muted,fontFamily:"Nunito",fontWeight:700,fontSize:13,cursor:"pointer"}}>{label}</button>);
  const rule=(title,body)=>(<div style={{marginBottom:14}}><strong style={{color:C.accent,fontSize:13}}>{title}</strong><div style={{fontSize:13,color:C.muted,marginTop:4,lineHeight:1.6}}>{body}</div></div>);
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Nunito, sans-serif",color:C.text,maxWidth:520,margin:"0 auto"}}>
      <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontFamily:"Nunito",fontWeight:700,fontSize:14}}>â† Back</button>
        <span style={{fontFamily:"Fredoka One",fontSize:22,color:C.accent}}>ðŸ“– Rulebook</span>
      </div>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
        {tabBtn("rules","Core Rules")}
        {tabBtn("glossary","Glossary")}
        {tabBtn("emojis","Emoji Index")}
      </div>
      <div style={{padding:"16px 16px 40px"}}>
        {tab==="rules" && (
          <div>
            {rule("Match Setup","Two players. Each starts with ðŸ˜€ ðŸ˜€ ðŸ˜€ (three Grin emojis). A match lasts 5 rounds.")}
            {rule("Turn Order","Each round: Player 1 acts, then Player 2. Each player takes 5 total turns.")}
            {rule("On Your Turn","1) Choose an emoji from the offer tray. 2) Choose which of your 3 slots to replace. 3) Confirm. Any on-play effects resolve immediately.")}
            {rule("The Board","Each player has 3 slots: Left, Middle, Right. A slot always contains exactly one emoji. The Left slot faces the opponent's Left slot (and so on for Mid, Right).")}
            {rule("Locked Slots","A locked emoji cannot be replaced until its lock expires. Lock icons appear on locked slots.")}
            {rule("Scoring","After Turn 5 for both players: (1) Start with base points. (2) Apply buffs. (3) Apply suppressions/halving. (4) Sum all three lane scores.")}
            {rule("Win Condition","Higher total score wins. Equal score = Draw.")}
          </div>
        )}
        {tab==="glossary" && (
          <div>
            {rule("Basic","Only ðŸ˜€ Grin is basic. Cards referencing 'basic' mean specifically ðŸ˜€.")}
            {rule("Non-Basic","Any emoji other than ðŸ˜€ Grin.")}
            {rule("Colored Emoji","An emoji with a color tag: red, purple, or black. Yellow is also a color for some checks.")}
            {rule("Unique Colors","The count of distinct color tags among your army. Max 4: yellow, red, purple, black.")}
            {rule("Locked","A locked slot cannot be replaced until the lock expires.")}
            {rule("Suppressed","A suppressed emoji exists on the board but contributes 0 points at scoring time.")}
            {rule("Across","Same lane on the opposing side. Your Left faces opponent's Left, etc.")}
            {rule("Hearts","Emojis tagged 'heart': â¤ï¸ ðŸ’œ ðŸ–¤")}
          </div>
        )}
        {tab==="emojis" && (
          <div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Tap â“˜ or any card for full details.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {Object.entries(ED).map(([key,def])=>(
                <div key={key} onClick={()=>setTooltip(key)} style={{...card({cursor:"pointer"})}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:26}}>{def.e}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,color:C.text}}>{def.n}</div>
                      <div style={{fontSize:12,color:C.accent,fontWeight:700}}>{def.bp} pt{def.bp!==1?"s":""} {!def.play&&<span style={{color:C.muted,fontSize:10}}>(starter)</span>}</div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.4}}>{def.rt||def.rules.slice(0,60)}{def.rules.length>60?"â€¦":""}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {tooltip && <TooltipModal eid={tooltip} onClose={()=>setTooltip(null)} />}
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SETTINGS SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function SettingsScreen({ onBack, onSignOut }) {
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Nunito, sans-serif",color:C.text,maxWidth:520,margin:"0 auto"}}>
      <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontFamily:"Nunito",fontWeight:700,fontSize:14}}>â† Back</button>
        <span style={{fontFamily:"Fredoka One",fontSize:22,color:C.accent}}>âš™ï¸ Settings</span>
      </div>
      <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
        {[["ðŸ”Š Sound","On/Off (coming soon)"],["ðŸŽžï¸ Animations","On/Off (coming soon)"],["â™¿ Reduced Motion","Coming soon"],["ðŸ”  Emoji Name Labels","Always shown on hover (default on)"],["ðŸ“– Rules / Help","See Rulebook tab"],].map(([title,desc])=>(
          <div key={title} style={{...card(),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{title}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{desc}</div>
            </div>
          </div>
        ))}
        <div style={{...card({marginTop:10}),textAlign:"center",color:C.muted,fontSize:13}}>
          <strong style={{color:C.text}}>Emoji Battle! v1</strong><br/>
          Fast 1v1 browser strategy Â· 16 starter emojis<br/>
          Firebase sync is enabled for multiplayer lobbies.
        </div>
        <div style={{...card(),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>Account</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>Sign out of Emoji Battle</div>
          </div>
          <Btn onClick={onSignOut} sm>Sign out</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MULTIPLAYER HUB
═══════════════════════════════════════════════════════════════════════ */
function MultiplayerHub({ onBack, onCreate, onJoin, code, onCodeChange, error, lobbies, onOpenLobby }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, maxWidth:520, margin:"0 auto" }}>
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontFamily:"Nunito", fontWeight:700, fontSize:14 }}>← Back</button>
        <span style={{ fontFamily:"Fredoka One", fontSize:22, color:C.accent }}>🌐 Multiplayer</span>
      </div>
      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Create Lobby</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>Generate a code and invite a friend.</div>
          <Btn onClick={onCreate}>Create Lobby</Btn>
        </div>
        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Join Lobby</div>
          <input
            value={code}
            onChange={(e) => onCodeChange(normalizeCode(e.target.value))}
            placeholder="Enter code"
            style={{ width:"100%", background:C.bg, border:`1px solid ${C.border}`, color:C.text, padding:"8px 10px", borderRadius:8, fontSize:14, marginBottom:10 }}
          />
          <Btn onClick={onJoin} sm>Join Lobby</Btn>
          {error && <div style={{ fontSize:12, color:C.err, marginTop:10 }}>{error}</div>}
        </div>
        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:8 }}>My Lobbies</div>
          {lobbies.length === 0 ? (
            <div style={{ fontSize:12, color:C.muted }}>No active lobbies yet.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {lobbies.map((lobby) => {
                const hostName = lobby.host?.name || "Host";
                const guestName = lobby.guest?.name || "Waiting";
                const status = lobby.status || "waiting";
                return (
                  <button
                    key={lobby.id}
                    onClick={() => onOpenLobby(lobby.id)}
                    style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", textAlign:"left", cursor:"pointer" }}
                  >
                    <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>Code {lobby.code || lobby.id}</div>
                    <div style={{ fontSize:14, fontWeight:700 }}>{hostName} vs {guestName}</div>
                    <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:1 }}>{status}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ROOT APP
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [screen, setScreen] = useState("menu");
  const [gs, setGs] = useState(null);
  const [passTo, setPassTo] = useState(null);

  const [mpCodeInput, setMpCodeInput] = useState("");
  const [mpError, setMpError] = useState("");
  const [activeLobbyCode, setActiveLobbyCode] = useState(null);
  const [activeLobby, setActiveLobby] = useState(null);
  const [spectatorMode, setSpectatorMode] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [hostLobbies, setHostLobbies] = useState([]);
  const [guestLobbies, setGuestLobbies] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setHostLobbies([]);
      setGuestLobbies([]);
      return;
    }
    const lobbyCollection = collection(db, LOBBY_COLLECTION);
    const hostQuery = query(lobbyCollection, where("host.uid", "==", user.uid));
    const guestQuery = query(lobbyCollection, where("guest.uid", "==", user.uid));
    const unsubHost = onSnapshot(hostQuery, (snapshot) => {
      setHostLobbies(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    const unsubGuest = onSnapshot(guestQuery, (snapshot) => {
      setGuestLobbies(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });
    return () => {
      unsubHost();
      unsubGuest();
    };
  }, [user]);

  const myLobbies = useMemo(() => {
    const map = new Map();
    [...hostLobbies, ...guestLobbies].forEach((lobby) => {
      map.set(lobby.id, lobby);
    });
    return [...map.values()].sort((a, b) => {
      const at = a.updatedAt?.toMillis?.() || 0;
      const bt = b.updatedAt?.toMillis?.() || 0;
      return bt - at;
    });
  }, [hostLobbies, guestLobbies]);

  useEffect(() => {
    if (!activeLobbyCode) {
      setActiveLobby(null);
      setSpectatorMode(false);
      setChatMessages([]);
      return;
    }
    const lobbyRef = doc(db, LOBBY_COLLECTION, activeLobbyCode);
    return onSnapshot(lobbyRef, (snapshot) => {
      if (!snapshot.exists()) {
        setActiveLobby(null);
        return;
      }
      setActiveLobby({ id: snapshot.id, ...snapshot.data() });
    });
  }, [activeLobbyCode]);

  useEffect(() => {
    if (!activeLobbyCode) return;
    const messagesRef = collection(db, LOBBY_COLLECTION, activeLobbyCode, "messages");
    const messagesQuery = query(messagesRef, orderBy("createdAt", "desc"), limit(CHAT_LIMIT));
    return onSnapshot(messagesQuery, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).reverse();
      setChatMessages(data);
    });
  }, [activeLobbyCode]);

  function startGame(p1, p2) {
    const g = initGame(p1, p2);
    setGs(g);
    setPassTo(null);
    setScreen("game");
  }

  function handleMove(eid, si) {
    const next = applyMove(gs, eid, si);
    setGs(next);
    if (next.phase === "ended") {
      setPassTo(null);
      setScreen("results");
    } else if (next.phase === "ec") {
      setPassTo(null);
    } else {
      setPassTo(next.players[getAP(next)].name);
    }
  }

  function handleSick(tsi) {
    const next = applySick(gs, tsi);
    setGs(next);
    if (next.phase === "ended") {
      setPassTo(null);
      setScreen("results");
    } else {
      setPassTo(next.players[getAP(next)].name);
    }
  }

  function handleRematch() {
    const g = initGame(gs.players[0].name, gs.players[1].name);
    setGs(g);
    setPassTo(null);
    setScreen("game");
  }

  const handleCreateLobby = async () => {
    setMpError("");
    if (!user) return;
    const name = getPlayerName(user);
    const lobbyCollection = collection(db, LOBBY_COLLECTION);
    for (let i = 0; i < 6; i += 1) {
      const code = makeLobbyCode();
      const lobbyRef = doc(lobbyCollection, code);
      const snap = await getDoc(lobbyRef);
      if (snap.exists()) continue;
      await setDoc(lobbyRef, {
        code,
        status: "waiting",
        host: { uid: user.uid, name },
        guest: null,
        gameState: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setActiveLobbyCode(code);
      setScreen("mp-lobby");
      return;
    }
    setMpError("Unable to generate a lobby code. Try again.");
  };

  const handleJoinLobby = async () => {
    setMpError("");
    if (!user) return;
    const code = normalizeCode(mpCodeInput);
    if (!code) {
      setMpError("Enter a lobby code.");
      return;
    }
    const lobbyRef = doc(db, LOBBY_COLLECTION, code);
    const snap = await getDoc(lobbyRef);
    if (!snap.exists()) {
      setMpError("Lobby not found.");
      return;
    }
    const data = snap.data();
    const name = getPlayerName(user);
    if (data.host?.uid === user.uid) {
      setActiveLobbyCode(code);
      setScreen("mp-lobby");
      return;
    }
    if (data.guest?.uid && data.guest.uid !== user.uid) {
      setMpError("Lobby already has two players.");
      return;
    }
    if (!data.guest) {
      await updateDoc(lobbyRef, {
        guest: { uid: user.uid, name },
        status: "playing",
        gameState: initGame(data.host?.name || "Player 1", name),
        updatedAt: serverTimestamp()
      });
    }
    setActiveLobbyCode(code);
    setScreen("mp-lobby");
  };

  const handleClaimSeat = async () => {
    if (!user || !activeLobby) return;
    if (activeLobby.host?.uid === user.uid) return;
    if (activeLobby.guest?.uid) return;
    const name = getPlayerName(user);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      guest: { uid: user.uid, name },
      status: "playing",
      gameState: activeLobby.gameState || initGame(activeLobby.host?.name || "Player 1", name),
      updatedAt: serverTimestamp()
    });
  };

  const handleCloseLobby = async () => {
    if (!activeLobbyCode) return;
    await deleteDoc(doc(db, LOBBY_COLLECTION, activeLobbyCode));
    setActiveLobbyCode(null);
    setScreen("mp-hub");
  };

  const handleLeaveLobby = () => {
    setActiveLobbyCode(null);
    setSpectatorMode(false);
    setChatInput("");
    setScreen("mp-hub");
  };

  const handleSendChat = async () => {
    if (!user || !activeLobbyCode) return;
    const text = chatInput.trim();
    if (!text) return;
    const role = activeLobby?.host?.uid === user.uid ? "host" : activeLobby?.guest?.uid === user.uid ? "guest" : "spectator";
    await addDoc(collection(db, LOBBY_COLLECTION, activeLobbyCode, "messages"), {
      text,
      sender: { uid: user.uid, name: getPlayerName(user) },
      role,
      createdAt: serverTimestamp()
    });
    setChatInput("");
  };

  const handleMpMove = async (eid, si) => {
    if (!isMyTurn) return;
    if (!activeLobby?.gameState) return;
    const next = applyMove(activeLobby.gameState, eid, si);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: next,
      status: next.phase === "ended" ? "ended" : "playing",
      updatedAt: serverTimestamp()
    });
  };

  const handleMpSick = async (tsi) => {
    if (!showSick) return;
    if (!activeLobby?.gameState) return;
    const next = applySick(activeLobby.gameState, tsi);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: next,
      status: next.phase === "ended" ? "ended" : "playing",
      updatedAt: serverTimestamp()
    });
  };

  const handleMpRematch = async () => {
    if (!activeLobby) return;
    const hostName = activeLobby.host?.name || "Player 1";
    const guestName = activeLobby.guest?.name || "Player 2";
    const next = initGame(hostName, guestName);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: next,
      status: "playing",
      updatedAt: serverTimestamp()
    });
  };

  const myIndex = activeLobby && user
    ? activeLobby.host?.uid === user.uid
      ? 0
      : activeLobby.guest?.uid === user.uid
        ? 1
        : null
    : null;
  const isMember = myIndex !== null;
  const canSpectate = Boolean(activeLobby && user && !isMember);
  const isSpectating = canSpectate && spectatorMode;
  const gameState = activeLobby?.gameState || null;
  const activePlayerIndex = gameState ? getAP(gameState) : null;
  const waitingForName = gameState ? gameState.players?.[activePlayerIndex]?.name : activeLobby?.guest?.name;
  const isMyTurn = gameState && isMember
    ? gameState.phase === "ec"
      ? gameState.pend?.pid === myIndex
      : activePlayerIndex === myIndex
    : false;
  const showSick = gameState && gameState.phase === "ec" && gameState.pend?.pid === myIndex;

  if (!authReady) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:C.text, fontFamily:"Nunito, sans-serif" }}>
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Nunito, sans-serif" }}>
        <div style={{ maxWidth:360, textAlign:"center" }}>
          <div style={{ fontSize:52, marginBottom:10 }}>⚔️</div>
          <div style={{ fontFamily:"Fredoka One", fontSize:32, color:C.accent }}>Emoji Battle</div>
          <p style={{ color:C.muted, marginTop:8, marginBottom:16 }}>Sign in with Google to sync multiplayer lobbies.</p>
          <Btn onClick={() => signInWithPopup(auth, provider).catch(() => undefined)}>Sign in with Google</Btn>
        </div>
      </div>
    );
  }

  if (passTo && screen === "game") {
    return <><style>{FONTS}</style><PassScreen name={passTo} onReady={() => setPassTo(null)} /></>;
  }

  return (
    <>
      <style>{FONTS}</style>
      <div style={{ background:C.bg, minHeight:"100vh" }}>
        {screen === "menu" && (
          <MenuScreen
            onPlay={() => setScreen("setup")}
            onRulebook={() => setScreen("rulebook")}
            onSettings={() => setScreen("settings")}
            onMultiplayer={() => setScreen("mp-hub")}
          />
        )}
        {screen === "setup" && <SetupScreen onBack={() => setScreen("menu")} onStart={startGame} />}
        {screen === "game" && gs && (
          <>
            {gs.phase === "ec" && <SickModal gs={gs} onChoose={handleSick} />}
            <GameScreen gs={gs} onMove={handleMove} onSick={handleSick} onEndGame={() => setScreen("menu")} />
          </>
        )}
        {screen === "results" && gs && <ResultsScreen gs={gs} onRematch={handleRematch} onMenu={() => setScreen("menu")} />}
        {screen === "rulebook" && <RulebookScreen onBack={() => setScreen("menu")} />}
        {screen === "settings" && <SettingsScreen onBack={() => setScreen("menu")} onSignOut={() => signOut(auth).catch(() => undefined)} />}
        {screen === "mp-hub" && (
          <MultiplayerHub
            onBack={() => setScreen("menu")}
            onCreate={handleCreateLobby}
            onJoin={handleJoinLobby}
            code={mpCodeInput}
            onCodeChange={setMpCodeInput}
            error={mpError}
            lobbies={myLobbies}
            onOpenLobby={(code) => { setActiveLobbyCode(code); setScreen("mp-lobby"); }}
          />
        )}
        {screen === "mp-lobby" && (
          <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, maxWidth:520, margin:"0 auto" }}>
            <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, justifyContent:"space-between" }}>
              <button onClick={handleLeaveLobby} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontFamily:"Nunito", fontWeight:700, fontSize:14 }}>← Back</button>
              <span style={{ fontFamily:"Fredoka One", fontSize:20, color:C.accent }}>🌐 Lobby</span>
              <span style={{ fontSize:11, color:isSpectating?C.accent2:C.muted, textTransform:"uppercase", letterSpacing:1 }}>
                {isSpectating ? "Spectating" : isMember ? "Player" : ""}
              </span>
              <span style={{ fontSize:12, color:C.muted }}>{activeLobbyCode || ""}</span>
            </div>

            {!activeLobby && (
              <div style={{ padding:24, color:C.muted }}>Lobby not found.</div>
            )}

            {activeLobby && !isMember && !isSpectating && (
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ ...card() }}>
                  <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Lobby {activeLobby.code || activeLobby.id}</div>
                  <div style={{ fontSize:12, color:C.muted }}>Host: {activeLobby.host?.name || "Unknown"}</div>
                  <div style={{ fontSize:12, color:C.muted }}>Guest: {activeLobby.guest?.name || "Open seat"}</div>
                </div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  <Btn onClick={handleClaimSeat} disabled={Boolean(activeLobby.guest?.uid)} sm>Join as Player</Btn>
                  <Btn onClick={() => setSpectatorMode(true)} outline color={C.accent2} sm>Watch as Spectator</Btn>
                </div>
                {activeLobby.guest?.uid && (
                  <div style={{ fontSize:12, color:C.muted }}>Lobby already has two players. You can still spectate.</div>
                )}
              </div>
            )}

            {activeLobby && activeLobby.host?.uid === user.uid && activeLobby.status === "waiting" && (
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ ...card() }}>
                  <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Waiting for opponent</div>
                  <div style={{ fontSize:12, color:C.muted }}>Share this code to invite a friend:</div>
                  <div style={{ fontFamily:"Fredoka One", fontSize:28, color:C.accent, letterSpacing:2, marginTop:10 }}>{activeLobby.code}</div>
                </div>
                <div style={{ ...card(), display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:12, color:C.muted }}>Host: {activeLobby.host?.name || "You"}</div>
                  <Btn onClick={handleCloseLobby} outline color={C.err} sm>Close Lobby</Btn>
                </div>
              </div>
            )}

            {activeLobby && activeLobby.status === "waiting" && activeLobby.guest?.uid === user.uid && (
              <div style={{ padding:20, color:C.muted }}>Waiting for host to start...</div>
            )}

            {activeLobby && activeLobby.gameState && (isMember || isSpectating) && (
              <>
                {showSick && <SickModal gs={activeLobby.gameState} onChoose={handleMpSick} />}
                {activeLobby.gameState.phase === "ended" ? (
                  <ResultsScreen gs={activeLobby.gameState} onRematch={handleMpRematch} onMenu={handleLeaveLobby} />
                ) : (
                  <GameScreen
                    gs={activeLobby.gameState}
                    onMove={handleMpMove}
                    onSick={handleMpSick}
                    onEndGame={handleLeaveLobby}
                    readOnly={!isMyTurn}
                    waitingFor={waitingForName}
                  />
                )}
                <div style={{ padding:"0 16px 20px" }}>
                  <div style={{ ...card({ marginTop:10 }) }}>
                    <div style={{ fontWeight:800, fontSize:13, marginBottom:8 }}>Lobby Chat</div>
                    <div style={{ maxHeight:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:6, fontSize:12 }}>
                      {chatMessages.length === 0 ? (
                        <div style={{ color:C.muted }}>No messages yet.</div>
                      ) : (
                        chatMessages.map((msg) => (
                          <div key={msg.id} style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 8px" }}>
                            <div style={{ fontSize:11, color:C.muted, marginBottom:2 }}>
                              {msg.sender?.name || "Player"} · {msg.role || "spectator"}
                            </div>
                            <div style={{ color:C.text }}>{msg.text}</div>
                          </div>
                        ))
                      )}
                    </div>
                    <div style={{ display:"flex", gap:8, marginTop:10 }}>
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
                        placeholder="Send a message"
                        style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, color:C.text, padding:"8px 10px", borderRadius:8, fontSize:13 }}
                      />
                      <Btn onClick={handleSendChat} sm>Send</Btn>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
