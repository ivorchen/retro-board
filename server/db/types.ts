/**
 * Data-access layer contract.
 *
 * Every operation the app needs, expressed without any SQL. All application
 * code (route handlers, session helpers) talks ONLY to this interface.
 *
 * - `SqliteDb` (server/db/sqlite.ts) implements it today on node:sqlite.
 * - A `PostgresDb` can be added later without touching any call site:
 *   implement this interface with parameterized queries for the target
 *   driver ($1-style placeholders, jsonb columns for the TEXT JSON blobs).
 *
 * Conventions:
 * - All methods are async (SQLite is sync underneath; the wrapper adapts).
 * - Ids are UUID strings (crypto.randomUUID), timestamps are ISO-8601 UTC
 *   strings; both are always supplied by the caller — never DB defaults.
 * - Booleans cross the boundary as 0/1 numbers (SQLite has no bool type);
 *   helpers `b()` / `n()` below convert at the edges.
 * - JSON blobs (topics, settings) cross as TEXT; parse/stringify at the edges.
 */

export interface UserRow {
  id: string;
  email: string | null;
  github_id: string | null;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface NewUser {
  id: string;
  email: string | null;
  github_id: string | null;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface EmailTokenRow {
  token_hash: string;
  email: string;
  user_id: string | null;
  expires_at: string;
  used: number;
  created_at: string;
}

export interface SessionRow {
  id: string;
  host_id: string | null;
  title: string;
  share_token: string;
  status: string;
  topics: string; // JSON: string[]
  current_topic_index: number;
  current_phase: string; // 'write' | 'group' | 'vote' | 'review'
  settings: string; // JSON: SessionSettings
  created_at: string;
}

export interface NewSession {
  id: string;
  host_id: string | null;
  title: string;
  share_token: string;
  status: string;
  topics: string;
  current_topic_index: number;
  current_phase: string;
  settings: string;
  created_at: string;
}

export interface SessionSettings {
  voteCompletions: Record<string, string[]>;
  timer: { endsAt: string | null; seconds: number; running: boolean };
}

export interface MemberRow {
  id: string;
  session_id: string;
  user_id: string | null;
  display_name: string | null;
  alias: string;
  is_host: number;
  is_anonymous: number;
  join_token_hash: string | null;
  joined_at: string;
}

export interface NewMember {
  id: string;
  session_id: string;
  user_id: string | null;
  display_name: string | null;
  alias: string;
  is_host: number;
  is_anonymous: number;
  join_token_hash: string | null;
  joined_at: string;
}

export interface CardRow {
  id: string;
  session_id: string;
  topic_id: string;
  member_id: string | null;
  content: string;
  created_at: string;
}

export interface NewCard {
  id: string;
  session_id: string;
  topic_id: string;
  member_id: string | null;
  content: string;
  created_at: string;
}

export interface ThemeRow {
  id: string;
  session_id: string;
  topic_id: string;
  title: string;
  created_at: string;
}

export interface NewTheme {
  id: string;
  session_id: string;
  topic_id: string;
  title: string;
  created_at: string;
}

export interface ThemeCardRow {
  theme_id: string;
  card_id: string;
}

export interface VoteRow {
  id: string;
  session_id: string;
  theme_id: string;
  member_id: string;
  created_at: string;
}

export interface NewVote {
  id: string;
  session_id: string;
  theme_id: string;
  member_id: string;
  created_at: string;
}

export interface ActionRow {
  id: string;
  session_id: string;
  theme_id: string | null;
  title: string;
  owner_alias: string;
  due_date: string | null;
  done: number;
  created_at: string;
}

export interface NewAction {
  id: string;
  session_id: string;
  theme_id: string | null;
  title: string;
  owner_alias: string;
  due_date: string | null;
  done: number;
  created_at: string;
}

export interface ActionPatch {
  title?: string;
  owner_alias?: string;
  due_date?: string | null;
  done?: number;
}

export interface SessionPatch {
  title?: string;
  status?: string;
  current_topic_index?: number;
  current_phase?: string;
  settings?: string;
}

export interface Db {
  // -- users ---------------------------------------------------------------
  createUser(u: NewUser): Promise<UserRow>;
  getUserById(id: string): Promise<UserRow | null>;
  getUserByEmail(email: string): Promise<UserRow | null>;
  getUserByGithubId(githubId: string): Promise<UserRow | null>;
  updateUser(id: string, patch: Partial<Pick<UserRow, "name" | "avatar_url" | "email" | "github_id">>): Promise<UserRow | null>;

  // -- email tokens (magic links) -------------------------------------------
  createEmailToken(t: Omit<EmailTokenRow, "used"> & { used?: number }): Promise<void>;
  /** Atomically marks the token used iff it exists, is unused and unexpired.
   *  Returns the row on success, null otherwise. */
  consumeEmailToken(tokenHash: string, nowIso: string): Promise<EmailTokenRow | null>;

  // -- sessions --------------------------------------------------------------
  createSession(s: NewSession): Promise<SessionRow>;
  getSessionById(id: string): Promise<SessionRow | null>;
  getSessionByToken(shareToken: string): Promise<SessionRow | null>;
  listSessionsByHost(hostUserId: string): Promise<SessionRow[]>;
  updateSession(id: string, patch: SessionPatch): Promise<SessionRow | null>;

  // -- members ---------------------------------------------------------------
  createMember(m: NewMember): Promise<MemberRow>;
  getMemberById(id: string): Promise<MemberRow | null>;
  getMemberByUser(sessionId: string, userId: string): Promise<MemberRow | null>;
  getMemberByTokenHash(tokenHash: string): Promise<MemberRow | null>;
  listMembers(sessionId: string): Promise<MemberRow[]>;
  countMembers(sessionId: string): Promise<number>;

  // -- cards -----------------------------------------------------------------
  createCard(c: NewCard): Promise<CardRow>;
  getCardById(id: string): Promise<CardRow | null>;
  listCards(sessionId: string): Promise<CardRow[]>;
  updateCardContent(id: string, content: string): Promise<CardRow | null>;
  /** Deletes the card and its theme_cards memberships. */
  deleteCard(id: string): Promise<void>;

  // -- themes ----------------------------------------------------------------
  createTheme(t: NewTheme): Promise<ThemeRow>;
  getThemeById(id: string): Promise<ThemeRow | null>;
  listThemes(sessionId: string): Promise<ThemeRow[]>;
  renameTheme(id: string, title: string): Promise<ThemeRow | null>;
  listThemeCards(sessionId: string): Promise<ThemeCardRow[]>;
  /** Replace a theme's card membership wholesale (transactional). */
  setThemeCards(themeId: string, cardIds: string[]): Promise<void>;
  /** Remove a card from whatever theme(s) hold it in this session. */
  removeCardFromThemes(sessionId: string, cardId: string): Promise<void>;

  // -- votes -----------------------------------------------------------------
  createVote(v: NewVote): Promise<VoteRow>;
  listVotes(sessionId: string): Promise<VoteRow[]>;
  /** Number of votes this member has cast on themes of the given topic. */
  countMemberTopicVotes(sessionId: string, memberId: string, topicId: string): Promise<number>;

  // -- action items ------------------------------------------------------------
  createAction(a: NewAction): Promise<ActionRow>;
  getActionById(id: string): Promise<ActionRow | null>;
  listActions(sessionId: string): Promise<ActionRow[]>;
  updateAction(id: string, patch: ActionPatch): Promise<ActionRow | null>;
}

/** 0/1 -> boolean at the read edge. */
export function b(v: number | null | undefined): boolean {
  return v === 1;
}

/** boolean -> 0/1 at the write edge. */
export function n(v: boolean): number {
  return v ? 1 : 0;
}

export function defaultSettings(): SessionSettings {
  return {
    voteCompletions: {},
    timer: { endsAt: null, seconds: 300, running: false },
  };
}

export function parseSettings(raw: string): SessionSettings {
  try {
    const s = JSON.parse(raw) as Partial<SessionSettings>;
    return {
      voteCompletions:
        s.voteCompletions && typeof s.voteCompletions === "object"
          ? (s.voteCompletions as Record<string, string[]>)
          : {},
      timer: {
        endsAt: typeof s.timer?.endsAt === "string" ? s.timer.endsAt : null,
        seconds:
          typeof s.timer?.seconds === "number" && s.timer.seconds >= 0
            ? Math.floor(s.timer.seconds)
            : 300,
        running: s.timer?.running === true,
      },
    };
  } catch {
    return defaultSettings();
  }
}
