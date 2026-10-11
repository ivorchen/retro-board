import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer, getSessionState } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { parseSettings, type SessionPatch } from "@/server/db/types";
import { autoGroupNotes } from "@/lib/grouping";
import {
  REVIEW_SECONDS,
  WRITE_SECONDS,
  THEME_TITLE_MAX,
  type ColumnKey,
  type Note,
} from "@/lib/types";
import {
  json,
  err,
  newId,
  nowIso,
  readJson,
  str,
  parseTopics,
} from "@/server/api-helpers";

export const runtime = "nodejs";

/**
 * Host-only phase transitions:
 * - finish_writing: write → group (auto-groups the current topic's notes)
 * - start_voting:  group → vote
 * - next_round:    vote → write (next topic; timer reset to WRITE_SECONDS)
 * - to_review:     → review (timer reset to REVIEW_SECONDS)
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  if (!viewer.member.is_host) {
    return err("Only the host can change the phase", 403);
  }

  const db = getDb();
  const session = await db.getSessionById(id);
  if (!session) return err("Session not found", 404);

  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);
  const op = str(body.op);
  const topicId = str(body.topicId);

  const topics = parseTopics(session.topics);
  const settings = parseSettings(session.settings);
  const phase = session.current_phase;
  const patch: SessionPatch = {};

  if (op === "finish_writing") {
    if (phase !== "write") {
      return err("Session is not in the writing phase", 409);
    }
    if (!topicId || topicId !== topics[session.current_topic_index]) {
      return err("Wrong topic", 409);
    }
    const cards = (await db.listCards(id)).filter(
      (c) => c.topic_id === topicId
    );
    const notes: Note[] = cards.map((c) => ({
      id: c.id,
      column: topicId as ColumnKey,
      text: c.content,
      votes: 0,
      authorId: c.member_id ?? "",
      created: c.created_at,
    }));
    const groups = autoGroupNotes(notes, topicId as ColumnKey);
    for (const g of groups) {
      const theme = await db.createTheme({
        id: newId(),
        session_id: id,
        topic_id: topicId,
        title: g.title.slice(0, THEME_TITLE_MAX),
        created_at: nowIso(),
      });
      await db.setThemeCards(theme.id, g.noteIds);
    }
    patch.current_phase = "group";
  } else if (op === "start_voting") {
    if (phase !== "group") {
      return err("Session is not in the grouping phase", 409);
    }
    patch.current_phase = "vote";
  } else if (op === "next_round") {
    if (phase !== "vote") {
      return err("Session is not in the voting phase", 409);
    }
    if (session.current_topic_index >= topics.length - 1) {
      return err("No more rounds", 400);
    }
    patch.current_topic_index = session.current_topic_index + 1;
    patch.current_phase = "write";
    settings.timer = { endsAt: null, seconds: WRITE_SECONDS, running: false };
  } else if (op === "to_review") {
    patch.current_phase = "review";
    settings.timer = { endsAt: null, seconds: REVIEW_SECONDS, running: false };
  } else {
    return err("Unknown operation", 400);
  }

  patch.settings = JSON.stringify(settings);
  await db.updateSession(id, patch);
  publishSession(id);
  const state = await getSessionState(id, viewer.member.id);
  return json(state);
}
