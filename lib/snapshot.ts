import { autoGroupNotes } from "./grouping";
import { uid } from "./utils";
import {
  COLUMNS,
  COLUMN_ORDER,
  REVIEW_SECONDS,
  WRITE_SECONDS,
  type ActionItem,
  type BoardState,
  type ColumnKey,
  type Member,
  type Note,
  type RetroGroup,
  type Stage,
} from "./types";

export const SNAPSHOT_KIND = "retro-board-snapshot";
export const SNAPSHOT_VERSION = 4;
const STORAGE_KEY = "retro-board-state-v1";

export interface Snapshot {
  kind: string;
  version: number;
  exportedAt: string;
  title: BoardState["title"];
  currentRound: number;
  stage: Stage;
  notes: Note[];
  groups: RetroGroup[];
  actions: ActionItem[];
  members: Member[];
  hostId: string;
  currentMemberId: string;
  voteCompletions: Record<ColumnKey, string[]>;
}

export function exportSnapshot(state: BoardState): Snapshot {
  return {
    kind: SNAPSHOT_KIND,
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    title: state.title,
    currentRound: state.currentRound,
    stage: state.stage,
    notes: state.notes,
    groups: state.groups,
    actions: state.actions,
    members: state.members,
    hostId: state.hostId,
    currentMemberId: state.currentMemberId,
    voteCompletions: state.voteCompletions,
  };
}

export function snapshotFilename(title: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "retro-board";
  return slug + ".json";
}

export function downloadSnapshot(state: BoardState): void {
  const snapshot = exportSnapshot(state);
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = snapshotFilename(state.title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/**
 * Validates and normalizes a parsed JSON snapshot into a BoardState.
 * All ids are remapped (anonymity is preserved: members become Member 1..N,
 * notes/groups/actions get fresh ids) exactly like the original importer.
 * Throws on invalid input.
 */
export function parseSnapshot(data: unknown): BoardState {
  const d = data as Record<string, unknown>;
  if (
    !d ||
    d.kind !== SNAPSHOT_KIND ||
    !Array.isArray(d.notes) ||
    !Array.isArray(d.actions)
  ) {
    throw new Error("Invalid board snapshot");
  }

  const memberMap: Record<string, string> = {};
  const rawMembers = Array.isArray(d.members) ? d.members : [];
  const members: Member[] =
    rawMembers.length > 0
      ? rawMembers.slice(0, 30).map((m, i) => {
          const id = uid("member");
          memberMap[String((m as Member).id)] = id;
          return { id, name: "Member " + (i + 1) };
        })
      : [{ id: uid("member"), name: "Member 1" }];

  const idMap: Record<string, string> = {};
  const notes: Note[] = (d.notes as unknown[])
    .filter(
      (n): n is Record<string, unknown> =>
        !!n &&
        typeof n === "object" &&
        !!(n as Record<string, unknown>)["column"] &&
        !!COLUMNS[(n as Record<string, unknown>)["column"] as ColumnKey] &&
        typeof (n as Record<string, unknown>)["text"] === "string"
    )
    .map((n) => {
      const id = uid("note");
      idMap[String(n["id"])] = id;
      return {
        id,
        column: n["column"] as ColumnKey,
        text: String(n["text"]).slice(0, 280),
        votes: 0,
        authorId: memberMap[String(n["authorId"])] || members[0].id,
        created: String(n["created"] || "imported").slice(0, 40),
      };
    });

  const groups: RetroGroup[] = (
    Array.isArray(d.groups) ? (d.groups as unknown[]) : []
  )
    .filter(
      (g): g is Record<string, unknown> =>
        !!g &&
        typeof g === "object" &&
        !!COLUMNS[(g as Record<string, unknown>)["column"] as ColumnKey] &&
        Array.isArray((g as Record<string, unknown>)["noteIds"])
    )
    .map((g) => {
      const votesBy: Record<string, number> = {};
      const rawVotesBy = g["votesBy"] as Record<string, unknown> | undefined;
      if (rawVotesBy) {
        Object.keys(rawVotesBy).forEach((oldId) => {
          if (memberMap[oldId])
            votesBy[memberMap[oldId]] = Math.max(
              0,
              Number(rawVotesBy[oldId]) || 0
            );
        });
      }
      return {
        id: uid("group"),
        column: g["column"] as ColumnKey,
        title: String(g["title"] || "Untitled theme").slice(0, 80),
        noteIds: ((g["noteIds"] as unknown[]) || [])
          .map((id) => idMap[String(id)])
          .filter(Boolean),
        votes: Math.max(0, Number(g["votes"]) || 0),
        votesBy,
      };
    })
    .filter((g) => g.noteIds.length > 0);

  const rawCompletions = d.voteCompletions as
    | Record<string, unknown[]>
    | undefined;
  const voteCompletions = {} as Record<ColumnKey, string[]>;
  COLUMN_ORDER.forEach((key) => {
    const saved =
      rawCompletions && Array.isArray(rawCompletions[key])
        ? rawCompletions[key]
        : [];
    voteCompletions[key] = saved
      .map((oldId) => memberMap[String(oldId)])
      .filter(Boolean);
  });

  const round = Math.min(3, Math.max(0, Number(d.currentRound) || 0));
  let stage: Stage =
    ["write", "group", "vote", "review"].indexOf(String(d.stage)) >= 0
      ? (String(d.stage) as Stage)
      : "write";
  if (round === 3) stage = "review";
  if (round < 3 && stage === "review") stage = "write";

  const state: BoardState = {
    title: String(d.title || "Sprint retrospective").slice(0, 60),
    currentRound: round,
    stage,
    notes,
    groups,
    actions: (d.actions as unknown[])
      .filter(
        (a): a is Record<string, unknown> =>
          !!a && typeof a === "object" && typeof (a as Record<string, unknown>)["text"] === "string"
      )
      .map((a) => ({
        id: uid("action"),
        text: String(a["text"]).slice(0, 280),
        owner: memberMap[String(a["owner"])] || "",
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(a["date"] || ""))
          ? String(a["date"])
          : "",
        done: Boolean(a["done"]),
      })),
    members,
    hostId: memberMap[String(d.hostId)] || members[0].id,
    currentMemberId: memberMap[String(d.currentMemberId)] || members[0].id,
    voteCompletions,
    timerSeconds: stage === "review" ? REVIEW_SECONDS : WRITE_SECONDS,
    timerRunning: false,
  };

  // The original importer re-runs automatic grouping when restoring a board
  // that was mid-grouping, so the themes match the imported notes.
  if (state.stage === "group") {
    const key = COLUMN_ORDER[state.currentRound];
    if (key) {
      const columnNotes = state.notes.filter((n) => n.column === key);
      state.groups = [
        ...state.groups.filter((g) => g.column !== key),
        ...autoGroupNotes(columnNotes, key),
      ];
    }
  }

  return state;
}

export function saveBoard(state: BoardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(exportSnapshot(state)));
  } catch {
    // Storage may be unavailable or full; the board keeps working in memory.
  }
}

export function loadBoard(): BoardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function hasStoredBoard(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearStoredBoard(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
