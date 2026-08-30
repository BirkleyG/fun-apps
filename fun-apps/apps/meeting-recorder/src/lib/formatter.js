const STOPWORDS = new Set(
  "a an the and or but if then so to of in on for with at by from as is are was were be been being this that it its it's i you he she they we our your their his her them us do does did not no yes just like really okay right um uh well".split(
    " "
  )
);

const ACTION_PATTERN =
  /\b(will|need to|needs to|should|must|going to|let's|lets|action item|todo|follow up|by (monday|tuesday|wednesday|thursday|friday|next week|tomorrow|eod))\b/i;

function splitSentences(text) {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function wordFreq(sentences) {
  const freq = new Map();
  for (const sentence of sentences) {
    for (const raw of sentence.toLowerCase().match(/[a-z0-9']+/g) || []) {
      if (STOPWORDS.has(raw) || raw.length < 3) continue;
      freq.set(raw, (freq.get(raw) || 0) + 1);
    }
  }
  return freq;
}

function scoreSentence(sentence, freq) {
  const words = sentence.toLowerCase().match(/[a-z0-9']+/g) || [];
  if (words.length === 0) return 0;
  const score = words.reduce((sum, w) => sum + (freq.get(w) || 0), 0);
  return score / Math.sqrt(words.length);
}

function matchesHint(sentence, hint) {
  if (!hint) return false;
  const keywords = hint
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const lower = sentence.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/** Free, local, no-API heuristic formatter: buckets sentences by section keyword
 * hints, falls back to an extractive top-sentence summary for open sections
 * (e.g. "Summary"), and always tags likely action-item sentences. */
export function heuristicFormat(transcript, template) {
  const sentences = splitSentences(transcript);
  if (sentences.length === 0) {
    return template.sections.map((section) => ({ id: section.id, title: section.title, text: "" }));
  }

  const freq = wordFreq(sentences);
  const scored = sentences.map((sentence, index) => ({
    sentence,
    index,
    score: scoreSentence(sentence, freq),
    isAction: ACTION_PATTERN.test(sentence)
  }));

  const used = new Set();
  const buckets = new Map();
  for (const section of template.sections) buckets.set(section.id, []);

  const actionSection = template.sections.find((s) =>
    /action|task|todo|follow.?up/i.test(s.title) || /action|todo|follow up/i.test(s.hint || "")
  );

  for (const item of scored) {
    for (const section of template.sections) {
      if (used.has(item.index)) break;
      if (section === actionSection) continue;
      if (matchesHint(item.sentence, section.hint)) {
        buckets.get(section.id).push(item);
        used.add(item.index);
      }
    }
  }

  if (actionSection) {
    for (const item of scored) {
      if (used.has(item.index)) continue;
      if (item.isAction || matchesHint(item.sentence, actionSection.hint)) {
        buckets.get(actionSection.id).push(item);
        used.add(item.index);
      }
    }
  }

  const openSections = template.sections.filter((s) => !s.hint || !s.hint.trim());
  const remaining = scored.filter((item) => !used.has(item.index));

  if (openSections.length > 0) {
    const summarySection = openSections[0];
    const topCount = Math.max(2, Math.min(6, Math.ceil(remaining.length * 0.35)));
    const top = [...remaining].sort((a, b) => b.score - a.score).slice(0, topCount);
    const topIndexes = new Set(top.map((t) => t.index));
    for (const item of top) {
      buckets.get(summarySection.id).push(item);
      used.add(item.index);
    }

    for (const section of openSections.slice(1)) {
      const leftover = scored.filter((item) => !used.has(item.index));
      for (const item of leftover) {
        buckets.get(section.id).push(item);
        used.add(item.index);
      }
    }
  } else {
    const catchAll = template.sections[template.sections.length - 1];
    for (const item of remaining) {
      buckets.get(catchAll.id).push(item);
      used.add(item.index);
    }
  }

  return template.sections.map((section) => {
    const items = (buckets.get(section.id) || []).sort((a, b) => a.index - b.index);
    const bullet = section === actionSection || (section.hint || "").includes(",");
    const text = items
      .map((item) => (bullet ? `- ${item.sentence}` : item.sentence))
      .join(bullet ? "\n" : " ");
    return { id: section.id, title: section.title, text };
  });
}

/** Optional bring-your-own-key path: calls the Anthropic Messages API directly
 * from the browser using the caller's own key (kept in localStorage only,
 * never sent anywhere else) for genuinely AI-generated summaries. */
export async function aiFormat(transcript, template, apiKey, model = "claude-haiku-4-5") {
  const sectionList = template.sections.map((s) => `- ${s.title}${s.hint ? ` (focus: ${s.hint})` : ""}`).join("\n");
  const prompt = `You are formatting a meeting transcript into structured notes.

Template sections:
${sectionList}

Return ONLY valid JSON: an array of objects like {"title": string, "text": string}, one per section above, in the same order. Use concise bullet points (use "\\n- " between bullets) where useful, and leave text empty ("") if nothing relevant was said. Do not include any text outside the JSON array.

Transcript:
"""
${transcript}
"""`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI formatting failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.map((block) => block.text || "").join("") || "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not parse AI response as JSON.");
  const parsed = JSON.parse(jsonMatch[0]);

  return template.sections.map((section, i) => ({
    id: section.id,
    title: section.title,
    text: parsed[i]?.text || ""
  }));
}
