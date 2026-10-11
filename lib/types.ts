export type ColumnKey = "went" | "improve" | "ideas";
export type Stage = "write" | "group" | "vote" | "review";
export type ComposerMode = "note" | "action";

export interface Member {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  column: ColumnKey;
  text: string;
  votes: number;
  authorId: string;
  created: string;
}

export interface RetroGroup {
  id: string;
  column: ColumnKey;
  title: string;
  noteIds: string[];
  votes: number;
  votesBy: Record<string, number>;
}

export interface ActionItem {
  id: string;
  text: string;
  owner: string;
  date: string;
  done: boolean;
}

export interface BoardState {
  title: string;
  currentRound: number;
  stage: Stage;
  notes: Note[];
  groups: RetroGroup[];
  actions: ActionItem[];
  members: Member[];
  hostId: string;
  currentMemberId: string;
  voteCompletions: Record<ColumnKey, string[]>;
  timerSeconds: number;
  timerRunning: boolean;
}

export const COLUMN_ORDER: ColumnKey[] = ["went", "improve", "ideas"];

export const COLUMNS: Record<
  ColumnKey,
  { title: string; short: string; prompt: string }
> = {
  went: {
    title: "Went well",
    short: "what went well",
    prompt: "What gave the team momentum?",
  },
  improve: {
    title: "Could improve",
    short: "what could improve",
    prompt: "Where did friction slow us down?",
  },
  ideas: {
    title: "Try next",
    short: "what to try next",
    prompt: "What small experiment is worth running?",
  },
};

export const VOTE_BUDGET = 5;
export const WRITE_SECONDS = 300;
export const REVIEW_SECONDS = 600;
export const NOTE_MAX = 280;
export const TITLE_MAX = 60;
export const THEME_TITLE_MAX = 80;

/** Server-authoritative session metadata shipped with every serialized session. */
export interface SessionTimerMeta {
  endsAt: string | null;
  seconds: number;
  running: boolean;
}

export interface SessionMeta {
  sessionId: string;
  shareToken: string;
  title: string;
  isHost: boolean;
  myMemberId: string;
  myAlias: string;
  topics: ColumnKey[];
  timer: SessionTimerMeta;
}

/** Full payload of GET /api/sessions/[id] and of the SSE "state" events. */
export interface SerializedSession {
  state: BoardState;
  meta: SessionMeta;
}
