/* ===========================================================
   EMOJI DEFINITIONS
   Edit this file to add / tweak emojis without touching App.jsx
=========================================================== */
export const ED = {
  grin:        { e:"😀", n:"Basic",      bp:0,  tags:["basic","person"],                 play:false, rarity:null, req:null, rt:null, rules:"Default emoji. Value 0.", onp:null },
  skull:       { e:"💀", n:"Skull",      bp:-2, tags:["skull"],                          play:false, rarity:null, req:null, rt:null, rules:"Cannot be placed directly.", onp:null },
  dagger:      { e:"🗡️", n:"Dagger",     bp:0,  tags:["weapon"],                         play:true,  rarity:"common", req:null, rt:null, rules:"On Play: Transform one friendly emoji into 💀. Cannot target itself.", onp:"dagger" },
  dead_face:   { e:"😵", n:"Dead Face",  bp:0,  tags:["person","dead"],                  play:true,  rarity:"common", req:"replace_person", rt:"Req: Must replace a Person.", rules:"Becomes 💀 at the start of the next round.", onp:null },
  bone:        { e:"🦴", n:"Bone",       bp:0,  tags:["bone"],                           play:true,  rarity:"common", req:null, rt:null, rules:"Gain +1 each round for each 💀 or ☠️ on the board.", onp:null },
  crossbones:  { e:"☠️", n:"Crossbones", bp:-4, tags:["crossbones"],                     play:true,  rarity:"rare",   req:"replace_skull", rt:"Req: Must replace a 💀.", rules:"Deep corruption state.", onp:null },
  plague:      { e:"☣️", n:"Plague",     bp:1,  tags:["plague"],                         play:true,  rarity:"common", req:"adjacent_skull", rt:"Req: Must be placed next to a 💀.", rules:"On Play: Turn the emoji across from this into 😵.", onp:"plague" },
  poison:      { e:"⚗️", n:"Poison",     bp:0,  tags:["poison"],                         play:true,  rarity:"common", req:"across_any", rt:"Req: Must be played across from an emoji.", rules:"If the emoji across from this changes, it becomes 💀 instead. Then ⚗️ becomes 😀.", onp:null },
  coffin:      { e:"⚰️", n:"Coffin",     bp:0,  tags:["coffin"],                         play:true,  rarity:"rare",   req:"replace_skull_or_crossbones", rt:"Req: Must replace a 💀 or ☠️.", rules:"Scores +2 if it replaces 💀, +4 if it replaces ☠️.", onp:null },
  crow:        { e:"🐦‍⬛", n:"Crow",      bp:1,  tags:["crow"],                           play:true,  rarity:"common", req:null, rt:null, rules:"Gain +1 each round for each 💀 in the opponent's army.", onp:null },
  lich:        { e:"👑", n:"Lich King",  bp:0,  tags:["lich"],                           play:true,  rarity:"epic",   req:null, rt:null, rules:"On Play: All 💀 become +2 and all ☠️ become +4 for both players.", onp:"lich" },
  mutation:    { e:"🧬", n:"Mutation",   bp:0,  tags:["mutation"],                       play:true,  rarity:"rare",   req:null, rt:null, rules:"All 😵 become ☠️ instead of 💀.", onp:null },
  candle:      { e:"🕯️", n:"Candle",     bp:1,  tags:["candle"],                         play:true,  rarity:"common", req:null, rt:null, rules:"If a 💀 or ☠️ is created this round, gain +2.", onp:null },
  dark_sigil:  { e:"🪬", n:"Dark Sigil", bp:5,  tags:["sigil"],                          play:true,  rarity:"rare",   req:"opp_two_skulls", rt:"Req: Opponent has ≥2 💀.", rules:"Large anti-skull payoff.", onp:null },
  graveyard:   { e:"🪦", n:"Graveyard",  bp:2,  tags:["graveyard"],                      play:true,  rarity:"common", req:null, rt:null, rules:"All 💀 become ☠️ instead.", onp:"graveyard" },
};

export const PIDS = Object.entries(ED).filter(([,v])=>v.play).map(([k])=>k);

export const DEFAULT_DECK_CARDS = [
  "dagger","dead_face","bone","plague","poison","crow","candle","graveyard",
  "crossbones","coffin","mutation","dark_sigil",
  "lich"
];

export const DEFAULT_DECKS = [
  { id:"deck1", name:"Starter", icon:"💀", cards:[...DEFAULT_DECK_CARDS] },
  { id:"deck2", name:"Corruption", icon:"🪦", cards:[...DEFAULT_DECK_CARDS] },
  { id:"deck3", name:"Necro", icon:"🗡️", cards:[...DEFAULT_DECK_CARDS] }
];
