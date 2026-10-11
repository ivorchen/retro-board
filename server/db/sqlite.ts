/**
 * SQLite implementation of the `Db` data-access contract (node:sqlite).
 *
 * node:sqlite is synchronous, so every method is wrapped in an async shell.
 * All values are bound with `?` placeholders; rows are selected back after
 * writes and mapped straight onto the interface row types (no RETURNING,
 * no driver-specific SQL beyond `db.prepare(...).get/.all/.run` and `db.exec`
 * for transactions).
 */

import { DatabaseSync } from "node:sqlite";
import type {
  ActionPatch,
  ActionRow,
  CardRow,
  Db,
  EmailTokenRow,
  MemberRow,
  NewAction,
  NewCard,
  NewMember,
  NewSession,
  NewTheme,
  NewUser,
  NewVote,
  SessionPatch,
  SessionRow,
  ThemeCardRow,
  ThemeRow,
  UserRow,
  VoteRow,
} from "./types";

type Params = Array<string | number | bigint | null>;

function one<T>(db: DatabaseSync, sql: string, ...params: Params): T | null {
  const row = db.prepare(sql).get(...params) as unknown as T | undefined;
  return row === undefined ? null : row;
}

function all<T>(db: DatabaseSync, sql: string, ...params: Params): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

function count(db: DatabaseSync, sql: string, ...params: Params): number {
  const row = db.prepare(sql).get(...params) as unknown as
    | { n: number | bigint }
    | undefined;
  return Number(row?.n ?? 0);
}

/**
 * Build `SET a=?, b=?` from a partial patch, skipping undefined values.
 * Keys come from our own typed patch interfaces (never user input), so
 * interpolating them into the SET clause is safe.
 */
function buildSet(patch: object): { clause: string; values: Params } {
  const entries = Object.entries(patch) as Array<[string, unknown]>;
  const kept = entries.filter(
    (e): e is [string, string | number | null] =>
      e[1] !== undefined &&
      (typeof e[1] === "string" || typeof e[1] === "number" || e[1] === null)
  );
  return {
    clause: kept.map(([k]) => `${k} = ?`).join(", "),
    values: kept.map(([, v]) => v),
  };
}

export class SqliteDb implements Db {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  // -- users ---------------------------------------------------------------
  async createUser(u: NewUser): Promise<UserRow> {
    this.db
      .prepare(
        `INSERT INTO users (id, email, github_id, name, avatar_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(u.id, u.email, u.github_id, u.name, u.avatar_url, u.created_at);
    return (await this.getUserById(u.id)) as UserRow;
  }

  async getUserById(id: string): Promise<UserRow | null> {
    return one<UserRow>(this.db, "SELECT * FROM users WHERE id = ?", id);
  }

  async getUserByEmail(email: string): Promise<UserRow | null> {
    return one<UserRow>(this.db, "SELECT * FROM users WHERE email = ?", email);
  }

  async getUserByGithubId(githubId: string): Promise<UserRow | null> {
    return one<UserRow>(
      this.db,
      "SELECT * FROM users WHERE github_id = ?",
      githubId
    );
  }

  async updateUser(
    id: string,
    patch: Partial<Pick<UserRow, "name" | "avatar_url" | "email">>
  ): Promise<UserRow | null> {
    const { clause, values } = buildSet(patch);
    if (!clause) return this.getUserById(id);
    this.db
      .prepare(`UPDATE users SET ${clause} WHERE id = ?`)
      .run(...values, id);
    return this.getUserById(id);
  }

  // -- email tokens (magic links) -------------------------------------------
  async createEmailToken(
    t: Omit<EmailTokenRow, "used"> & { used?: number }
  ): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO email_tokens (token_hash, email, user_id, expires_at, used, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(t.token_hash, t.email, t.user_id, t.expires_at, t.used ?? 0, t.created_at);
  }

  async consumeEmailToken(
    tokenHash: string,
    nowIso: string
  ): Promise<EmailTokenRow | null> {
    const res = this.db
      .prepare(
        `UPDATE email_tokens
         SET used = 1
         WHERE token_hash = ? AND used = 0 AND expires_at > ?`
      )
      .run(tokenHash, nowIso);
    if (Number(res.changes) === 0) return null;
    return one<EmailTokenRow>(
      this.db,
      "SELECT * FROM email_tokens WHERE token_hash = ?",
      tokenHash
    );
  }

  // -- sessions --------------------------------------------------------------
  async createSession(s: NewSession): Promise<SessionRow> {
    this.db
      .prepare(
        `INSERT INTO sessions (id, host_id, title, share_token, status, topics,
                               current_topic_index, current_phase, settings, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        s.id,
        s.host_id,
        s.title,
        s.share_token,
        s.status,
        s.topics,
        s.current_topic_index,
        s.current_phase,
        s.settings,
        s.created_at
      );
    return (await this.getSessionById(s.id)) as SessionRow;
  }

  async getSessionById(id: string): Promise<SessionRow | null> {
    return one<SessionRow>(this.db, "SELECT * FROM sessions WHERE id = ?", id);
  }

  async getSessionByToken(shareToken: string): Promise<SessionRow | null> {
    return one<SessionRow>(
      this.db,
      "SELECT * FROM sessions WHERE share_token = ?",
      shareToken
    );
  }

  async listSessionsByHost(hostUserId: string): Promise<SessionRow[]> {
    return all<SessionRow>(
      this.db,
      "SELECT * FROM sessions WHERE host_id = ? ORDER BY created_at DESC",
      hostUserId
    );
  }

  async updateSession(
    id: string,
    patch: SessionPatch
  ): Promise<SessionRow | null> {
    const { clause, values } = buildSet(patch);
    if (!clause) return this.getSessionById(id);
    this.db
      .prepare(`UPDATE sessions SET ${clause} WHERE id = ?`)
      .run(...values, id);
    return this.getSessionById(id);
  }

  // -- members ---------------------------------------------------------------
  async createMember(m: NewMember): Promise<MemberRow> {
    this.db
      .prepare(
        `INSERT INTO session_members (id, session_id, user_id, display_name, alias,
                                      is_host, is_anonymous, join_token_hash, joined_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        m.id,
        m.session_id,
        m.user_id,
        m.display_name,
        m.alias,
        m.is_host,
        m.is_anonymous,
        m.join_token_hash,
        m.joined_at
      );
    return (await this.getMemberById(m.id)) as MemberRow;
  }

  async getMemberById(id: string): Promise<MemberRow | null> {
    return one<MemberRow>(
      this.db,
      "SELECT * FROM session_members WHERE id = ?",
      id
    );
  }

  async getMemberByUser(
    sessionId: string,
    userId: string
  ): Promise<MemberRow | null> {
    return one<MemberRow>(
      this.db,
      "SELECT * FROM session_members WHERE session_id = ? AND user_id = ?",
      sessionId,
      userId
    );
  }

  async getMemberByTokenHash(tokenHash: string): Promise<MemberRow | null> {
    return one<MemberRow>(
      this.db,
      "SELECT * FROM session_members WHERE join_token_hash = ?",
      tokenHash
    );
  }

  async listMembers(sessionId: string): Promise<MemberRow[]> {
    return all<MemberRow>(
      this.db,
      "SELECT * FROM session_members WHERE session_id = ? ORDER BY joined_at ASC",
      sessionId
    );
  }

  async countMembers(sessionId: string): Promise<number> {
    return count(
      this.db,
      "SELECT COUNT(*) AS n FROM session_members WHERE session_id = ?",
      sessionId
    );
  }

  // -- cards -----------------------------------------------------------------
  async createCard(c: NewCard): Promise<CardRow> {
    this.db
      .prepare(
        `INSERT INTO cards (id, session_id, topic_id, member_id, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(c.id, c.session_id, c.topic_id, c.member_id, c.content, c.created_at);
    return (await this.getCardById(c.id)) as CardRow;
  }

  async getCardById(id: string): Promise<CardRow | null> {
    return one<CardRow>(this.db, "SELECT * FROM cards WHERE id = ?", id);
  }

  async listCards(sessionId: string): Promise<CardRow[]> {
    return all<CardRow>(
      this.db,
      "SELECT * FROM cards WHERE session_id = ? ORDER BY created_at ASC",
      sessionId
    );
  }

  async updateCardContent(id: string, content: string): Promise<CardRow | null> {
    this.db
      .prepare("UPDATE cards SET content = ? WHERE id = ?")
      .run(content, id);
    return this.getCardById(id);
  }

  async deleteCard(id: string): Promise<void> {
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("DELETE FROM theme_cards WHERE card_id = ?")
        .run(id);
      this.db.prepare("DELETE FROM cards WHERE id = ?").run(id);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  // -- themes ----------------------------------------------------------------
  async createTheme(t: NewTheme): Promise<ThemeRow> {
    this.db
      .prepare(
        `INSERT INTO themes (id, session_id, topic_id, title, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(t.id, t.session_id, t.topic_id, t.title, t.created_at);
    return (await this.getThemeById(t.id)) as ThemeRow;
  }

  async getThemeById(id: string): Promise<ThemeRow | null> {
    return one<ThemeRow>(this.db, "SELECT * FROM themes WHERE id = ?", id);
  }

  async listThemes(sessionId: string): Promise<ThemeRow[]> {
    return all<ThemeRow>(
      this.db,
      "SELECT * FROM themes WHERE session_id = ? ORDER BY created_at ASC",
      sessionId
    );
  }

  async renameTheme(id: string, title: string): Promise<ThemeRow | null> {
    this.db.prepare("UPDATE themes SET title = ? WHERE id = ?").run(title, id);
    return this.getThemeById(id);
  }

  async listThemeCards(sessionId: string): Promise<ThemeCardRow[]> {
    return all<ThemeCardRow>(
      this.db,
      `SELECT tc.theme_id, tc.card_id FROM theme_cards tc
       JOIN themes t ON t.id = tc.theme_id
       WHERE t.session_id = ?`,
      sessionId
    );
  }

  async setThemeCards(themeId: string, cardIds: string[]): Promise<void> {
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("DELETE FROM theme_cards WHERE theme_id = ?")
        .run(themeId);
      const insert = this.db.prepare(
        "INSERT INTO theme_cards (theme_id, card_id) VALUES (?, ?)"
      );
      for (const cardId of cardIds) insert.run(themeId, cardId);
      this.db.exec("COMMIT");
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  async removeCardFromThemes(
    sessionId: string,
    cardId: string
  ): Promise<void> {
    this.db
      .prepare(
        `DELETE FROM theme_cards
         WHERE card_id = ?
           AND theme_id IN (SELECT id FROM themes WHERE session_id = ?)`
      )
      .run(cardId, sessionId);
  }

  // -- votes -----------------------------------------------------------------
  async createVote(v: NewVote): Promise<VoteRow> {
    this.db
      .prepare(
        `INSERT INTO votes (id, session_id, theme_id, member_id, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(v.id, v.session_id, v.theme_id, v.member_id, v.created_at);
    return one<VoteRow>(
      this.db,
      "SELECT * FROM votes WHERE id = ?",
      v.id
    ) as VoteRow;
  }

  async listVotes(sessionId: string): Promise<VoteRow[]> {
    return all<VoteRow>(
      this.db,
      "SELECT * FROM votes WHERE session_id = ? ORDER BY created_at ASC",
      sessionId
    );
  }

  async countMemberTopicVotes(
    sessionId: string,
    memberId: string,
    topicId: string
  ): Promise<number> {
    return count(
      this.db,
      `SELECT COUNT(*) AS n FROM votes v
       JOIN themes t ON t.id = v.theme_id
       WHERE v.session_id = ? AND v.member_id = ? AND t.topic_id = ?`,
      sessionId,
      memberId,
      topicId
    );
  }

  // -- action items ------------------------------------------------------------
  async createAction(a: NewAction): Promise<ActionRow> {
    this.db
      .prepare(
        `INSERT INTO action_items (id, session_id, theme_id, title, owner_alias,
                                  due_date, done, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        a.id,
        a.session_id,
        a.theme_id,
        a.title,
        a.owner_alias,
        a.due_date,
        a.done,
        a.created_at
      );
    return (await this.getActionById(a.id)) as ActionRow;
  }

  async getActionById(id: string): Promise<ActionRow | null> {
    return one<ActionRow>(
      this.db,
      "SELECT * FROM action_items WHERE id = ?",
      id
    );
  }

  async listActions(sessionId: string): Promise<ActionRow[]> {
    return all<ActionRow>(
      this.db,
      "SELECT * FROM action_items WHERE session_id = ? ORDER BY created_at ASC",
      sessionId
    );
  }

  async updateAction(
    id: string,
    patch: ActionPatch
  ): Promise<ActionRow | null> {
    const { clause, values } = buildSet(patch);
    if (!clause) return this.getActionById(id);
    this.db
      .prepare(`UPDATE action_items SET ${clause} WHERE id = ?`)
      .run(...values, id);
    return this.getActionById(id);
  }
}
