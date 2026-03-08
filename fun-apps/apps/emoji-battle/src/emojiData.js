/* ===========================================================
   EMOJI DEFINITIONS
   Edit this file to add / tweak emojis without touching App.jsx
=========================================================== */
export const ED = {
  grin:        { e:"😀", n:"Basic",      bp:0,  tags:["basic","person","human"],         play:false, rarity:null, req:null, rt:null, rules:"Default emoji. Value 0.", onp:null },
  skull:       { e:"💀", n:"Skull",      bp:-2, tags:["skull"],                          play:false, rarity:null, req:null, rt:null, rules:"Cannot be placed directly.", onp:null },
  dagger:      { e:"🗡️", n:"Dagger",     bp:0,  tags:["weapon"],                         play:true,  rarity:"common", req:null, rt:null, rules:"On Play: Transform one friendly emoji into 💀. Cannot target itself.", onp:"dagger" },
  dead_face:   { e:"😵", n:"Dead Face",  bp:0,  tags:["person","human","dead"],           play:true,  rarity:"common", req:"replace_person", rt:"Req: Must replace a Person.", rules:"Becomes 💀 at the start of the next round.", onp:null },
  bone:        { e:"🦴", n:"Bone",       bp:0,  tags:["bone"],                           play:true,  rarity:"common", req:null, rt:null, rules:"Gain +1 each round for each 💀 or ☠️ on the board.", onp:null },
  crossbones:  { e:"☠️", n:"Crossbones", bp:-4, tags:["crossbones","skull"],              play:true,  rarity:"rare",   req:"replace_skull", rt:"Req: Must replace a 💀.", rules:"Deep corruption state.", onp:null },
  plague:      { e:"☣️", n:"Plague",     bp:1,  tags:["plague"],                         play:true,  rarity:"common", req:"adjacent_skull", rt:"Req: Must be placed next to a 💀.", rules:"On Play: Turn the emoji across from this into 😵.", onp:"plague" },
  poison:      { e:"⚗️", n:"Poison",     bp:0,  tags:["poison"],                         play:true,  rarity:"common", req:"across_any", rt:"Req: Must be played across from an emoji.", rules:"If the emoji across from this changes, it becomes 💀 instead. Then ⚗️ becomes 😀.", onp:null },
  coffin:      { e:"⚰️", n:"Coffin",     bp:0,  tags:["coffin"],                         play:true,  rarity:"rare",   req:"replace_skull_or_crossbones", rt:"Req: Must replace a 💀 or ☠️.", rules:"Scores +2 if it replaces 💀, +4 if it replaces ☠️.", onp:null },
  crow:        { e:"🐦‍⬛", n:"Crow",      bp:1,  tags:["crow"],                           play:true,  rarity:"common", req:null, rt:null, rules:"Gain +1 each round for each 💀 in the opponent's army.", onp:null },
  lich:        { e:"👑", n:"Lich King",  bp:0,  tags:["lich"],                           play:true,  rarity:"epic",   req:null, rt:null, rules:"On Play: All 💀 become +2 and all ☠️ become +4 for both players.", onp:"lich" },
  mutation:    { e:"🧬", n:"Mutation",   bp:0,  tags:["mutation"],                       play:true,  rarity:"rare",   req:null, rt:null, rules:"All 😵 become ☠️ instead of 💀.", onp:null },
  candle:      { e:"🕯️", n:"Candle",     bp:1,  tags:["candle"],                         play:true,  rarity:"common", req:null, rt:null, rules:"If a 💀 or ☠️ is created this round, gain +2.", onp:null },
  dark_sigil:  { e:"🪬", n:"Dark Sigil", bp:5,  tags:["sigil"],                          play:true,  rarity:"rare",   req:"opp_two_skulls", rt:"Req: Opponent has ≥2 💀.", rules:"Large anti-skull payoff.", onp:null },
  graveyard:   { e:"🪦", n:"Graveyard",  bp:2,  tags:["graveyard"],                      play:true,  rarity:"common", req:null, rt:null, rules:"All 💀 become ☠️ instead.", onp:"graveyard" },
  executioner: { e:"🪓", n:"Executioner", bp:2, tags:["assassin","weapon"],              play:true,  rarity:"rare",   req:"across_any", rt:"Req: Must be played across from an emoji.", rules:"If the emoji across has 4+ points, replace it with 💀.", onp:null },
  duel:        { e:"⚔️", n:"Duel",       bp:2,  tags:["assassin","weapon"],              play:true,  rarity:"common", req:"across_any", rt:"Req: Must be played across from an emoji.", rules:"If opponent's total points are higher than yours, replace the emoji across with 💀.", onp:null },
  infection_strike:{ e:"🦠", n:"Infection Strike", bp:2, tags:["assassin","plague"],     play:true,  rarity:"epic",   req:null, rt:null, rules:"On Play: Turn the emoji across and adjacent emojis on that side into 😵.", onp:null },
  silent_kill: { e:"🔪", n:"Silent Kill", bp:3, tags:["assassin"],                       play:true,  rarity:"rare",   req:null, rt:null, rules:"On Play: Replace all locked emojis on the board with 💀.", onp:null },
  decay:       { e:"🧪", n:"Decay",      bp:1,  tags:["assassin","control"],             play:true,  rarity:"common", req:"across_any", rt:"Req: Must be played across from an emoji.", rules:"End of Round: Reduce the emoji across by 1 point. If it reaches 0, replace it with 💀.", onp:null },
  crown:       { e:"💎", n:"Crown",      bp:5,  tags:["value"],                          play:true,  rarity:"rare",   req:"replace_min_points_2", rt:"Req: Must replace an emoji worth 2+ points.", rules:"High-value upgrade.", onp:null },
  monument:    { e:"🏛️", n:"Monument",   bp:4,  tags:["control","lock"],                 play:true,  rarity:"rare",   req:"replace_locked", rt:"Req: Must replace a locked emoji.", rules:"Becomes permanently locked.", onp:null },
  veteran:     { e:"🎖️", n:"Veteran",    bp:3,  tags:["value","comeback"],              play:true,  rarity:"common", req:"turn_4_or_5", rt:"Req: Can only be played on Turn 4 or 5.", rules:"On Play: Gain +2 if opponent has at least one 💀.", onp:null },
  freeze:      { e:"🧊", n:"Freeze",     bp:2,  tags:["control","lock"],                 play:true,  rarity:"common", req:"across_any", rt:"Req: Must be played across from an emoji.", rules:"On Play: The emoji across cannot be replaced next round.", onp:null },
  pin:         { e:"🧷", n:"Pin",        bp:1,  tags:["control"],                        play:true,  rarity:"common", req:"across_any", rt:"Req: Must be played across from an emoji.", rules:"The emoji across cannot gain points.", onp:null },
  lockdown:    { e:"🔒", n:"Lockdown",   bp:2,  tags:["control","lock"],                 play:true,  rarity:"rare",   req:null, rt:null, rules:"On Play: Lock both emojis in this lane until next round.", onp:null },
  storm:       { e:"🌪️", n:"Storm",      bp:2,  tags:["chaos","global"],                play:true,  rarity:"rare",   req:null, rt:null, rules:"On Play: Swap the left and right lanes for both players.", onp:null },
  pandemic:    { e:"☣️", n:"Pandemic",   bp:3,  tags:["global","corruption"],            play:true,  rarity:"rare",   req:null, rt:null, rules:"On Play: Turn all Human emojis into 💀.", onp:null },
  cataclysm:   { e:"🌋", n:"Cataclysm",  bp:3,  tags:["global","corruption"],            play:true,  rarity:"rare",   req:null, rt:null, rules:"On Play: All emojis worth 1 point or less become 😵.", onp:null },
  purge:       { e:"🔥", n:"Purge",      bp:2,  tags:["global","comeback"],              play:true,  rarity:"epic",   req:"opp_points_gt_10", rt:"Req: Opponent has >10 total points.", rules:"On Play: Set all emojis on the board to 😀.", onp:null },
  carrion_swarm:{ e:"🐦", n:"Carrion Swarm", bp:2, tags:["skull"],                       play:true,  rarity:"common", req:null, rt:null, rules:"On Play: Gain +1 for each 💀 in the opponent's army.", onp:null },
  trick:       { e:"🤡", n:"Trick",      bp:2,  tags:["trick","control"],                play:true,  rarity:"rare",   req:null, rt:null, rules:"On Play: Choose a friendly emoji. Swap it with the emoji across.", onp:null },
};

export const PIDS = Object.entries(ED).filter(([,v])=>v.play).map(([k])=>k);

export const DEFAULT_DECK_CARDS = [];

export const DEFAULT_DECKS = [
  { id:"deck1", name:"Deck 1", icon:"😀", cards:[...DEFAULT_DECK_CARDS] },
  { id:"deck2", name:"Deck 2", icon:"😀", cards:[...DEFAULT_DECK_CARDS] },
  { id:"deck3", name:"Deck 3", icon:"😀", cards:[...DEFAULT_DECK_CARDS] }
];
