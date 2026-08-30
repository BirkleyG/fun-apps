export const DEFAULT_TEMPLATES = [
  {
    id: "default-standup",
    name: "Daily Standup",
    sections: [
      { id: "yesterday", title: "Yesterday", hint: "yesterday, done, finished, completed, shipped" },
      { id: "today", title: "Today", hint: "today, plan to, going to, will work on, next" },
      { id: "blockers", title: "Blockers", hint: "blocked, blocker, stuck, waiting on, issue, problem" }
    ]
  },
  {
    id: "default-1-1",
    name: "1:1 Meeting",
    sections: [
      { id: "summary", title: "Summary", hint: "" },
      { id: "wins", title: "Wins & Highlights", hint: "great, went well, proud, win, happy, excited" },
      { id: "concerns", title: "Concerns", hint: "worried, concern, frustrated, struggle, difficult" },
      { id: "actions", title: "Action Items", hint: "will, need to, should, follow up, todo, by next" }
    ]
  },
  {
    id: "default-client-call",
    name: "Client Call",
    sections: [
      { id: "summary", title: "Summary", hint: "" },
      { id: "requirements", title: "Requirements & Requests", hint: "need, want, require, expect, looking for" },
      { id: "decisions", title: "Decisions", hint: "decided, agreed, confirmed, approved, sign off" },
      { id: "actions", title: "Action Items", hint: "will, need to, should, follow up, todo, send, by" }
    ]
  },
  {
    id: "default-general",
    name: "General Meeting Notes",
    sections: [
      { id: "summary", title: "Summary", hint: "" },
      { id: "decisions", title: "Decisions", hint: "decided, agreed, confirmed, resolved" },
      { id: "actions", title: "Action Items", hint: "will, need to, should, follow up, todo, assign, by" },
      { id: "notes", title: "Other Notes", hint: "" }
    ]
  }
];

export function createEmptyTemplate() {
  return {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: "New Template",
    sections: [{ id: `s_${Date.now()}`, title: "Summary", hint: "" }]
  };
}

export function createEmptySection() {
  return { id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, title: "New Section", hint: "" };
}
