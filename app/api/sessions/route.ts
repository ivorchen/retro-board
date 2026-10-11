import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { getSessionUser } from "@/server/auth/session";
import { defaultSettings } from "@/server/db/types";
import { TITLE_MAX } from "@/lib/types";
import {
  json,
  err,
  newId,
  nowIso,
  newShareToken,
  readJson,
  str,
} from "@/server/api-helpers";

export const runtime = "nodejs";

const DEFAULT_TOPICS = ["went", "improve", "ideas"];

/**
 * POST: create a new session + host member ("Host · Member 1").
 * GET: list sessions hosted by the current user.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return err("Unauthorized", 401);

  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);

  const title = str(body.title).trim().slice(0, TITLE_MAX) || "Sprint retrospective";

  const db = getDb();
  const now = nowIso();
  const session = await db.createSession({
    id: newId(),
    host_id: user.id,
    title,
    share_token: newShareToken(),
    status: "active",
    topics: JSON.stringify(DEFAULT_TOPICS),
    current_topic_index: 0,
    current_phase: "write",
    settings: JSON.stringify(defaultSettings()),
    created_at: now,
  });
  await db.createMember({
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

  return json({ id: session.id, shareToken: session.share_token }, 201);
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return err("Unauthorized", 401);

  const db = getDb();
  const sessions = await db.listSessionsByHost(user.id);
  const out = await Promise.all(
    sessions.map(async (s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      shareToken: s.share_token,
      createdAt: s.created_at,
      memberCount: await db.countMembers(s.id),
    }))
  );
  return json({ sessions: out });
}
