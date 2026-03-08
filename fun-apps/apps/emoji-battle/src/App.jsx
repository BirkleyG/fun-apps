import { useEffect, useMemo, useRef, useState } from "react";
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
import { APP_VERSION, BUILD_DATE } from "./version";
import { ED, PIDS, DEFAULT_DECKS } from "./emojiData";
import { BOT_LEVELS, chooseBotAction, getBotName } from "./ai";

const LANES  = ["Left","Mid","Right"];
const LSHORT = ["L","M","R"];
const ROUND_LIMIT = 5;
const TURN_LIMIT = ROUND_LIMIT * 2;
const LOBBY_COLLECTION = "emoji-battle-lobbies";
const CHAT_LIMIT = 60;
const DECK_SIZE = 13;
const RARITY_ORDER = ["common","rare","epic"];
const RARITY_LIMITS = {
  common: { count:8, dup:3 },
  rare: { count:4, dup:2 },
  epic: { count:1, dup:1 }
};
const RARITY_COLORS = { common:"#94a3b8", rare:"#60a5fa", epic:"#f472b6" };

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

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i=copy.length-1;i>0;i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const mkCard = (eid) => ({ eid, id:`${eid}-${Math.random().toString(36).slice(2,10)}` });

const deckRarity = (eid) => ED[eid]?.rarity || "common";

const countByRarity = (cards) => {
  const counts = { common:0, rare:0, epic:0 };
  cards.forEach((eid) => { counts[deckRarity(eid)] += 1; });
  return counts;
};

const countCardCopies = (cards, eid) => cards.filter((c) => c === eid).length;

const isDeckValid = (cards) => {
  if (cards.length !== DECK_SIZE) return false;
  const counts = countByRarity(cards);
  if (!RARITY_ORDER.every((r) => counts[r] === RARITY_LIMITS[r].count)) return false;
  const map = new Map();
  cards.forEach((eid) => map.set(eid, (map.get(eid) || 0) + 1));
  for (const [eid, count] of map.entries()) {
    const rarity = deckRarity(eid);
    if (count > RARITY_LIMITS[rarity].dup) return false;
  }
  return true;
};

const normalizeDeck = (deck) => {
  if (!deck || !Array.isArray(deck.cards)) return null;
  const trimmed = deck.cards.filter((eid) => ED[eid] && ED[eid].play);
  if (!isDeckValid(trimmed)) return null;
  return {
    id: deck.id || `deck-${Math.random().toString(36).slice(2,6)}`,
    name: deck.name || "Deck",
    icon: deck.icon || "💀",
    cards: trimmed
  };
};

const loadDecks = (uid = null) => {
  if (typeof window === "undefined") return { decks: DEFAULT_DECKS, selectedDeckId: DEFAULT_DECKS[0].id, uid: null };
  try {
    const raw = window.localStorage.getItem("emojiBattleDecks_v1");
    if (!raw) return { decks: DEFAULT_DECKS, selectedDeckId: DEFAULT_DECKS[0].id, uid: null };
    const parsed = JSON.parse(raw);
    let deckArr = null;
    let selectedDeckId = null;
    let storedUid = null;
    if (Array.isArray(parsed)) {
      deckArr = parsed;
    } else if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.decks)) deckArr = parsed.decks;
      if (typeof parsed.selectedDeckId === "string") selectedDeckId = parsed.selectedDeckId;
      if (typeof parsed.uid === "string") storedUid = parsed.uid;
    }
    if (uid && storedUid && storedUid !== uid) {
      return { decks: DEFAULT_DECKS, selectedDeckId: DEFAULT_DECKS[0].id, uid: null };
    }
    if (!Array.isArray(deckArr) || deckArr.length !== 3) {
      return { decks: DEFAULT_DECKS, selectedDeckId: DEFAULT_DECKS[0].id, uid: storedUid };
    }
    const normalized = deckArr.map(normalizeDeck);
    if (normalized.some((d) => !d)) {
      return { decks: DEFAULT_DECKS, selectedDeckId: DEFAULT_DECKS[0].id, uid: storedUid };
    }
    if (!normalized.find((d) => d.id === selectedDeckId)) selectedDeckId = normalized[0].id;
    return { decks: normalized, selectedDeckId, uid: storedUid };
  } catch {
    return { decks: DEFAULT_DECKS, selectedDeckId: DEFAULT_DECKS[0].id, uid: null };
  }
};

const saveDecks = (decks, selectedDeckId, uid = null) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("emojiBattleDecks_v1", JSON.stringify({ decks, selectedDeckId, uid }));
};

const getDeckById = (decks, id) => decks.find((d) => d.id === id) || decks[0];
const serializeDecks = (decks, selectedDeckId) => JSON.stringify({ decks, selectedDeckId });
const toIndexObject = (value) => {
  if (!Array.isArray(value)) return value;
  return value.reduce((acc, row, i) => {
    acc[i] = row;
    return acc;
  }, {});
};
const fromIndexObject = (value) => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => value[k]);
};
const encodeGameState = (state) => {
  if (!state) return state;
  const copy = JSON.parse(JSON.stringify(state));
  ["as", "deckOrders", "hands", "under"].forEach((key) => {
    if (copy[key] !== undefined) copy[key] = toIndexObject(copy[key]);
  });
  return copy;
};
const decodeGameState = (state) => {
  if (!state) return state;
  const copy = JSON.parse(JSON.stringify(state));
  ["as", "deckOrders", "hands", "under"].forEach((key) => {
    if (copy[key] !== undefined) copy[key] = fromIndexObject(copy[key]);
  });
  return copy;
};

/* ===========================================================
   GAME LOGIC
=========================================================== */
const mkSlot = (id="grin") => ({ eid:id, locked:false, lu:null, tr:null, bonus:0, coffinVal:null, poison:false });
const canRepl  = (slot,t) => !slot.locked || (slot.lu!==null && t>slot.lu);
const canPlaySlot = (slot, t, eid) => canRepl(slot, t) || (eid === "monument" && slot.locked);
const getAP    = gs => gs.ct%2;
const getRound = gs => Math.floor(gs.ct/2)+1;

const isPerson = eid => ED[eid].tags.includes("person");
const isHuman = eid => ED[eid].tags.includes("human");
const isSkull = eid => eid === "skull";
const isCrossbones = eid => eid === "crossbones";
const isSkullState = eid => isSkull(eid) || isCrossbones(eid);
const isPinned = (s, pid, si) => s.as[1-pid][si]?.eid === "pin";
const hasEid = (as, eid) => as.some(army => army.some(slot => slot.eid === eid));
const countEid = (army, eid) => army.filter(slot => slot.eid === eid).length;
const countSkulls = army => countEid(army, "skull");
const countSkullStates = army => army.filter(slot => isSkullState(slot.eid)).length;
const countSkullStatesAll = as => as.reduce((sum, army) => sum + countSkullStates(army), 0);

const slotBasePoints = (slot, lichActive=false) => {
  const def = ED[slot.eid];
  let base = typeof slot.coffinVal === "number" ? slot.coffinVal : def.bp;
  if (lichActive && (slot.eid === "skull" || slot.eid === "crossbones")) base = Math.abs(def.bp);
  return base;
};
const slotPoints = (slot, lichActive=false) => slotBasePoints(slot, lichActive) + (slot.bonus || 0);

const resolveSkullEid = (s, source) => {
  if (hasEid(s.as, "graveyard")) return "crossbones";
  if (source === "dead_face" && hasEid(s.as, "mutation")) return "crossbones";
  return "skull";
};

const markSkullCreated = (s, prevEid, nextEid) => {
  if (prevEid !== nextEid && isSkullState(nextEid)) s.roundFlags.skullCreated = true;
};

const lockUntilNextRound = (s) => 2 * getRound(s) + 1;
const lockSlot = (slot, untilCt) => {
  if (slot.locked && slot.lu === null) return;
  slot.locked = true;
  if (typeof untilCt === "number") {
    slot.lu = typeof slot.lu === "number" ? Math.max(slot.lu, untilCt) : untilCt;
  } else {
    slot.lu = null;
  }
};

function placeSlot(s, pid, si, eid, opts = {}) {
  const prev = s.as[pid][si];
  let finalEid = eid;

  const oppSlot = s.as[1-pid][si];
  if (oppSlot.eid === "poison" && oppSlot.poison && !opts.ignorePoison) {
    finalEid = resolveSkullEid(s, "poison");
    s.as[1-pid][si] = mkSlot("grin");
    s.log.push(`⚗️ Poison triggered — ${ED[eid].e} became ${ED[finalEid].e} and poison reset to 😀.`);
  }

  const next = mkSlot(finalEid);
  if (finalEid === "dead_face") next.tr = getRound(s) + 1;
  if (finalEid === "poison") next.poison = true;
  if (finalEid === "coffin" && typeof opts.coffinVal === "number") next.coffinVal = opts.coffinVal;
  s.as[pid][si] = next;
  markSkullCreated(s, prev.eid, finalEid);

  return { prev, finalEid };
}

const initDeckState = (deck) => {
  const order = shuffle(deck.cards.map(mkCard));
  return {
    order,
    index: 3,
    hand: [order[0] || null, order[1] || null, order[2] || null],
    lockIndex: null,
    under: [],
    underIndex: null
  };
};

const ensureDeckState = (s) => {
  if (!s.decks || s.decks.length !== 2) {
    const fallback = DEFAULT_DECKS[0];
    s.decks = [fallback, fallback];
  }
  if (!s.deckOrders || !s.hands || !s.deckIndex) {
    s.deckOrders = [];
    s.deckIndex = [];
    s.hands = [];
    s.lockIndex = [];
    s.under = [];
    s.underIndex = [];
    for (let p=0;p<2;p++) {
      const ds = initDeckState(s.decks[p]);
      s.deckOrders[p] = ds.order;
      s.deckIndex[p] = ds.index;
      s.hands[p] = ds.hand;
      s.lockIndex[p] = ds.lockIndex;
      s.under[p] = ds.under;
      s.underIndex[p] = ds.underIndex;
    }
  }
  if (!s.lockIndex) s.lockIndex = [null, null];
  if (!s.under) s.under = [[], []];
  if (!s.underIndex) s.underIndex = [null, null];
};

const drawCard = (s, pid) => {
  let order = s.deckOrders[pid];
  let idx = s.deckIndex[pid] || 0;
  if (!order || order.length === 0) return null;
  if (idx >= order.length) {
    order = shuffle(s.decks[pid].cards.map(mkCard));
    idx = 0;
    s.deckOrders[pid] = order;
  }
  const card = order[idx] || null;
  s.deckIndex[pid] = idx + 1;
  return card;
};

const advanceConveyorForPlayer = (s, pid) => {
  const hand = s.hands[pid];
  const lockIndex = s.lockIndex[pid];
  let under = s.under[pid] || [];
  let underIndex = s.underIndex[pid];
  const next = [null, null, null];

  if (lockIndex !== null) next[lockIndex] = hand[lockIndex];

  for (let src=0;src<3;src++) {
    if (src === lockIndex) continue;
    const card = hand[src];
    if (!card) continue;
    const dst = src - 1;
    if (dst < 0) continue;
    if (lockIndex !== null && dst === lockIndex) {
      if (lockIndex !== 0) under.push(card);
      continue;
    }
    if (next[dst] === null) next[dst] = card;
  }

  if (underIndex !== null && under.length > 0) {
    if (underIndex >= 0 && underIndex <= 2 && next[underIndex] === null) {
      next[underIndex] = under.shift();
    }
    if (under.length === 0 && lockIndex === null) underIndex = null;
  }

  const newCard = drawCard(s, pid);
  if (newCard) {
    if (lockIndex === 2) under.push(newCard);
    else if (next[2] === null) next[2] = newCard;
  }

  s.hands[pid] = next;
  s.under[pid] = under;
  s.underIndex[pid] = underIndex;
};

function applyRoundEnd(s) {
  const skullStates = countSkullStatesAll(s.as);
  const boneSlots = [];
  const candleSlots = [];
  const crowSlotsByPlayer = [[], []];
  const decaySlots = [];

  for (let p=0;p<2;p++) {
    for (let si=0;si<3;si++) {
      const slot = s.as[p][si];
      if (slot.eid === "bone") boneSlots.push({ pid:p, si, slot });
      if (slot.eid === "candle") candleSlots.push({ pid:p, si, slot });
      if (slot.eid === "crow") crowSlotsByPlayer[p].push({ pid:p, si, slot });
      if (slot.eid === "decay") decaySlots.push({ pid:p, si });
    }
  }

  if (skullStates > 0 && boneSlots.length > 0) {
    let applied = 0;
    boneSlots.forEach(({ pid, si, slot }) => {
      if (isPinned(s, pid, si)) return;
      slot.bonus += skullStates;
      applied += 1;
    });
    if (applied > 0) s.log.push(`🦴 Bone gained +${skullStates} on ${applied} slot${applied!==1?"s":""} (${skullStates} skull states on board).`);
  }

  for (let p=0;p<2;p++) {
    const skullsOpp = countSkulls(s.as[1-p]);
    if (skullsOpp > 0 && crowSlotsByPlayer[p].length > 0) {
      let applied = 0;
      crowSlotsByPlayer[p].forEach(({ pid, si, slot }) => {
        if (isPinned(s, pid, si)) return;
        slot.bonus += skullsOpp;
        applied += 1;
      });
      if (applied > 0) s.log.push(`🐦‍⬛ Crow gained +${skullsOpp} on ${applied} slot${applied!==1?"s":""} (${s.players[1-p].name} has ${skullsOpp} 💀).`);
    }
  }

  if (decaySlots.length > 0) {
    decaySlots.forEach(({ pid, si }) => {
      const target = s.as[1-pid][si];
      if (!target || isSkullState(target.eid)) return;
      const before = slotPoints(target, s.lichActive);
      const after = before - 1;
      if (after <= 0) {
        const prevEid = target.eid;
        const result = placeSlot(s, 1-pid, si, resolveSkullEid(s, "decay"));
        s.log.push(`🧪 Decay rotted ${ED[prevEid].e} into ${ED[result.finalEid].e}.`);
      } else {
        target.bonus = (target.bonus || 0) - 1;
        s.log.push(`🧪 Decay weakened ${ED[target.eid].e} by 1.`);
      }
    });
  }

  if (s.roundFlags.skullCreated && candleSlots.length > 0) {
    let applied = 0;
    candleSlots.forEach(({ pid, si, slot }) => {
      if (isPinned(s, pid, si)) return;
      slot.bonus += 2;
      applied += 1;
    });
    if (applied > 0) s.log.push(`🕯️ Candle triggered — +2 on ${applied} slot${applied!==1?"s":""}.`);
  }

  s.roundFlags.skullCreated = false;
}

function applyRoundStartTransforms(s) {
  const round = getRound(s);
  for (let p=0;p<2;p++) {
    for (let si=0;si<3;si++) {
      const slot = s.as[p][si];
      if (slot.eid === "dead_face" && slot.tr !== null && slot.tr <= round) {
        const targetEid = resolveSkullEid(s, "dead_face");
        const result = placeSlot(s, p, si, targetEid);
        s.log.push(`😵 Dead Face became ${ED[result.finalEid].e} at round start.`);
      }
    }
  }
}

function advanceTurn(s) {
  for (let p=0;p<2;p++) advanceConveyorForPlayer(s, p);
  s.ct += 1;
  if (s.ct % 2 === 0) {
    applyRoundEnd(s);
    if (s.ct < TURN_LIMIT) applyRoundStartTransforms(s);
  }
  if (s.ct >= TURN_LIMIT) {
    s.phase = "ended";
    s.sc = calcScores(s.as, s.lichActive);
    s.winner = s.sc[0].total>s.sc[1].total?0:s.sc[1].total>s.sc[0].total?1:-1;
  } else {
    s.phase = "sel";
  }
}

function checkGlobal(gs, pid, eid) {
  const def = ED[eid];
  const r = def.req;
  if (!r) return null;
  const as = gs.as;
  const opp = as[1-pid];
  if (r === "opp_two_skulls" && countSkulls(opp) < 2) return "Opponent needs ≥2 💀.";
  if (r === "turn_4_or_5" && getRound(gs) < 4) return "Can only be played on Turn 4 or 5.";
  if (r === "opp_points_gt_10") {
    const scores = calcScores(as, gs.lichActive);
    if (scores[1-pid].total <= 10) return "Opponent must have >10 total points.";
  }
  return null;
}

function checkSlot(gs, pid, eid, si) {
  const def = ED[eid];
  const as = gs.as;
  const mine = as[pid];
  const opp = as[1-pid];
  const r = def.req;
  if (r === "replace_person" && !isPerson(mine[si].eid)) return "Must replace a Person (😀 or 😵).";
  if (r === "replace_skull" && mine[si].eid !== "skull") return "Must replace a 💀.";
  if (r === "replace_skull_or_crossbones" && !isSkullState(mine[si].eid)) return "Must replace a 💀 or ☠️.";
  if (r === "replace_min_points_2" && slotPoints(mine[si], gs.lichActive) < 2) return "Must replace an emoji worth 2+ points.";
  if (r === "replace_locked" && !mine[si].locked) return "Must replace a locked emoji.";
  if (r === "adjacent_skull") {
    const left = si>0 ? mine[si-1].eid : null;
    const right = si<2 ? mine[si+1].eid : null;
    if (left!=="skull" && right!=="skull") return "Must be placed next to a 💀.";
  }
  if (r === "across_any" && !opp[si]) return "Must be played across from an emoji.";
  return null;
}

function getHandOffers(gs) {
  const pid=getAP(gs), {as,ct}=gs;
  const hand = gs.hands?.[pid] || [null,null,null];
  return hand.map((card)=>{
    if (!card) return { ok:false, reason:"Empty slot", eid:null, validSlots:[] };
    const id = card.eid;
    const ge=checkGlobal(gs,pid,id);
    if (ge) return {ok:false,reason:ge,eid:id,validSlots:[]};
    const validSlots=[];
    for (let s=0;s<3;s++) {
      if (!canPlaySlot(as[pid][s],ct,id)) continue;
      if (!checkSlot(gs,pid,id,s)) validSlots.push(s);
    }
    if (validSlots.length>0) return {ok:true,reason:null,eid:id,validSlots};
    if ([0,1,2].every(s=>!canPlaySlot(as[pid][s],ct,id))) return {ok:false,reason:"All your slots are locked.",eid:id,validSlots:[]};
    for (let s=0;s<3;s++) { if (!canPlaySlot(as[pid][s],ct,id)) continue; const se=checkSlot(gs,pid,id,s); if (se) return {ok:false,reason:se,eid:id,validSlots:[]}; }
    return {ok:false,reason:"No valid slot.",eid:id,validSlots:[]};
  });
}

function slotErr(gs, eid, si) {
  const pid=getAP(gs);
  if (!canPlaySlot(gs.as[pid][si],gs.ct,eid)) return "Slot is locked 🔒";
  const ge=checkGlobal(gs,pid,eid); if (ge) return ge;
  return checkSlot(gs,pid,eid,si);
}

function calcScores(as, lichActive=false) {
  return as.map((army,p)=>{
    const lanes=army.map((sl)=>{
      const def=ED[sl.eid];
      const base = slotBasePoints(sl, lichActive);
      const bonus = sl.bonus || 0;
      const fin = base + bonus;
      return {eid:sl.eid,e:def.e,name:def.n,base,buff:0,bonus,supp:false,suppMsg:null,half:false,fin};
    });
    return {lanes,total:lanes.reduce((a,l)=>a+l.fin,0)};
  });
}

function applyMove(gs, handIndex, si) {
  const s=JSON.parse(JSON.stringify(gs)); const pid=getAP(s); const evts=[];
  if (!s.roundFlags) s.roundFlags = { skullCreated:false };
  if (typeof s.lichActive !== "boolean") s.lichActive = false;
  ensureDeckState(s);
  for (let p=0;p<2;p++) for (let sl=0;sl<3;sl++) { const slot=s.as[p][sl]; if (slot.locked&&slot.lu!==null&&s.ct>slot.lu) { slot.locked=false; slot.lu=null; } }

  const card = s.hands[pid][handIndex];
  if (!card) return s;
  const eid = card.eid;

  let coffinVal = null;
  if (eid==="coffin") {
    if (s.as[pid][si].eid==="skull") coffinVal = 2;
    if (s.as[pid][si].eid==="crossbones") coffinVal = 4;
  }

  const placed = placeSlot(s, pid, si, eid, { coffinVal });
  s.hist.push({turn:s.ct,pid,eid,si});

  if (placed.finalEid === eid) {
    if (eid==="dagger") {
      s.pend={type:"dagger",pid,si};
      s.phase="ec";
      evts.push("🗡️ Dagger: choose a friendly slot to corrupt.");
    }
    if (eid==="plague") {
      placeSlot(s, 1-pid, si, "dead_face");
      evts.push("☣️ Plague infected the opposing lane.");
    }
    if (eid==="graveyard") {
      let converted = 0;
      for (let p=0;p<2;p++) {
        for (let sl=0;sl<3;sl++) {
          if (s.as[p][sl].eid==="skull") {
            placeSlot(s, p, sl, "crossbones");
            converted++;
          }
        }
      }
      if (converted>0) evts.push(`🪦 Graveyard corrupted ${converted} 💀 → ☠️.`);
    }
    if (eid==="lich") {
      s.lichActive = true;
      evts.push("👑 Lich King empowered all skulls (+2/+4).");
    }
    if (eid==="dead_face") evts.push("😵 Dead Face will rot next round.");
    if (eid==="poison") evts.push("⚗️ Poison set a trap across its lane.");
    if (eid==="coffin" && coffinVal!==null) evts.push(`⚰️ Coffin converted ${placed.prev.eid==="skull"?"💀":"☠️"} into +${coffinVal}.`);
    if (eid==="executioner") {
      const target = s.as[1-pid][si];
      const pts = slotPoints(target, s.lichActive);
      if (pts >= 4) {
        const prevEid = target.eid;
        const result = placeSlot(s, 1-pid, si, resolveSkullEid(s, "executioner"));
        evts.push(`🪓 Executioner executed ${ED[prevEid].e} → ${ED[result.finalEid].e}.`);
      }
    }
    if (eid==="duel") {
      const scores = calcScores(s.as, s.lichActive);
      if (scores[1-pid].total > scores[pid].total) {
        const prevEid = s.as[1-pid][si].eid;
        const result = placeSlot(s, 1-pid, si, resolveSkullEid(s, "duel"));
        evts.push(`⚔️ Duel claimed ${ED[prevEid].e} → ${ED[result.finalEid].e}.`);
      }
    }
    if (eid==="infection_strike") {
      let hit = 0;
      [si-1, si, si+1].forEach((idx) => {
        if (idx < 0 || idx > 2) return;
        placeSlot(s, 1-pid, idx, "dead_face");
        hit += 1;
      });
      if (hit > 0) evts.push(`🦠 Infection Strike spread to ${hit} lane${hit!==1?"s":""}.`);
    }
    if (eid==="silent_kill") {
      let killed = 0;
      for (let p=0;p<2;p++) {
        for (let sl=0;sl<3;sl++) {
          if (!s.as[p][sl].locked) continue;
          placeSlot(s, p, sl, resolveSkullEid(s, "silent_kill"));
          killed++;
        }
      }
      if (killed > 0) evts.push(`🔪 Silent Kill struck ${killed} locked emoji${killed!==1?"s":""}.`);
    }
    if (eid==="decay") evts.push("🧪 Decay will rot the opposing lane each round.");
    if (eid==="monument") {
      lockSlot(s.as[pid][si], null);
      evts.push("🏛️ Monument is permanently locked.");
    }
    if (eid==="veteran") {
      const skullsOpp = countSkulls(s.as[1-pid]);
      if (skullsOpp > 0) {
        if (!isPinned(s, pid, si)) {
          s.as[pid][si].bonus += 2;
          evts.push("🎖️ Veteran gained +2.");
        } else {
          evts.push("🧷 Pin blocked Veteran's bonus.");
        }
      }
    }
    if (eid==="freeze") {
      lockSlot(s.as[1-pid][si], lockUntilNextRound(s));
      evts.push("🧊 Freeze locked the opposing emoji next round.");
    }
    if (eid==="pin") evts.push("🧷 Pin applied — the emoji across cannot gain points.");
    if (eid==="lockdown") {
      const until = lockUntilNextRound(s);
      lockSlot(s.as[pid][si], until);
      lockSlot(s.as[1-pid][si], until);
      evts.push("🔒 Lockdown sealed this lane until next round.");
    }
    if (eid==="storm") {
      for (let p=0;p<2;p++) {
        [s.as[p][0], s.as[p][2]] = [s.as[p][2], s.as[p][0]];
      }
      evts.push("🌪️ Storm swapped the left and right lanes.");
    }
    if (eid==="pandemic") {
      let changed = 0;
      for (let p=0;p<2;p++) {
        for (let sl=0;sl<3;sl++) {
          if (!isHuman(s.as[p][sl].eid)) continue;
          placeSlot(s, p, sl, resolveSkullEid(s, "pandemic"));
          changed++;
        }
      }
      if (changed > 0) evts.push(`☣️ Pandemic corrupted ${changed} Human emoji${changed!==1?"s":""}.`);
    }
    if (eid==="cataclysm") {
      let doomed = 0;
      for (let p=0;p<2;p++) {
        for (let sl=0;sl<3;sl++) {
          if (slotPoints(s.as[p][sl], s.lichActive) > 1) continue;
          placeSlot(s, p, sl, "dead_face");
          doomed++;
        }
      }
      if (doomed > 0) evts.push(`🌋 Cataclysm doomed ${doomed} low-value emoji${doomed!==1?"s":""}.`);
    }
    if (eid==="purge") {
      for (let p=0;p<2;p++) {
        for (let sl=0;sl<3;sl++) {
          placeSlot(s, p, sl, "grin");
        }
      }
      evts.push("🔥 Purge reset the board to 😀.");
    }
    if (eid==="carrion_swarm") {
      const skullsOpp = countSkulls(s.as[1-pid]);
      if (skullsOpp > 0) {
        if (!isPinned(s, pid, si)) {
          s.as[pid][si].bonus += skullsOpp;
          evts.push(`🐦 Carrion Swarm gained +${skullsOpp}.`);
        } else {
          evts.push("🧷 Pin blocked Carrion Swarm's bonus.");
        }
      }
    }
    if (eid==="trick") {
      s.pend={type:"trick",pid};
      s.phase="ec";
      evts.push("🤡 Trick: choose a friendly slot to swap with the emoji across.");
    }
  }

  s.hands[pid][handIndex] = null;
  if (s.lockIndex[pid] === handIndex) {
    s.lockIndex[pid] = null;
    s.underIndex[pid] = s.under[pid]?.length && handIndex > 0 ? handIndex - 1 : null;
  }

  evts.forEach(e=>s.log.push(e));
  if (s.phase!=="ec") advanceTurn(s);
  return s;
}

function applySick(gs, tsi) {
  const s=JSON.parse(JSON.stringify(gs));
  if (!s.pend) return s;
  if (!s.roundFlags) s.roundFlags = { skullCreated:false };
  if (typeof s.lichActive !== "boolean") s.lichActive = false;
  ensureDeckState(s);
  const {pid,si, type}=s.pend;
  if (type==="dagger") {
    if (tsi!==si) {
      const from = s.as[pid][tsi].eid;
      const targetEid = resolveSkullEid(s, "dagger");
      const result = placeSlot(s, pid, tsi, targetEid);
      s.log.push(`🗡️ Dagger corrupted ${ED[from].e} → ${ED[result.finalEid].e}`);
    }
  }
  if (type==="trick") {
    if (typeof tsi === "number" && tsi >= 0 && tsi <= 2) {
      const mine = s.as[pid][tsi];
      const opp = s.as[1-pid][tsi];
      s.as[pid][tsi] = opp;
      s.as[1-pid][tsi] = mine;
      s.log.push(`🤡 Trick swapped the ${LANES[tsi]} lane.`);
    }
  }
  s.pend=null;
  advanceTurn(s);
  return s;
}

function applyPass(gs) {
  const s=JSON.parse(JSON.stringify(gs)); const pid=getAP(s);
  if (!s.roundFlags) s.roundFlags = { skullCreated:false };
  if (typeof s.lichActive !== "boolean") s.lichActive = false;
  ensureDeckState(s);
  s.log.push(`${s.players[pid].name} passed and let the conveyor advance.`);
  advanceTurn(s);
  return s;
}

function applyLock(gs, handIndex) {
  const s=JSON.parse(JSON.stringify(gs)); const pid=getAP(s);
  ensureDeckState(s);
  const card = s.hands[pid][handIndex];
  if (!card) return s;
  if (s.lockIndex[pid] === handIndex) {
    s.lockIndex[pid] = null;
    s.underIndex[pid] = s.under[pid]?.length && handIndex > 0 ? handIndex - 1 : null;
    s.log.push(`${s.players[pid].name} released a lock.`);
  } else {
    s.lockIndex[pid] = handIndex;
    s.underIndex[pid] = handIndex > 0 ? handIndex - 1 : null;
    s.under[pid] = [];
    s.log.push(`${s.players[pid].name} locked a card in place.`);
  }
  return s;
}

function initGame(p1,p2, deck1, deck2) {
  const d1 = deck1 || DEFAULT_DECKS[0];
  const d2 = deck2 || DEFAULT_DECKS[0];
  const decks = [
    { id:d1.id, name:d1.name, icon:d1.icon, cards:[...d1.cards] },
    { id:d2.id, name:d2.name, icon:d2.icon, cards:[...d2.cards] }
  ];
  const ds1 = initDeckState(decks[0]);
  const ds2 = initDeckState(decks[1]);
  return {
    players:[{name:p1||"Player 1"},{name:p2||"Player 2"}],
    as:[[mkSlot(),mkSlot(),mkSlot()],[mkSlot(),mkSlot(),mkSlot()]],
    ct:0,
    phase:"sel",
    hist:[],
    log:[],
    sc:null,
    pend:null,
    roundFlags:{ skullCreated:false },
    lichActive:false,
    decks,
    deckOrders:[ds1.order, ds2.order],
    deckIndex:[ds1.index, ds2.index],
    hands:[ds1.hand, ds2.hand],
    lockIndex:[ds1.lockIndex, ds2.lockIndex],
    under:[ds1.under, ds2.under],
    underIndex:[ds1.underIndex, ds2.underIndex]
  };
}

/* ===========================================================
   STYLES
=========================================================== */
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800;900&display=swap');`;
const C = { bg:"#08080f", surf:"#13132b", hi:"#1e1e40", border:"#2a2a55", accent:"#f5c518", accent2:"#ff7043", text:"#f0f0ff", muted:"#7070a0", ok:"#4ade80", err:"#f87171", lock:"#a78bfa" };
const card = (extra={}) => ({ background:C.surf, border:`1px solid ${C.border}`, borderRadius:14, padding:14, ...extra });

/* ===========================================================
   SHARED COMPONENTS
=========================================================== */
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
  const bonus = slot.bonus || 0;
  const basePoints = typeof slot.coffinVal === "number" ? slot.coffinVal : def.bp;
  const points = basePoints + bonus;
  const border = selected ? `2px solid ${C.accent}` : highlight ? `2px solid ${C.ok}` : `1px solid ${isLocked ? C.lock : C.border}`;
  const bg = selected ? "#2a2a10" : highlight ? "#0a2a0a" : C.surf;
  return (
    <div onClick={onClick} style={{ background:bg, border, borderRadius:12, padding:big?"14px 10px":"10px 8px", textAlign:"center", cursor:onClick?"pointer":"default", minWidth:big?72:58, position:"relative", transition:"all 0.15s", boxShadow:selected?`0 0 12px ${C.accent}55`:"none" }}>
      {label && <div style={{ fontSize:10, color:C.muted, fontWeight:700, marginBottom:2, textTransform:"uppercase", letterSpacing:1 }}>{label}</div>}
      <div style={{ fontSize:big?34:26 }}>{def.e}</div>
      <div style={{ fontSize:big?11:9, color:C.muted, fontWeight:700, marginTop:2 }}>{points}pt{points!==1?"s":""}</div>
      {isLocked && showLock && <div style={{ position:"absolute", top:-6, right:-6, fontSize:13, background:C.lock, borderRadius:20, padding:"1px 5px" }}>🔒</div>}
    </div>
  );
}

function HandCard({ card, selected, locked, disabled, onPick, onLock, onInfo }) {
  if (!card) {
    return (
      <div style={{ background:"#0f1022", border:`1px dashed ${C.border}`, borderRadius:12, padding:"12px 10px", textAlign:"center", minWidth:80, opacity:0.6 }}>
        <div style={{ fontSize:18, color:C.muted }}>Empty</div>
        <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Slot</div>
      </div>
    );
  }
  const def = ED[card.eid];
  const rarity = def.rarity || "common";
  const border = selected ? `2px solid ${C.accent}` : `1px solid ${C.border}`;
  return (
    <div onClick={!disabled ? onPick : undefined} style={{ position:"relative", background:C.surf, border, borderRadius:12, padding:"10px 8px", textAlign:"center", minWidth:80, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1, boxShadow:selected?`0 0 10px ${C.accent}55`:"none", transition:"all 0.12s" }}>
      <div style={{ position:"absolute", top:6, right:6, display:"flex", gap:6 }}>
        <button onClick={(e)=>{ e.stopPropagation(); onInfo(); }} style={{ width:18, height:18, borderRadius:9, background:C.hi, border:`1px solid ${C.border}`, color:C.muted, fontSize:9, fontWeight:700, cursor:"pointer" }}>i</button>
        <button onClick={(e)=>{ e.stopPropagation(); onLock(); }} style={{ width:18, height:18, borderRadius:9, background:locked?C.lock:C.hi, border:`1px solid ${C.border}`, color:locked?"#120f24":C.muted, fontSize:9, fontWeight:700, cursor:"pointer" }}>{locked ? "🔒" : "🔓"}</button>
      </div>
      <div style={{ fontSize:26, marginTop:6 }}>{def.e}</div>
      <div style={{ fontSize:10, color:C.text, fontWeight:700, marginTop:4 }}>{def.n}</div>
      <div style={{ fontSize:10, color:RARITY_COLORS[rarity] || C.muted, fontWeight:800, textTransform:"uppercase", letterSpacing:1, marginTop:2 }}>{rarity}</div>
      {locked && <div style={{ position:"absolute", bottom:6, right:6, fontSize:11, background:C.lock, borderRadius:10, padding:"0 6px", color:"#120f24", fontWeight:800 }}>LOCK</div>}
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
        {def.rarity && <div style={{ fontSize:11, color:RARITY_COLORS[def.rarity] || C.muted, fontWeight:800, textAlign:"center", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{def.rarity} rarity</div>}
        <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>TAGS: {def.tags.join(" • ")}</div>
        {def.rt && <div style={{ background:"#ff700320", border:`1px solid ${C.accent2}40`, borderRadius:8, padding:"8px 10px", fontSize:13, color:C.accent2, marginBottom:10, fontWeight:600 }}>{def.rt}</div>}
        <div style={{ fontSize:14, color:C.text, lineHeight:1.6 }}>{def.rules}</div>
        <Btn onClick={onClose} sm style={{ marginTop:16, width:"100%" }}>Close</Btn>
      </div>
    </div>
  );
}

/* ===========================================================
   MENU SCREEN
=========================================================== */
function MenuScreen({ onPlay, onRulebook, onSettings, onMultiplayer, onDecks }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Nunito, sans-serif" }}>
      <div style={{ marginBottom:8, fontSize:72 }}>⚔️</div>
      <h1 style={{ fontFamily:"Fredoka One", fontSize:52, color:C.accent, margin:0, letterSpacing:2, textShadow:`0 0 40px ${C.accent}60` }}>EMOJI BATTLE!</h1>
      <p style={{ color:C.muted, fontSize:14, margin:"8px 0 40px", letterSpacing:1, textTransform:"uppercase" }}>Fast 1v1 • 5 Rounds • Strategy</p>
      <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:300 }}>
        <Btn onClick={onPlay} style={{ width:"100%", fontSize:18, padding:"16px 0" }}>⚔️ New Match</Btn>
        <Btn onClick={onMultiplayer} style={{ width:"100%", fontSize:18, padding:"16px 0" }} color={C.accent2}>🌐 Multiplayer</Btn>
        <Btn onClick={onDecks} style={{ width:"100%", fontSize:18, padding:"16px 0" }} color={C.ok}>🧰 Decks</Btn>
        <Btn onClick={onRulebook} outline style={{ width:"100%" }}>📖 Rulebook & Emoji Index</Btn>
        <Btn onClick={onSettings} outline color={C.muted} style={{ width:"100%" }}>⚙️ Settings</Btn>
      </div>
      <div style={{ marginTop:40, display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
        {["😀","🗡️","😵","🦴","💀","☠️","☣️","⚗️","⚰️","🐦‍⬛","👑","🧬","🕯️","🪬","🪦"].map((e,i)=>(
          <span key={i} style={{ fontSize:22, opacity:0.4 }}>{e}</span>
        ))}
      </div>
      <div style={{ marginTop:12, fontSize:11, color:C.muted, letterSpacing:1 }}>v{APP_VERSION} · {BUILD_DATE}</div>
    </div>
  );
}

/* ===========================================================
   SETUP SCREEN
=========================================================== */
function SetupScreen({ onBack, onStart, decks, defaultDeckId }) {
  const [p1,setP1]=useState("Player 1");
  const [p2,setP2]=useState("Player 2");
  const p2HumanRef = useRef("Player 2");
  const [botEnabled, setBotEnabled] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState(BOT_LEVELS[1]?.id || "medium");
  const fallbackDeck = decks?.[0]?.id || DEFAULT_DECKS[0].id;
  const [p1DeckId,setP1DeckId]=useState(defaultDeckId || fallbackDeck);
  const [p2DeckId,setP2DeckId]=useState(defaultDeckId || fallbackDeck);
  useEffect(() => {
    if (botEnabled) {
      p2HumanRef.current = p2;
      setP2(getBotName(botDifficulty));
    } else {
      setP2(p2HumanRef.current || "Player 2");
    }
  }, [botEnabled, botDifficulty]);
  const inp = (val,set) => (
    <input value={val} onChange={e=>set(e.target.value)} maxLength={16} style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", color:C.text, fontSize:16, fontFamily:"Nunito", fontWeight:700, width:"100%", outline:"none", boxSizing:"border-box" }} />
  );
  const inpBotAware = (val,set) => (
    <input
      value={val}
      onChange={e=>{
        if (botEnabled) return;
        set(e.target.value);
        p2HumanRef.current = e.target.value;
      }}
      disabled={botEnabled}
      maxLength={16}
      style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", color:C.text, fontSize:16, fontFamily:"Nunito", fontWeight:700, width:"100%", outline:"none", boxSizing:"border-box", opacity:botEnabled?0.6:1 }}
    />
  );
  const deckSelect = (val,set) => (
    <select value={val} onChange={e=>set(e.target.value)} style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", color:C.text, fontSize:14, fontFamily:"Nunito", fontWeight:700, width:"100%", outline:"none", boxSizing:"border-box" }}>
      {(decks||DEFAULT_DECKS).map((d)=>(
        <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
      ))}
    </select>
  );
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Nunito, sans-serif" }}>
      <div style={{ maxWidth:380, width:"100%" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.muted, fontSize:14, cursor:"pointer", marginBottom:20, fontFamily:"Nunito", fontWeight:700 }}>← Back</button>
        <h2 style={{ fontFamily:"Fredoka One", fontSize:34, color:C.accent, margin:"0 0 6px" }}>New Match</h2>
        <p style={{ color:C.muted, fontSize:13, margin:"0 0 30px" }}>{botEnabled ? "Single-player vs Bot" : "Pass-and-play — share one device"}</p>
          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            <div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Player 1 Name</div>
              {inp(p1,setP1)}
            </div>
            <div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Player 2 Name</div>
              {inpBotAware(p2,setP2)}
            </div>
            <div style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:12, padding:14 }}>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Bot Settings</div>
              <label style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, color:C.text, fontWeight:700 }}>
                <input type="checkbox" checked={botEnabled} onChange={(e)=>setBotEnabled(e.target.checked)} />
                Play vs Bot
              </label>
              <div style={{ marginTop:10 }}>
                <select value={botDifficulty} onChange={(e)=>setBotDifficulty(e.target.value)} disabled={!botEnabled} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 12px", color:C.text, fontSize:13, fontFamily:"Nunito", fontWeight:700, width:"100%", outline:"none", opacity:botEnabled?1:0.6 }}>
                  {BOT_LEVELS.map((level)=>(
                    <option key={level.id} value={level.id}>{level.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Player 1 Deck</div>
              {deckSelect(p1DeckId,setP1DeckId)}
            </div>
            <div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Player 2 Deck</div>
              {deckSelect(p2DeckId,setP2DeckId)}
            </div>
            <div style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:12, padding:14, fontSize:13, color:C.muted, marginTop:4 }}>
              <strong style={{ color:C.text }}>Rules at a glance:</strong><br/>
            Each player manages 3 emoji slots over 5 rounds. Replace one slot per turn. Highest total score wins!
            </div>
          <Btn onClick={()=>onStart(p1||"Player 1",botEnabled?getBotName(botDifficulty):(p2||"Player 2"),p1DeckId,p2DeckId,botEnabled,botDifficulty)} style={{ width:"100%", fontSize:17, padding:"14px 0", marginTop:6 }}>⚔️ Start Match!</Btn>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   PASS SCREEN
=========================================================== */
function PassScreen({ name, onReady }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Nunito, sans-serif", textAlign:"center" }}>
      <div style={{ fontSize:60, marginBottom:16 }}>🫴</div>
      <h2 style={{ fontFamily:"Fredoka One", fontSize:32, color:C.text, margin:"0 0 8px" }}>Pass the device</h2>
      <p style={{ color:C.accent, fontSize:22, fontWeight:800, margin:"0 0 12px" }}>{name}</p>
      <p style={{ color:C.muted, fontSize:14, margin:"0 0 40px" }}>Your turn is up. Hand it over!</p>
      <Btn onClick={onReady} style={{ fontSize:18, padding:"14px 36px" }}>I'm Ready 👀</Btn>
    </div>
  );
}

/* ===========================================================
   SICK EFFECT CHOOSER MODAL
=========================================================== */
function SickModal({ gs, onChoose }) {
  const {pid,si:sourceSi,type}=gs.pend;
  const army=gs.as[pid];
  const isDagger = type==="dagger";
  const isTrick = type==="trick";
  const icon = isDagger ? "🗡️" : isTrick ? "🤡" : "✨";
  const title = isDagger ? "Dagger Effect" : isTrick ? "Trick" : "Choose Target";
  const desc = isDagger
    ? "Choose another slot in your army to turn into 💀:"
    : isTrick
      ? "Choose a friendly slot to swap with the emoji across from it:"
      : "Choose a target slot:";
  const footer = isDagger
    ? "Tap a slot to corrupt it. (Cannot target 🗡️ itself.)"
    : isTrick
      ? "Tap a slot to swap lanes."
      : "Tap a slot to apply the effect.";
  return (
    <div style={{ position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:20 }}>
      <div style={{ background:C.surf, border:`1px solid ${C.accent}`, borderRadius:18, padding:24, maxWidth:340, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:36, marginBottom:8 }}>{icon}</div>
        <div style={{ fontFamily:"Fredoka One", fontSize:22, color:C.text, marginBottom:8 }}>{title}</div>
        <div style={{ fontSize:14, color:C.muted, marginBottom:20 }}>{desc}</div>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          {army.map((slot,i)=>{
            if (isDagger && i===sourceSi) return <div key={i} style={{ opacity:0.3 }}><SlotCard slot={slot} big label={LSHORT[i]} /></div>;
            return <div key={i} onClick={()=>onChoose(i)} style={{ cursor:"pointer" }}><SlotCard slot={slot} big label={LSHORT[i]} highlight /></div>;
          })}
        </div>
        <div style={{ fontSize:12, color:C.muted, marginTop:14 }}>{footer}</div>
      </div>
    </div>
  );
}

/* ===========================================================
   GAME SCREEN
=========================================================== */
function GameScreen({ gs, onMove, onSick, onEndGame, onPass, onLock, readOnly, waitingFor, viewerPid }) {
  const [selHand,setSelHand]=useState(null);
  const [selSlot,setSelSlot]=useState(null);
  const [tooltip,setTooltip]=useState(null);
  const [errMsg,setErrMsg]=useState(null);

  const activePid=getAP(gs); const round=getRound(gs);
  const viewPid=typeof viewerPid === "number" ? viewerPid : activePid;
  const activeName=gs.players[activePid].name;
  const pname=gs.players[viewPid].name; const oppid=1-viewPid;
  const oppname=gs.players[oppid].name;
  const handOffers=viewPid===activePid ? getHandOffers(gs) : (gs.hands?.[viewPid] || [null,null,null]).map((card)=>({ ok:false, reason:"Not your turn.", eid:card?.eid||null, validSlots:[] }));
  const hand = gs.hands?.[viewPid] || [null,null,null];
  const selectedCard = selHand!==null ? hand[selHand] : null;
  const deckRemaining = gs.deckOrders?.[viewPid] ? Math.max(0, gs.deckOrders[viewPid].length - (gs.deckIndex?.[viewPid] || 0)) : 0;

  useEffect(() => {
    setSelHand(null);
    setSelSlot(null);
    setErrMsg(null);
  }, [gs.ct]);

  function pickHand(hi) {
    if (readOnly) return;
    const offer = handOffers[hi];
    if (!offer?.ok) { setErrMsg(offer?.reason || "Card cannot be played."); return; }
    setSelHand(hi); setSelSlot(null); setErrMsg(null);
  }
  function pickSlot(si) {
    if (readOnly) return;
    if (selHand===null || !selectedCard) { setErrMsg("Pick a card first!"); return; }
    const err=slotErr(gs,selectedCard.eid,si);
    if (err) { setErrMsg(err); return; }
    setSelSlot(si); setErrMsg(null);
  }
  function confirmPlay() {
    if (readOnly) return;
    if (selHand===null||selSlot===null) return;
    onMove(selHand,selSlot);
    setSelHand(null); setSelSlot(null); setErrMsg(null);
  }
  function doPass() {
    if (readOnly || gs.phase === "ec") return;
    onPass();
    setSelHand(null); setSelSlot(null); setErrMsg(null);
  }
  function cancel() { setSelHand(null); setSelSlot(null); setErrMsg(null); }

  const showConfirm = selHand!==null && selSlot!==null;
  const recentLog = gs.log.slice(-4).reverse();
  const turnLabel = readOnly && waitingFor ? `Waiting for ${waitingFor}` : `${activeName}'s Turn`;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, display:"flex", flexDirection:"column", maxWidth:520, margin:"0 auto" }}>
      {/* TOP BAR */}
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontFamily:"Fredoka One", fontSize:18, color:C.accent }}>⚔️ EB!</span>
        <span style={{ fontSize:13, fontWeight:700, color:C.muted }}>Round <strong style={{color:C.text}}>{round}</strong> / {ROUND_LIMIT}</span>
        <span style={{ fontSize:12, fontWeight:800, color:readOnly?C.muted:C.accent2, background:readOnly?"#242443":"#ff704320", padding:"4px 10px", borderRadius:20 }}>
          {turnLabel}
        </span>
        <button onClick={onEndGame} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:12, fontFamily:"Nunito", fontWeight:700 }}>✖ Quit</button>
      </div>

      {/* OPPONENT PANEL */}
      <div style={{ padding:"12px 16px 8px", borderBottom:`1px solid ${C.border}` }}>
        <div style={{ fontSize:12, color:C.muted, fontWeight:700, marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>👤 {oppname}</div>
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
          {gs.as[viewPid].map((slot,i)=>{
            const selectable = selectedCard!==null && canRepl(slot,gs.ct);
            const err = selectedCard ? slotErr(gs,selectedCard.eid,i) : null;
            return (
            <SlotCard key={i} slot={slot} big selected={selSlot===i} highlight={selectable&&!err} label={LSHORT[i]} showLock onClick={!readOnly ? ()=>pickSlot(i) : undefined} />
          );
        })}
      </div>
        <div style={{ fontSize:12, color:C.muted, fontWeight:700, textAlign:"center", textTransform:"uppercase", letterSpacing:1 }}>👤 {pname}</div>
      </div>

      {/* SELECTION STATUS / CONFIRM BAR */}
      {showConfirm ? (
        <div style={{ margin:"10px 16px", background:"#1a1a10", border:`1px solid ${C.accent}`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:22 }}>{selectedCard ? ED[selectedCard.eid].e : ""}</span>
          <span style={{ flex:1, fontSize:13, color:C.text, fontWeight:600 }}>Play <strong>{selectedCard ? ED[selectedCard.eid].n : ""}</strong> into <strong>{LANES[selSlot]}</strong> slot</span>
          <Btn onClick={confirmPlay} style={{ padding:"8px 16px" }} sm>✓ Confirm</Btn>
          <Btn onClick={cancel} outline color={C.muted} sm>✖</Btn>
        </div>
      ) : (
        <div style={{ margin:"10px 16px 4px", minHeight:44, display:"flex", alignItems:"center" }}>
          {selectedCard!==null ? (
            <div style={{ fontSize:13, color:C.accent, fontWeight:700 }}>
              {selectedCard ? ED[selectedCard.eid].e : ""} <strong>{selectedCard ? ED[selectedCard.eid].n : ""}</strong> selected — tap a slot above
            </div>
          ) : (
            <div style={{ fontSize:13, color:C.muted }}>Choose a card to play ↓</div>
          )}
          {errMsg && <div style={{ marginLeft:"auto", fontSize:12, color:C.err, fontWeight:700, maxWidth:180, textAlign:"right" }}>{errMsg}</div>}
        </div>
      )}

      {readOnly && (
        <div style={{ margin:"0 16px 6px", fontSize:12, color:C.muted, fontWeight:700 }}>
          Waiting for {waitingFor || "opponent"} to move…
        </div>
      )}

      {/* HAND CONVEYOR */}
      <div style={{ padding:"4px 16px 12px" }}>
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          {hand.map((card,i)=>(
            <HandCard
              key={i}
              card={card}
              selected={selHand===i}
              locked={gs.lockIndex?.[viewPid]===i}
              disabled={!handOffers[i]?.ok}
              onPick={()=>pickHand(i)}
              onLock={()=>{ if (!readOnly) onLock(i); }}
              onInfo={()=>{ if (card) setTooltip(card.eid); }}
            />
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
          <div style={{ fontSize:11, color:C.muted }}>Deck {gs.decks?.[viewPid]?.name || "Deck"} · {deckRemaining} left</div>
          <Btn onClick={doPass} outline color={C.muted} sm disabled={readOnly || gs.phase === "ec"}>Pass Turn</Btn>
        </div>
      </div>

      {/* EVENT LOG */}
      {recentLog.length>0 && (
        <div style={{ margin:"0 16px 16px", background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px" }}>
          <div style={{ fontSize:10, color:C.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Recent Events</div>
          {recentLog.map((e,i)=>(
            <div key={i} style={{ fontSize:12, color:C.muted, padding:"2px 0", borderBottom:i<recentLog.length-1?`1px solid ${C.border}`:"none" }}>• {e}</div>
          ))}
        </div>
      )}

      {tooltip && <TooltipModal eid={tooltip} onClose={()=>setTooltip(null)} />}
    </div>
  );
}

/* ===========================================================
   RESULTS SCREEN
=========================================================== */
function ResultsScreen({ gs, onRematch, onMenu }) {
  const [tab,setTab]=useState("breakdown");
  const sc=gs.sc;
  const w=gs.winner; // 0 or 1 for winner index, -1 for draw
  const titleColor = w===-1?C.accent:C.ok;
const titleText  = w===-1?"🤝 DRAW!":("🏆 "+gs.players[w].name+" Wins!");
  // Build effect messages
  const effects=[];
  if (gs.lichActive) effects.push("👑 Lich King turned 💀 into +2 and ☠️ into +4 for both players.");
  for (let p=0;p<2;p++) {
    sc[p].lanes.forEach((l,s)=>{ if (l.bonus>0) effects.push(`${l.e} ${l.name} gained +${l.bonus} bonus (${gs.players[p].name}, lane ${LANES[s]})`); });
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
                  {p===w?"🏆 ":""}{gs.players[p].name} — <span style={{color:C.accent}}>{sc[p].total} pts</span>
                </div>
                {sc[p].lanes.map((l,s)=>(
                  <div key={s} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:s<2?`1px solid ${C.border}`:"none" }}>
                    <div style={{ fontSize:11, color:C.muted, width:20, fontWeight:700 }}>{LSHORT[s]}</div>
                    <div style={{ fontSize:20 }}>{l.e}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{l.name}</div>
                      <div style={{ fontSize:10, color:C.muted }}>
                        {l.base}bp
                        {l.bonus>0&&<span style={{color:C.ok}}> +{l.bonus} bonus</span>}
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
                  <div key={i} style={{ ...card({marginBottom:8}), fontSize:13, lineHeight:1.6 }}>• {e}</div>
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
                    <div style={{fontSize:11,color:C.muted}}>Round {Math.floor(m.turn/2)+1} • {LANES[m.si]} slot</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:520, background:C.bg, borderTop:`1px solid ${C.border}`, padding:16, display:"flex", gap:10 }}>
        <Btn onClick={onRematch} style={{ flex:1 }}>🔁 Rematch</Btn>
        <Btn onClick={onMenu} outline style={{ flex:1 }}>🏠 Menu</Btn>
      </div>
    </div>
  );
}

/* ===========================================================
   RULEBOOK SCREEN
=========================================================== */
function RulebookScreen({ onBack }) {
  const [tab,setTab]=useState("rules");
  const [tooltip,setTooltip]=useState(null);
  const tabBtn=(id,label)=>(<button onClick={()=>setTab(id)} style={{flex:1,padding:"10px 0",background:tab===id?C.hi:"transparent",border:"none",borderBottom:tab===id?`2px solid ${C.accent}`:"2px solid transparent",color:tab===id?C.text:C.muted,fontFamily:"Nunito",fontWeight:700,fontSize:13,cursor:"pointer"}}>{label}</button>);
  const rule=(title,body)=>(<div style={{marginBottom:14}}><strong style={{color:C.accent,fontSize:13}}>{title}</strong><div style={{fontSize:13,color:C.muted,marginTop:4,lineHeight:1.6}}>{body}</div></div>);
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Nunito, sans-serif",color:C.text,maxWidth:520,margin:"0 auto"}}>
      <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontFamily:"Nunito",fontWeight:700,fontSize:14}}>← Back</button>
        <span style={{fontFamily:"Fredoka One",fontSize:22,color:C.accent}}>📖 Rulebook</span>
      </div>
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`}}>
        {tabBtn("rules","Core Rules")}
        {tabBtn("glossary","Glossary")}
        {tabBtn("emojis","Emoji Index")}
      </div>
      <div style={{padding:"16px 16px 40px"}}>
        {tab==="rules" && (
          <div>
            {rule("Match Setup","Two players. Each starts with 😀 😀 😀 (three Basic emojis). A match lasts 5 rounds.")}
            {rule("Decks","Each player brings a 13-card deck: 8 Commons, 4 Rares, 1 Epic. Commons allow up to 3 copies, Rares up to 2, Epic must be unique.")}
            {rule("Turn Order","Each round: Player 1 acts, then Player 2. Each player takes 5 total turns.")}
            {rule("On Your Turn","1) Choose a card from your hand. 2) Choose which of your 3 slots to replace. 3) Confirm. Any on-play effects resolve immediately.")}
            {rule("The Board","Each player has 3 slots: Left, Middle, Right. A slot always contains exactly one emoji. The Left slot faces the opponent's Left slot (and so on for Mid, Right).")}
            {rule("Conveyor Hand","You have 3 hand slots that shift left at end of your turn. A new card enters on the right. Played cards leave blanks until they cycle off. You may lock one card to hold it while the conveyor moves underneath.")}
            {rule("Passing","You may pass to advance your conveyor without playing a card.")}
            {rule("Round Effects","😵 Dead Face transforms at the start of the next round. 🦴 Bone, 🐦‍⬛ Crow, and 🕯️ Candle add bonuses at round end.")}
            {rule("Scoring","Final score = base points + bonuses gained during rounds. 👑 Lich King flips 💀 to +2 and ☠️ to +4.")}
            {rule("Win Condition","Higher total score wins. Equal score = Draw.")}
          </div>
        )}
        {tab==="glossary" && (
          <div>
            {rule("Basic","😀 Basic. Default emoji. Value 0.")}
            {rule("Person","Any human-face emoji. Currently includes 😀 and 😵.")}
            {rule("Human","Any emoji tagged Human. Currently includes 😀 and 😵.")}
            {rule("Skull States","💀 Skull (-2) cannot be placed directly. ☠️ Crossbones (-4) must replace a 💀.")}
            {rule("Adjacent","Left or right neighbor slot in your army.")}
            {rule("Across","Same lane on the opposing side. Your Left faces opponent's Left, etc.")}
            {rule("Rarity","Common, Rare, Epic. Decks must be 8 Commons, 4 Rares, 1 Epic with duplicate limits by rarity.")}
            {rule("Lock","You may lock one hand slot to hold a card while the conveyor shifts underneath it.")}
          </div>
        )}
        {tab==="emojis" && (
          <div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>Tap ⓘ or any card for full details.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {Object.entries(ED).map(([key,def])=>(
                <div key={key} onClick={()=>setTooltip(key)} style={{...card({cursor:"pointer"})}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:26}}>{def.e}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,color:C.text}}>{def.n}</div>
                      <div style={{fontSize:12,color:C.accent,fontWeight:700}}>
                        {def.bp} pt{def.bp!==1?"s":""}
                        {def.play && def.rarity && <span style={{color:RARITY_COLORS[def.rarity] || C.muted, fontSize:10, marginLeft:6, textTransform:"uppercase"}}>{def.rarity}</span>}
                        {!def.play&&<span style={{color:C.muted,fontSize:10, marginLeft:6}}>{def.tags.includes("basic")?"(starter)":"(generated)"}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.4}}>{def.rt||def.rules.slice(0,60)}{def.rules.length>60?"…":""}</div>
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

/* ===========================================================
   SETTINGS SCREEN
=========================================================== */
function SettingsScreen({ onBack, onSignOut, onSignIn, user }) {
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Nunito, sans-serif",color:C.text,maxWidth:520,margin:"0 auto"}}>
      <div style={{background:C.surf,borderBottom:`1px solid ${C.border}`,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontFamily:"Nunito",fontWeight:700,fontSize:14}}>← Back</button>
        <span style={{fontFamily:"Fredoka One",fontSize:22,color:C.accent}}>⚙️ Settings</span>
      </div>
      <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
        {[["🔊 Sound","On/Off (coming soon)"],["🎞️ Animations","On/Off (coming soon)"],["♿ Reduced Motion","Coming soon"],["🔠 Emoji Name Labels","Always shown on hover (default on)"],["📖 Rules / Help","See Rulebook tab"],].map(([title,desc])=>(
          <div key={title} style={{...card(),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>{title}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{desc}</div>
            </div>
          </div>
        ))}
        <div style={{...card({marginTop:10}),textAlign:"center",color:C.muted,fontSize:13}}>
          <strong style={{color:C.text}}>Emoji Battle! v{APP_VERSION}</strong><br/>
          Build {BUILD_DATE} • {PIDS.length} playable emojis<br/>
          Firebase sync is enabled for multiplayer lobbies.
        </div>
        <div style={{...card(),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:700,fontSize:14}}>Account</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>
              {user ? "Signed in for multiplayer sync." : "Sign in to use multiplayer lobbies."}
            </div>
          </div>
          {user ? (
            <Btn onClick={onSignOut} sm>Sign out</Btn>
          ) : (
            <Btn onClick={onSignIn} sm>Sign in</Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function SignInPrompt({ onBack, onSignIn, title, description }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"Nunito, sans-serif" }}>
      <div style={{ maxWidth:360, width:"100%", textAlign:"center" }}>
        <div style={{ fontSize:52, marginBottom:10 }}>🌐</div>
        <div style={{ fontFamily:"Fredoka One", fontSize:28, color:C.accent, marginBottom:6 }}>{title}</div>
        <p style={{ color:C.muted, marginTop:0, marginBottom:16 }}>{description}</p>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <Btn onClick={onSignIn}>Sign in with Google</Btn>
          <Btn onClick={onBack} outline color={C.muted}>Back</Btn>
        </div>
      </div>
    </div>
  );
}

/* ===========================================================
   DECK SCREENS
=========================================================== */
function DecksScreen({ decks, onBack, onEdit }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, maxWidth:520, margin:"0 auto" }}>
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontFamily:"Nunito", fontWeight:700, fontSize:14 }}>← Back</button>
        <span style={{ fontFamily:"Fredoka One", fontSize:22, color:C.accent }}>🧰 Decks</span>
      </div>
      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Deck Rules</div>
          <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>
            13 cards total: 8 Commons, 4 Rares, 1 Epic. Commons allow up to 3 copies, Rares up to 2, Epic must be unique.
          </div>
        </div>
        {decks.map((deck) => {
          const counts = countByRarity(deck.cards);
          return (
            <div key={deck.id} style={{ ...card(), display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16 }}>{deck.icon} {deck.name}</div>
                <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                  {counts.common} Common · {counts.rare} Rare · {counts.epic} Epic
                </div>
              </div>
              <Btn onClick={() => onEdit(deck.id)} sm>Edit</Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeckEditorScreen({ deck, onBack, onSave }) {
  const [name, setName] = useState(deck.name);
  const [icon, setIcon] = useState(deck.icon);
  const [cards, setCards] = useState([...deck.cards]);

  useEffect(() => {
    setName(deck.name);
    setIcon(deck.icon);
    setCards([...deck.cards]);
  }, [deck.id]);

  const counts = countByRarity(cards);
  const valid = isDeckValid(cards);

  const addCard = (eid) => {
    const rarity = deckRarity(eid);
    const dupLimit = RARITY_LIMITS[rarity].dup;
    if (cards.length >= DECK_SIZE) return;
    if (counts[rarity] >= RARITY_LIMITS[rarity].count) return;
    if (countCardCopies(cards, eid) >= dupLimit) return;
    setCards([...cards, eid]);
  };

  const removeCard = (eid) => {
    const idx = cards.lastIndexOf(eid);
    if (idx === -1) return;
    const next = [...cards];
    next.splice(idx, 1);
    setCards(next);
  };

  const deckCounts = useMemo(() => {
    const map = new Map();
    cards.forEach((eid) => map.set(eid, (map.get(eid) || 0) + 1));
    return [...map.entries()].sort((a,b)=>RARITY_ORDER.indexOf(deckRarity(a[0]))-RARITY_ORDER.indexOf(deckRarity(b[0])));
  }, [cards]);

  const iconChoices = useMemo(() => ["grin","skull",...PIDS].filter((v,i,arr)=>arr.indexOf(v)===i), []);

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, maxWidth:600, margin:"0 auto" }}>
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontFamily:"Nunito", fontWeight:700, fontSize:14 }}>← Back</button>
        <span style={{ fontFamily:"Fredoka One", fontSize:22, color:C.accent }}>Edit Deck</span>
      </div>
      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Deck Identity</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <input value={name} onChange={(e)=>setName(e.target.value)} maxLength={20} style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", color:C.text, fontSize:14, fontFamily:"Nunito", fontWeight:700 }} />
            <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:1 }}>Deck Icon</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {iconChoices.map((eid)=>(
                <button key={eid} onClick={()=>setIcon(ED[eid].e)} style={{ width:40, height:40, borderRadius:10, background:icon===ED[eid].e?C.accent:C.hi, border:`1px solid ${C.border}`, cursor:"pointer", fontSize:20 }}>
                  {ED[eid].e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Deck Counts</div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", fontSize:12, color:C.muted }}>
            <div style={{ color:RARITY_COLORS.common }}>Common: {counts.common}/{RARITY_LIMITS.common.count}</div>
            <div style={{ color:RARITY_COLORS.rare }}>Rare: {counts.rare}/{RARITY_LIMITS.rare.count}</div>
            <div style={{ color:RARITY_COLORS.epic }}>Epic: {counts.epic}/{RARITY_LIMITS.epic.count}</div>
            <div>Total: {cards.length}/{DECK_SIZE}</div>
          </div>
          {!valid && <div style={{ marginTop:8, fontSize:12, color:C.err }}>Deck must be exactly 8 Common, 4 Rare, 1 Epic.</div>}
        </div>

        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:10 }}>Current Deck</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {deckCounts.length === 0 && <div style={{ fontSize:12, color:C.muted }}>No cards yet.</div>}
            {deckCounts.map(([eid,count]) => {
              const def = ED[eid];
              return (
                <div key={eid} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 10px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:20 }}>{def.e}</span>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700 }}>{def.n}</div>
                      <div style={{ fontSize:10, color:RARITY_COLORS[def.rarity] || C.muted, textTransform:"uppercase" }}>{def.rarity}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:12, color:C.muted }}>x{count}</div>
                    <Btn onClick={()=>removeCard(eid)} outline color={C.err} sm>Remove</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:10 }}>Card Pool</div>
          {RARITY_ORDER.map((rarity)=>(
            <div key={rarity} style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:RARITY_COLORS[rarity], fontWeight:800, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{rarity}</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(120px, 1fr))", gap:8 }}>
                {PIDS.filter((eid)=>deckRarity(eid)===rarity).map((eid)=> {
                  const def = ED[eid];
                  const copies = countCardCopies(cards, eid);
                  const dupLimit = RARITY_LIMITS[rarity].dup;
                  const canAdd = copies < dupLimit && counts[rarity] < RARITY_LIMITS[rarity].count && cards.length < DECK_SIZE;
                  return (
                    <div key={eid} style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 8px", textAlign:"center" }}>
                      <div style={{ fontSize:22 }}>{def.e}</div>
                      <div style={{ fontSize:10, fontWeight:700 }}>{def.n}</div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>x{copies}/{dupLimit}</div>
                      <Btn onClick={()=>addCard(eid)} disabled={!canAdd} sm style={{ marginTop:6, width:"100%" }}>Add</Btn>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={onBack} outline color={C.muted} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={()=>onSave({ ...deck, name: name.trim() || deck.name, icon, cards })} disabled={!valid} style={{ flex:1 }}>Save Deck</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MULTIPLAYER HUB
═══════════════════════════════════════════════════════════════════════ */
function MultiplayerHub({ onBack, onCreate, onJoin, code, onCodeChange, error, lobbies, onOpenLobby, decks, selectedDeckId, onSelectDeckId }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, maxWidth:520, margin:"0 auto" }}>
      <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontFamily:"Nunito", fontWeight:700, fontSize:14 }}>← Back</button>
        <span style={{ fontFamily:"Fredoka One", fontSize:22, color:C.accent }}>🌐 Multiplayer</span>
      </div>
      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ ...card() }}>
          <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>My Deck</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>Select which deck to bring into multiplayer lobbies.</div>
          <select value={selectedDeckId} onChange={(e)=>onSelectDeckId(e.target.value)} style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", color:C.text, fontSize:14, fontFamily:"Nunito", fontWeight:700, width:"100%" }}>
            {decks.map((d)=>(
              <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
            ))}
          </select>
        </div>
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

/* ===========================================================
   ROOT APP
=========================================================== */
export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [screen, setScreen] = useState("menu");
  const [gs, setGs] = useState(null);
  const [passTo, setPassTo] = useState(null);
  const [decks, setDecks] = useState(DEFAULT_DECKS);
  const [selectedDeckId, setSelectedDeckId] = useState(DEFAULT_DECKS[0].id);
  const [editingDeckId, setEditingDeckId] = useState(null);
  const [bot, setBot] = useState(null);

  const [mpCodeInput, setMpCodeInput] = useState("");
  const [mpError, setMpError] = useState("");
  const [activeLobbyCode, setActiveLobbyCode] = useState(null);
  const [activeLobby, setActiveLobby] = useState(null);
  const [spectatorMode, setSpectatorMode] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [hostLobbies, setHostLobbies] = useState([]);
  const [guestLobbies, setGuestLobbies] = useState([]);
  const deckSyncRef = useRef("");

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
      const loaded = loadDecks();
      const nextSelected = loaded.selectedDeckId || loaded.decks[0]?.id || DEFAULT_DECKS[0].id;
      setDecks(loaded.decks);
      setSelectedDeckId(nextSelected);
      deckSyncRef.current = serializeDecks(loaded.decks, nextSelected);
      return;
    }
    const appRef = doc(db, "users", user.uid, "apps", "emoji-battle");
    return onSnapshot(appRef, (snap) => {
      if (!snap.exists()) {
        const fallback = loadDecks(user.uid);
        const nextSelected = fallback.selectedDeckId || fallback.decks[0]?.id || DEFAULT_DECKS[0].id;
        setDecks(fallback.decks);
        setSelectedDeckId(nextSelected);
        deckSyncRef.current = serializeDecks(fallback.decks, nextSelected);
        setDoc(appRef, { decks: fallback.decks, selectedDeckId: nextSelected, updatedAt: serverTimestamp() }, { merge: true })
          .catch(() => undefined);
        return;
      }
      const data = snap.data() || {};
      const storedDecks = Array.isArray(data.decks) ? data.decks : null;
      const normalized = storedDecks ? storedDecks.map(normalizeDeck) : null;
      if (!normalized || normalized.some((d) => !d)) {
        const fallback = loadDecks(user.uid);
        const nextSelected = fallback.selectedDeckId || fallback.decks[0]?.id || DEFAULT_DECKS[0].id;
        setDecks(fallback.decks);
        setSelectedDeckId(nextSelected);
        deckSyncRef.current = serializeDecks(fallback.decks, nextSelected);
        return;
      }
      const selected = normalized.find((d) => d.id === data.selectedDeckId) ? data.selectedDeckId : normalized[0].id;
      setDecks(normalized);
      setSelectedDeckId(selected);
      deckSyncRef.current = serializeDecks(normalized, selected);
    });
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady) return;
    const payload = serializeDecks(decks, selectedDeckId);
    if (payload === deckSyncRef.current) return;
    deckSyncRef.current = payload;
    if (!user) {
      saveDecks(decks, selectedDeckId, null);
      return;
    }
    const appRef = doc(db, "users", user.uid, "apps", "emoji-battle");
    setDoc(appRef, { decks, selectedDeckId, updatedAt: serverTimestamp() }, { merge: true }).catch(() => undefined);
    saveDecks(decks, selectedDeckId, user.uid);
  }, [authReady, user, decks, selectedDeckId]);

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

  const applyNextState = (next) => {
    setGs(next);
    if (next.phase === "ended") {
      setPassTo(null);
      setScreen("results");
      return;
    }
    if (next.phase === "ec") {
      setPassTo(null);
      return;
    }
    if (bot) {
      setPassTo(null);
      return;
    }
    setPassTo(next.players[getAP(next)].name);
  };

  function startGame(p1, p2, p1DeckId, p2DeckId, botEnabled = false, botDifficulty = "medium") {
    const d1 = getDeckById(decks, p1DeckId);
    const d2 = getDeckById(decks, p2DeckId);
    const botConfig = botEnabled ? { pid: 1, difficulty: botDifficulty } : null;
    const g = initGame(p1, botEnabled ? getBotName(botDifficulty) : p2, d1, d2);
    setBot(botConfig);
    setGs(g);
    setPassTo(null);
    setScreen("game");
  }

  function handleMove(handIndex, si) {
    const next = applyMove(gs, handIndex, si);
    applyNextState(next);
  }

  function handleSick(tsi) {
    const next = applySick(gs, tsi);
    applyNextState(next);
  }

  function handlePass() {
    const next = applyPass(gs);
    applyNextState(next);
  }

  function handleLock(handIndex) {
    const next = applyLock(gs, handIndex);
    setGs(next);
  }

  function handleRematch() {
    const g = initGame(gs.players[0].name, gs.players[1].name, gs.decks?.[0], gs.decks?.[1]);
    setGs(g);
    setPassTo(null);
    setScreen("game");
  }

  useEffect(() => {
    if (!bot || !gs) return;
    if (screen !== "game") return;
    if (gs.phase === "ended") return;
    const activePid = getAP(gs);
    if (activePid !== bot.pid) return;
    if (gs.phase === "ec" && gs.pend?.pid !== bot.pid) return;
    const timer = setTimeout(() => {
      const action = chooseBotAction(gs, bot.pid, bot.difficulty, {
        applyMove,
        applyPass,
        applySick,
        getHandOffers,
        calcScores,
        getAP,
        turnLimit: TURN_LIMIT
      });
      if (!action) return;
      let next = null;
      if (action.type === "move") next = applyMove(gs, action.handIndex, action.slotIndex);
      if (action.type === "pass") next = applyPass(gs);
      if (action.type === "sick") next = applySick(gs, action.targetIndex);
      if (next) applyNextState(next);
    }, 350);
    return () => clearTimeout(timer);
  }, [bot, gs, screen]);

  const handleCreateLobby = async () => {
    setMpError("");
    if (!user) {
      setMpError("Sign in to create a multiplayer lobby.");
      return;
    }
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
        hostDeck: null,
        guest: null,
        guestDeck: null,
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
    if (!user) {
      setMpError("Sign in to join a multiplayer lobby.");
      return;
    }
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
    const name = getPlayerName(user);
    try {
      const data = snap.data();
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
          status: "ready",
          updatedAt: serverTimestamp()
        });
      }
      setActiveLobbyCode(code);
      setScreen("mp-lobby");
    } catch (err) {
      const code = err?.code || "";
      const msg = err?.message || "";
      if (code === "permission-denied") {
        setMpError("Join blocked by Firestore rules. Check rules and try again.");
      } else if (msg.includes("lobby-full")) {
        setMpError("Lobby already has two players.");
      } else if (msg.includes("lobby-not-found")) {
        setMpError("Lobby not found.");
      } else {
        setMpError(`Unable to join lobby (${code || msg || "unknown"}). Try again.`);
      }
    }
  };

  const handleClaimSeat = async () => {
    setMpError("");
    if (!user || !activeLobby) return;
    if (activeLobby.host?.uid === user.uid) return;
    if (activeLobby.guest?.uid) return;
    const name = getPlayerName(user);
    try {
      await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
        guest: { uid: user.uid, name },
        status: "ready",
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      const code = err?.code || "";
      const msg = err?.message || "";
      if (code === "permission-denied") {
        setMpError("Join blocked by Firestore rules. Check rules and try again.");
      } else if (msg.includes("lobby-full")) {
        setMpError("Lobby already has two players.");
      } else if (msg.includes("lobby-not-found")) {
        setMpError("Lobby not found.");
      } else {
        setMpError(`Unable to join lobby (${code || msg || "unknown"}). Try again.`);
      }
    }
  };

  const handleCloseLobby = async () => {
    if (!activeLobbyCode) return;
    await deleteDoc(doc(db, LOBBY_COLLECTION, activeLobbyCode));
    setActiveLobbyCode(null);
    setScreen("mp-hub");
  };

  const handleUpdateLobbyDeck = async (deckId) => {
    if (!activeLobby || !user) return;
    if (!deckId) return;
    const deck = getDeckById(decks, deckId) || DEFAULT_DECKS[0];
    setSelectedDeckId(deckId);
    const isHost = activeLobby.host?.uid === user.uid;
    const isGuest = activeLobby.guest?.uid === user.uid;
    if (!isHost && !isGuest) return;
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      ...(isHost ? { hostDeck: deck } : { guestDeck: deck }),
      updatedAt: serverTimestamp()
    });
  };

  const handleLeaveLobby = () => {
    setActiveLobbyCode(null);
    setSpectatorMode(false);
    setChatInput("");
    setMpError("");
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

  const handleMpMove = async (handIndex, si) => {
    if (!isMyTurn) return;
    if (!activeLobby?.gameState) return;
    const base = decodeGameState(activeLobby.gameState);
    const next = applyMove(base, handIndex, si);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: encodeGameState(next),
      status: next.phase === "ended" ? "ended" : "playing",
      updatedAt: serverTimestamp()
    });
  };

  const handleMpSick = async (tsi) => {
    if (!showSick) return;
    if (!activeLobby?.gameState) return;
    const base = decodeGameState(activeLobby.gameState);
    const next = applySick(base, tsi);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: encodeGameState(next),
      status: next.phase === "ended" ? "ended" : "playing",
      updatedAt: serverTimestamp()
    });
  };

  const handleMpPass = async () => {
    if (!isMyTurn) return;
    if (!activeLobby?.gameState) return;
    const base = decodeGameState(activeLobby.gameState);
    const next = applyPass(base);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: encodeGameState(next),
      status: next.phase === "ended" ? "ended" : "playing",
      updatedAt: serverTimestamp()
    });
  };

  const handleMpLock = async (handIndex) => {
    if (!isMyTurn) return;
    if (!activeLobby?.gameState) return;
    const base = decodeGameState(activeLobby.gameState);
    const next = applyLock(base, handIndex);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: encodeGameState(next),
      updatedAt: serverTimestamp()
    });
  };

  const handleStartLobbyMatch = async () => {
    if (!activeLobby || !user) return;
    if (activeLobby.host?.uid !== user.uid) return;
    if (!activeLobby.guest?.uid) return;
    const hostName = activeLobby.host?.name || "Player 1";
    const guestName = activeLobby.guest?.name || "Player 2";
    const hostDeck = activeLobby.hostDeck || DEFAULT_DECKS[0];
    const guestDeck = activeLobby.guestDeck || DEFAULT_DECKS[0];
    if (!activeLobby.hostDeck) {
      setMpError("Pick your deck first.");
      return;
    }
    if (!activeLobby.guestDeck) {
      setMpError("Guest needs to pick a deck first.");
      return;
    }
    const next = initGame(hostName, guestName, hostDeck, guestDeck);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: encodeGameState(next),
      status: "playing",
      updatedAt: serverTimestamp()
    });
  };

  const handleMpRematch = async () => {
    if (!activeLobby) return;
    const hostName = activeLobby.host?.name || "Player 1";
    const guestName = activeLobby.guest?.name || "Player 2";
    const decoded = decodeGameState(activeLobby.gameState);
    const deck1 = decoded?.decks?.[0] || DEFAULT_DECKS[0];
    const deck2 = decoded?.decks?.[1] || DEFAULT_DECKS[0];
    const next = initGame(hostName, guestName, deck1, deck2);
    await updateDoc(doc(db, LOBBY_COLLECTION, activeLobby.id), {
      gameState: encodeGameState(next),
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
  const gameState = activeLobby?.gameState ? decodeGameState(activeLobby.gameState) : null;
  const activePlayerIndex = gameState ? getAP(gameState) : null;
  const waitingForName = gameState ? gameState.players?.[activePlayerIndex]?.name : activeLobby?.guest?.name;
  const isMyTurn = gameState && isMember
    ? gameState.phase === "ec"
      ? gameState.pend?.pid === myIndex
      : activePlayerIndex === myIndex
    : false;
  const showSick = gameState && gameState.phase === "ec" && gameState.pend?.pid === myIndex;
  const editingDeck = editingDeckId ? decks.find((d)=>d.id===editingDeckId) : null;
  const lobbyDeckId = isMember
    ? myIndex === 0
      ? activeLobby?.hostDeck?.id
      : activeLobby?.guestDeck?.id
    : null;
  const lobbyDeckValue = lobbyDeckId && decks.find((d) => d.id === lobbyDeckId) ? lobbyDeckId : "";
  const isBotTurn = Boolean(bot && gs && screen === "game" && getAP(gs) === bot.pid);
  const botDisplayName = bot ? getBotName(bot.difficulty) : null;

  if (!authReady) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", color:C.text, fontFamily:"Nunito, sans-serif" }}>
        Loading…
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
            onDecks={() => { setEditingDeckId(null); setScreen("decks"); }}
          />
        )}
        {screen === "setup" && <SetupScreen onBack={() => setScreen("menu")} onStart={startGame} decks={decks} defaultDeckId={selectedDeckId} />}
        {screen === "game" && gs && (
          <>
            {gs.phase === "ec" && (!bot || gs.pend?.pid !== bot.pid) && <SickModal gs={gs} onChoose={handleSick} />}
            <GameScreen
              gs={gs}
              onMove={handleMove}
              onSick={handleSick}
              onPass={handlePass}
              onLock={handleLock}
              onEndGame={() => setScreen("menu")}
              readOnly={isBotTurn}
              waitingFor={isBotTurn ? botDisplayName : undefined}
            />
          </>
        )}
        {screen === "results" && gs && <ResultsScreen gs={gs} onRematch={handleRematch} onMenu={() => setScreen("menu")} />}
        {screen === "rulebook" && <RulebookScreen onBack={() => setScreen("menu")} />}
        {screen === "settings" && (
          <SettingsScreen
            onBack={() => setScreen("menu")}
            onSignOut={() => signOut(auth).catch(() => undefined)}
            onSignIn={() => signInWithPopup(auth, provider).catch(() => undefined)}
            user={user}
          />
        )}
        {screen === "decks" && (
          <DecksScreen
            decks={decks}
            onBack={() => setScreen("menu")}
            onEdit={(id) => { setEditingDeckId(id); setScreen("deck-edit"); }}
          />
        )}
        {screen === "deck-edit" && editingDeck && (
          <DeckEditorScreen
            deck={editingDeck}
            onBack={() => setScreen("decks")}
            onSave={(nextDeck) => {
              setDecks((prev) => prev.map((d) => d.id === nextDeck.id ? nextDeck : d));
              setScreen("decks");
            }}
          />
        )}
        {screen === "mp-hub" && (
          user ? (
            <MultiplayerHub
              onBack={() => setScreen("menu")}
              onCreate={handleCreateLobby}
              onJoin={handleJoinLobby}
              code={mpCodeInput}
              onCodeChange={setMpCodeInput}
              error={mpError}
              lobbies={myLobbies}
              onOpenLobby={(code) => { setActiveLobbyCode(code); setScreen("mp-lobby"); }}
              decks={decks}
              selectedDeckId={selectedDeckId}
              onSelectDeckId={setSelectedDeckId}
            />
          ) : (
            <SignInPrompt
              onBack={() => setScreen("menu")}
              onSignIn={() => signInWithPopup(auth, provider).catch(() => undefined)}
              title="Multiplayer"
              description="Sign in with Google to create or join multiplayer lobbies. Single-player works without sign in."
            />
          )
        )}
        {screen === "mp-lobby" && (
          user ? (
            <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"Nunito, sans-serif", color:C.text, maxWidth:520, margin:"0 auto" }}>
              <div style={{ background:C.surf, borderBottom:`1px solid ${C.border}`, padding:"14px 16px", display:"flex", alignItems:"center", gap:14, justifyContent:"space-between" }}>
                <button onClick={handleLeaveLobby} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontFamily:"Nunito", fontWeight:700, fontSize:14 }}>← Back</button>
                <span style={{ fontFamily:"Fredoka One", fontSize:20, color:C.accent }}>🌐 Lobby</span>
                <span style={{ fontSize:11, color:isSpectating?C.accent2:C.muted, textTransform:"uppercase", letterSpacing:1 }}>
                  {isSpectating ? "Spectating" : isMember ? "Player" : ""}
                </span>
                <span style={{ fontSize:12, color:C.muted }}>{activeLobbyCode || ""}</span>
              </div>
              {mpError && (
                <div style={{ padding:"10px 16px", color:C.err, fontSize:12 }}>{mpError}</div>
              )}

            {!activeLobby && (
              <div style={{ padding:24, color:C.muted }}>Lobby not found.</div>
            )}

            {activeLobby && isMember && !activeLobby.gameState && (
              <div style={{ padding:20 }}>
                <div style={{ ...card() }}>
                  <div style={{ fontWeight:800, fontSize:13, marginBottom:8 }}>Your Deck</div>
                  <select
                    value={lobbyDeckValue}
                    onChange={(e) => handleUpdateLobbyDeck(e.target.value)}
                    style={{ background:C.hi, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", color:C.text, fontSize:14, fontFamily:"Nunito", fontWeight:700, width:"100%" }}
                  >
                    <option value="" disabled>Select a deck</option>
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                    ))}
                  </select>
                  <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>Choose your deck before the host starts.</div>
                </div>
              </div>
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

            {activeLobby && activeLobby.host?.uid === user.uid && !activeLobby.guest?.uid && !activeLobby.gameState && (
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

            {activeLobby && activeLobby.host?.uid === user.uid && activeLobby.guest?.uid && !activeLobby.gameState && (
              <div style={{ padding:20, display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ ...card() }}>
                  <div style={{ fontWeight:800, fontSize:14, marginBottom:6 }}>Opponent joined</div>
                  <div style={{ fontSize:12, color:C.muted }}>Guest: {activeLobby.guest?.name || "Player 2"}</div>
                </div>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  <Btn onClick={handleStartLobbyMatch} sm>Start Match</Btn>
                  <Btn onClick={handleCloseLobby} outline color={C.err} sm>Close Lobby</Btn>
                </div>
              </div>
            )}

            {activeLobby && activeLobby.guest?.uid === user.uid && !activeLobby.gameState && (
              <div style={{ padding:20, color:C.muted }}>Waiting for host to start...</div>
            )}

            {activeLobby && activeLobby.gameState && (isMember || isSpectating) && (
              <>
                {showSick && <SickModal gs={activeLobby.gameState} onChoose={handleMpSick} />}
                {gameState.phase === "ended" ? (
                  <ResultsScreen gs={gameState} onRematch={handleMpRematch} onMenu={handleLeaveLobby} />
                ) : (
                  <GameScreen
                    gs={gameState}
                    onMove={handleMpMove}
                    onSick={handleMpSick}
                    onPass={handleMpPass}
                    onLock={handleMpLock}
                    onEndGame={handleLeaveLobby}
                    readOnly={!isMyTurn}
                    waitingFor={waitingForName}
                    viewerPid={isMember ? myIndex : undefined}
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
          ) : (
            <SignInPrompt
              onBack={() => setScreen("menu")}
              onSignIn={() => signInWithPopup(auth, provider).catch(() => undefined)}
              title="Multiplayer Lobby"
              description="Sign in to join this lobby and play."
            />
          )
        )}
      </div>
    </>
  );
}




