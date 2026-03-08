export const BOT_LEVELS = [
  { id: "easy", name: "Easy", label: "Easy (1-turn lookahead)", depth: 1 },
  { id: "medium", name: "Medium", label: "Medium (3-turn lookahead)", depth: 3 },
  { id: "hard", name: "Hard", label: "Hard (5-turn lookahead)", depth: 5 }
];

export const getBotName = (difficulty) => {
  const level = BOT_LEVELS.find((l) => l.id === difficulty) || BOT_LEVELS[0];
  return `Bot (${level.name})`;
};

const getDepth = (difficulty, gs, turnLimit) => {
  const level = BOT_LEVELS.find((l) => l.id === difficulty) || BOT_LEVELS[0];
  if (typeof turnLimit === "number") {
    const remaining = Math.max(1, turnLimit - (gs?.ct || 0));
    return Math.min(level.depth, remaining);
  }
  return level.depth;
};

const evaluate = (gs, botPid, rules) => {
  const scores = rules.calcScores(gs.as, gs.lichActive);
  const mine = scores[botPid]?.total ?? 0;
  const opp = scores[1 - botPid]?.total ?? 0;
  return mine - opp;
};

const listActions = (gs, rules) => {
  if (!gs) return [];
  const pid = rules.getAP(gs);
  if (gs.phase === "ec" && gs.pend?.pid === pid) {
    if (gs.pend.type === "dagger") {
      return [0, 1, 2]
        .filter((i) => i !== gs.pend.si)
        .map((targetIndex) => ({ type: "sick", targetIndex }));
    }
    if (gs.pend.type === "trick") {
      return [0, 1, 2].map((targetIndex) => ({ type: "sick", targetIndex }));
    }
    return [];
  }

  if (gs.phase !== "sel") return [];
  const offers = rules.getHandOffers(gs);
  const actions = [];
  offers.forEach((offer, handIndex) => {
    if (!offer?.ok) return;
    offer.validSlots.forEach((slotIndex) => {
      actions.push({ type: "move", handIndex, slotIndex });
    });
  });
  actions.push({ type: "pass" });
  return actions;
};

const applyAction = (gs, action, rules) => {
  if (!action) return gs;
  if (action.type === "move") return rules.applyMove(gs, action.handIndex, action.slotIndex);
  if (action.type === "pass") return rules.applyPass(gs);
  if (action.type === "sick") return rules.applySick(gs, action.targetIndex);
  return gs;
};

const search = (gs, depth, botPid, rules, alpha, beta) => {
  if (!gs || depth <= 0 || gs.phase === "ended") {
    return { score: evaluate(gs, botPid, rules), action: null };
  }
  const pid = rules.getAP(gs);
  const actions = listActions(gs, rules);
  if (actions.length === 0) {
    return { score: evaluate(gs, botPid, rules), action: null };
  }

  if (pid === botPid) {
    let bestScore = -Infinity;
    let bestAction = actions[0];
    for (const action of actions) {
      const next = applyAction(gs, action, rules);
      const result = search(next, depth - 1, botPid, rules, alpha, beta);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestAction = action;
      }
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break;
    }
    return { score: bestScore, action: bestAction };
  }

  let bestScore = Infinity;
  let bestAction = actions[0];
  for (const action of actions) {
    const next = applyAction(gs, action, rules);
    const result = search(next, depth - 1, botPid, rules, alpha, beta);
    if (result.score < bestScore) {
      bestScore = result.score;
      bestAction = action;
    }
    beta = Math.min(beta, bestScore);
    if (beta <= alpha) break;
  }
  return { score: bestScore, action: bestAction };
};

export const chooseBotAction = (gs, botPid, difficulty, rules) => {
  const depth = getDepth(difficulty, gs, rules.turnLimit);
  const actions = listActions(gs, rules);
  if (actions.length === 0) return null;
  const result = search(gs, depth, botPid, rules, -Infinity, Infinity);
  return result.action || actions[0];
};
