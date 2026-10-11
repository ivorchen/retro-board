import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { NOTE_MAX } from "@/lib/types";
import {
  json,
  err,
  newId,
  nowIso,
  readJson,
  str,
  parseTopics,
  toNote,
} from "@/server/api-helpers";

export const runtime = "nodejs";

/** Add a note during the writing phase of the current topic. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);

  const db = getDb();
  const session = await db.getSessionById(id);
  if (!session) return err("Session not found", 404);

  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);
  const topicId = str(body.topicId);
  const content = str(body.content).trim();
  if (!topicId) return err("topicId is required", 400);
  if (content.length < 1 || content.length > NOTE_MAX) {
    return err(`Note must be 1–${NOTE_MAX} characters`, 400);
  }

  const topics = parseTopics(session.topics);
  if (
    session.current_phase !== "write" ||
    topics[session.current_topic_index] !== topicId
  ) {
    return err(
      "Notes can only be added during the writing phase of the current topic",
      409
    );
  }

  const card = await db.createCard({
    id: newId(),
    session_id: id,
    topic_id: topicId,
    member_id: viewer.member.id,
    content,
    created_at: nowIso(),
  });

  publishSession(id);
  return json({ note: toNote(card, viewer.member.id) }, 201);
}
