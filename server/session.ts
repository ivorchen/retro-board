/**
 * Server-side session helpers: viewer resolution and client-state serialization.
 *
 * Privacy rule: serialization NEVER includes emails, GitHub ids, or real
 * names — members appear only under their session aliases.
 */

import { createHash } from "node:crypto";
import { getDb } from "./db";
import { b, parseSettings } from "./db/types";
import type { MemberRow } from "./db/types";
import type {
  ActionItem,
  BoardState,
  ColumnKey,
  Member,
  Note,
  RetroGroup,
  SerializedSession,
  Stage,
} from "@/lib/types";
import {
  ANON_COOKIE,
  getCookie,
  getSessionUser,
  type SessionUser,
} from "./auth/session";

const VALID_COLUMNS: ColumnKey[] = ["went", "improve", "ideas"];

function asColumn(v: string): ColumnKey {
  return (VALID_COLUMNS as string[]).includes(v) ? (v as ColumnKey) : "went";
}

export interface ViewerMember {
  id: string;
  session_id: string;
  user_id: string | null;
  display_name: string | null;
  alias: string;
  is_host: boolean;
  is_anonymous: boolean;
}

export interface ViewerCtx {
  member: ViewerMember | null;
  user: SessionUser | null;
}

function toViewerMember(m: MemberRow): ViewerMember {
  return {
    id: m.id,
    session_id: m.session_id,
    user_id: m.user_id,
    display_name: m.display_name,
    alias: m.alias,
    is_host: m.is_host === 1,
    is_anonymous: m.is_anonymous === 1,
  };
}

/**
 * Resolves who is looking at a session.
 * - Logged in: the member row bound to their user_id.
 * - Otherwise: rb_anon cookie → sha256 → member by join_token_hash,
 *   verified to belong to this session.
 * Never throws: on any failure returns { member: null, user: null }.
 */
export async function resolveViewer(
  sessionId: string,
  req: Request
): Promise<ViewerCtx> {
  const none: ViewerCtx = { member: null, user: null };
  try {
    const db = getDb();
    const user = await getSessionUser(req);
    if (user) {
      const m = await db.getMemberByUser(sessionId, user.id);
      return { member: m ? toViewerMember(m) : null, user };
    }
    const anon = getCookie(req, ANON_COOKIE);
    if (anon) {
      const hash = createHash("sha256").update(anon).digest("hex");
      const m = await db.getMemberByTokenHash(hash);
      if (m && m.session_id === sessionId) {
        return { member: toViewerMember(m), user: null };
      }
    }
    return none;
  } catch {
    return none;
  }
}

/** SerializedSession is defined canonically in @/lib/types (client-safe). */
export type { SerializedSession } from "@/lib/types";

function parseTopics(raw: string): ColumnKey[] {
  try {
    const t = JSON.parse(raw) as unknown;
    if (Array.isArray(t)) {
      const cols = t.filter(
        (x): x is ColumnKey =>
          typeof x === "string" && (VALID_COLUMNS as string[]).includes(x)
      );
      if (cols.length > 0) return cols;
    }
  } catch {
    // fall through to default
  }
  return ["went", "improve", "ideas"];
}

/**
 * Builds the client BoardState from DB rows, tailored to one viewer.
 *
 * - members → { id, name: alias }; hostId = the host member's id;
 *   currentMemberId = viewerMemberId.
 * - notes ← cards (created_at order): votes are always 0 here (votes live on
 *   themes, not cards); authorId falls back to hostId for orphaned cards.
 * - groups ← themes; noteIds ordered by each card's created_at.
 * - votes: a topic is "revealed" when every member id appears in
 *   settings.voteCompletions[topic]. Revealed → votes=total,
 *   votesBy=full per-member counts. Unrevealed → votes=0,
 *   votesBy={ viewerId: ownCount } so the voter still sees budget used.
 * - actions ← action_items; timer from settings.timer (remaining seconds are
 *   recomputed from endsAt when running).
 */
export async function getSessionState(
  sessionId: string,
  viewerMemberId: string
): Promise<SerializedSession> {
  const db = getDb();
  const session = await db.getSessionById(sessionId);
  if (!session) {
    throw new Error(`session not found: ${sessionId}`);
  }

  const [memberRows, cardRows, themeRows, themeCardRows, voteRows, actionRows] =
    await Promise.all([
      db.listMembers(sessionId),
      db.listCards(sessionId),
      db.listThemes(sessionId),
      db.listThemeCards(sessionId),
      db.listVotes(sessionId),
      db.listActions(sessionId),
    ]);

  const settings = parseSettings(session.settings);
  const topics = parseTopics(session.topics);

  const hostMember =
    memberRows.find((m) => m.is_host === 1) ?? memberRows[0] ?? null;
  const hostId = hostMember?.id ?? "";
  const viewer = memberRows.find((m) => m.id === viewerMemberId) ?? null;

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    name: m.alias,
  }));

  const notes: Note[] = cardRows.map((c) => ({
    id: c.id,
    column: asColumn(c.topic_id),
    text: c.content,
    votes: 0,
    authorId: c.member_id ?? hostId,
    created: c.created_at,
  }));

  // Vote aggregation per theme.
  const totals = new Map<string, number>();
  const byMember = new Map<string, Record<string, number>>();
  for (const v of voteRows) {
    totals.set(v.theme_id, (totals.get(v.theme_id) ?? 0) + 1);
    const per = byMember.get(v.theme_id) ?? {};
    per[v.member_id] = (per[v.member_id] ?? 0) + 1;
    byMember.set(v.theme_id, per);
  }

  const isRevealed = (topic: string): boolean => {
    const completions = settings.voteCompletions[topic] ?? [];
    return memberRows.every((m) => completions.includes(m.id));
  };

  // Card order within groups: by the card's created_at.
  const cardCreatedAt = new Map(cardRows.map((c) => [c.id, c.created_at]));
  const noteIdsByTheme = new Map<string, string[]>();
  for (const tc of themeCardRows) {
    const arr = noteIdsByTheme.get(tc.theme_id) ?? [];
    arr.push(tc.card_id);
    noteIdsByTheme.set(tc.theme_id, arr);
  }
  for (const arr of noteIdsByTheme.values()) {
    arr.sort((a, b) =>
      (cardCreatedAt.get(a) ?? "").localeCompare(cardCreatedAt.get(b) ?? "")
    );
  }

  const groups: RetroGroup[] = themeRows.map((t) => {
    const column = asColumn(t.topic_id);
    const total = totals.get(t.id) ?? 0;
    const revealed = isRevealed(t.topic_id);
    return {
      id: t.id,
      column,
      title: t.title,
      noteIds: noteIdsByTheme.get(t.id) ?? [],
      votes: revealed ? total : 0,
      votesBy: revealed
        ? (byMember.get(t.id) ?? {})
        : { [viewerMemberId]: byMember.get(t.id)?.[viewerMemberId] ?? 0 },
    };
  });

  const actions: ActionItem[] = actionRows.map((a) => ({
    id: a.id,
    text: a.title,
    owner: a.owner_alias,
    date: a.due_date ?? "",
    done: b(a.done),
  }));

  const voteCompletions: Record<ColumnKey, string[]> = {
    went: [],
    improve: [],
    ideas: [],
  };
  for (const t of topics) {
    const arr = settings.voteCompletions[t];
    if (Array.isArray(arr)) {
      voteCompletions[t] = arr.filter(
        (x): x is string => typeof x === "string"
      );
    }
  }

  const timer = settings.timer;
  const now = Date.now();
  const timerSeconds =
    timer.running && timer.endsAt
      ? Math.max(0, Math.round((Date.parse(timer.endsAt) - now) / 1000))
      : timer.seconds;

  const state: BoardState = {
    title: session.title,
    currentRound: session.current_topic_index,
    stage: session.current_phase as Stage,
    notes,
    groups,
    actions,
    members,
    hostId,
    currentMemberId: viewerMemberId,
    voteCompletions,
    timerSeconds,
    timerRunning: timer.running,
  };

  return {
    state,
    meta: {
      sessionId: session.id,
      shareToken: session.share_token,
      title: session.title,
      isHost: viewer?.is_host === 1,
      myMemberId: viewerMemberId,
      myAlias: viewer?.alias ?? "",
      topics,
      timer: { endsAt: timer.endsAt, seconds: timer.seconds, running: timer.running },
    },
  };
}
