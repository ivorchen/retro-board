import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { getSessionUser } from "@/server/auth/session";
import { defaultSettings } from "@/server/db/types";
import { parseSnapshot } from "@/lib/snapshot";
import { publishSession } from "@/server/realtime";
import {
  json,
  err,
  newId,
  nowIso,
  newShareToken,
  readJson,
} from "@/server/api-helpers";

export const runtime = "nodejs";

const DEFAULT_TOPICS = ["went", "improve", "ideas"];

/**
 * Import a board snapshot: validates/normalizes via parseSnapshot, then
 * creates a session + host member, re-creates the cards (host-authored),
 * themes (+ memberships), and action items (theme-less, no owner alias).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return err("Unauthorized", 401);

  const body = await readJson(req);
  if (!body || !("snapshot" in body)) return err("Missing snapshot", 400);

  let snapshot;
  try {
    snapshot = parseSnapshot(body.snapshot);
  } catch {
    return err("Invalid board snapshot", 400);
  }

  const db = getDb();
  const now = nowIso();
  const session = await db.createSession({
    id: newId(),
    host_id: user.id,
    title: snapshot.title,
    share_token: newShareToken(),
    status: "active",
    topics: JSON.stringify(DEFAULT_TOPICS),
    current_topic_index: 0,
    current_phase: "write",
    settings: JSON.stringify(defaultSettings()),
    created_at: now,
  });
  const host = await db.createMember({
    id: newId(),
    session_id: session.id,
    user_id: user.id,
    display_name: user.name,
    alias: "Host · Member 1",
    is_host: 1,
    is_anonymous: 0,
    join_token_hash: null,
    joined_at: now,
  });

  // Map parseSnapshot's remapped note ids -> the card ids we create.
  const cardIdMap = new Map<string, string>();
  for (const note of snapshot.notes) {
    const card = await db.createCard({
      id: newId(),
      session_id: session.id,
      topic_id: note.column,
      member_id: host.id,
      content: note.text,
      created_at: now,
    });
    cardIdMap.set(note.id, card.id);
  }

  for (const group of snapshot.groups) {
    const theme = await db.createTheme({
      id: newId(),
      session_id: session.id,
      topic_id: group.column,
      title: group.title,
      created_at: now,
    });
    const cardIds = group.noteIds
      .map((nid) => cardIdMap.get(nid))
      .filter((x): x is string => !!x);
    await db.setThemeCards(theme.id, cardIds);
  }

  for (const action of snapshot.actions) {
    await db.createAction({
      id: newId(),
      session_id: session.id,
      theme_id: null,
      title: action.text,
      owner_alias: "",
      due_date: action.date || null,
      done: action.done ? 1 : 0,
      created_at: now,
    });
  }

  publishSession(session.id);
  return json({ shareToken: session.share_token }, 201);
}
