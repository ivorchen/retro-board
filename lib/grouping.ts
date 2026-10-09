import { uid } from "./utils";
import type { ColumnKey, Note, RetroGroup } from "./types";

/**
 * Automatic theme clustering, ported from the original vanilla-JS board.
 * Tokenizes each note (lowercase alnum tokens, stop-word removal, light
 * stemming), maps keyword hits to @category tokens, then union-find clusters
 * notes that share a category, share 2+ tokens, or share a rare long token.
 */

interface Category {
  key: string;
  title: string;
  words: string[];
}

const groupingCategories: Category[] = [
  {
    key: "delivery",
    title: "Delivery & releases",
    words: ["deploy", "deployment", "release", "rollout", "ship", "shipping", "pipeline", "ci", "cd"],
  },
  {
    key: "communication",
    title: "Communication & alignment",
    words: ["communicate", "communication", "alignment", "align", "update", "handoff", "visibility"],
  },
  {
    key: "meetings",
    title: "Meetings & ceremonies",
    words: ["meeting", "standup", "retro", "sync", "ceremony"],
  },
  {
    key: "testing",
    title: "Testing & quality",
    words: ["test", "testing", "qa", "flaky", "regression", "bug", "bugs", "defect", "quality"],
  },
  {
    key: "planning",
    title: "Planning & scope",
    words: ["plan", "planning", "scope", "estimate", "estimation", "priority", "priorities", "requirement", "requirements"],
  },
  {
    key: "reliability",
    title: "Reliability & operations",
    words: ["reliability", "incident", "outage", "oncall", "alert", "monitoring", "stability", "latency", "performance"],
  },
  {
    key: "documentation",
    title: "Documentation & knowledge",
    words: ["docs", "documentation", "document", "runbook", "knowledge"],
  },
  {
    key: "collaboration",
    title: "Collaboration & support",
    words: ["collaboration", "collaborate", "pairing", "teamwork", "support", "unblock", "review", "feedback"],
  },
];

const groupingStopWords: Record<string, true> = {
  a: true, an: true, and: true, are: true, as: true, at: true, be: true,
  been: true, but: true, by: true, can: true, could: true, did: true,
  do: true, does: true, for: true, from: true, had: true, has: true,
  have: true, helped: true, how: true, i: true, in: true, is: true,
  it: true, more: true, need: true, next: true, not: true, of: true,
  on: true, our: true, should: true, so: true, that: true, the: true,
  their: true, them: true, there: true, they: true, this: true, to: true,
  too: true, us: true, was: true, we: true, well: true, were: true,
  what: true, when: true, with: true, would: true,
};

function stemWord(word: string): string {
  if (word.length > 5 && word.slice(-3) === "ing") word = word.slice(0, -3);
  else if (word.length > 4 && word.slice(-2) === "ed") word = word.slice(0, -2);
  else if (word.length > 4 && word.slice(-3) === "ies") word = word.slice(0, -3) + "y";
  else if (word.length > 4 && word.slice(-1) === "s" && word.slice(-2) !== "ss")
    word = word.slice(0, -1);
  return word;
}

function groupingTokens(text: string): string[] {
  const raw = String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
  const tokens: string[] = [];
  raw.forEach((word) => {
    if (word.length < 3 || groupingStopWords[word]) return;
    const stem = stemWord(word);
    const category = groupingCategories.find(
      (c) => c.words.indexOf(word) >= 0 || c.words.indexOf(stem) >= 0
    );
    const token = category ? "@" + category.key : stem;
    if (tokens.indexOf(token) < 0) tokens.push(token);
  });
  return tokens;
}

function automaticThemeTitle(
  noteGroup: Note[],
  tokenSets: Record<string, string[]>
): string {
  if (noteGroup.length === 1) {
    const text = noteGroup[0].text.trim();
    return text.length > 56 ? text.slice(0, 53) + "…" : text;
  }
  const counts: Record<string, number> = {};
  noteGroup.forEach((note) => {
    tokenSets[note.id].forEach((token) => {
      counts[token] = (counts[token] || 0) + 1;
    });
  });
  const shared = Object.keys(counts)
    .filter((token) => counts[token] > 1)
    .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  const categoryToken = shared.find((token) => token.charAt(0) === "@");
  if (categoryToken) {
    const category = groupingCategories.find(
      (c) => "@" + c.key === categoryToken
    );
    if (category) return category.title;
  }
  const words = shared
    .filter((token) => token.charAt(0) !== "@")
    .slice(0, 2)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1));
  return words.length ? words.join(" & ") : "Related observations";
}

export function autoGroupNotes(notes: Note[], column: ColumnKey): RetroGroup[] {
  const tokenSets: Record<string, string[]> = {};
  const frequency: Record<string, number> = {};
  notes.forEach((note) => {
    tokenSets[note.id] = groupingTokens(note.text);
    tokenSets[note.id].forEach((token) => {
      frequency[token] = (frequency[token] || 0) + 1;
    });
  });

  const parent = notes.map((_, i) => i);
  function root(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function join(a: number, b: number) {
    a = root(a);
    b = root(b);
    if (a !== b) parent[b] = a;
  }

  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const left = tokenSets[notes[i].id];
      const right = tokenSets[notes[j].id];
      const shared = left.filter((token) => right.indexOf(token) >= 0);
      const categoryMatch = shared.some((token) => token.charAt(0) === "@");
      const rareMatch = shared.some(
        (token) =>
          token.charAt(0) !== "@" &&
          token.length >= 5 &&
          frequency[token] <= Math.max(2, Math.ceil(notes.length * 0.45))
      );
      if (categoryMatch || shared.length >= 2 || rareMatch) join(i, j);
    }
  }

  const clusters: Record<number, Note[]> = {};
  notes.forEach((note, index) => {
    const r = root(index);
    if (!clusters[r]) clusters[r] = [];
    clusters[r].push(note);
  });

  return Object.keys(clusters)
    .sort((a, b) => Number(a) - Number(b))
    .map((clusterKey) => {
      const cluster = clusters[Number(clusterKey)];
      return {
        id: uid("group"),
        column,
        title: automaticThemeTitle(cluster, tokenSets),
        noteIds: cluster.map((n) => n.id),
        votes: 0,
        votesBy: {},
      };
    });
}
