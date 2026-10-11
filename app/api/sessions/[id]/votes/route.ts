import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { parseSettings } from "@/server/db/types";
import { VOTE_BUDGET } from "@/lib/types";
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

/** Cast a vote on a theme of the current topic (VOTE_BUDGET per topic). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  const member = viewer.member;

  const body = await readJson(req);
  const themeId = body ? str(body.themeId) : "";
  if (!themeId) return err("themeId is required", 400);

  const db = getDb();
  const session = await db.getSessionById(id);
  if (!session) return err("Session not found", 404);
  const theme = await db.getThemeById(themeId);
  if (!theme || theme.session_id !== id) return err("Theme not found", 404);

  if (session.current_phase !== "vote") {
    return err("Voting is not open", 409);
  }
  const topics = parseTopics(session.topics);
  const currentTopic = topics[session.current_topic_index];
  if (theme.topic_id !== currentTopic) {
    return err("Theme is not in the current round", 409);
  }

  const settings = parseSettings(session.settings);
  const completions = settings.voteCompletions[theme.topic_id] ?? [];
  if (completions.includes(member.id)) {
    return err("Voting already completed for this topic", 409);
  }

  const used = await db.countMemberTopicVotes(id, member.id, theme.topic_id);
  if (used >= VOTE_BUDGET) {
    return err("Vote budget exhausted", 400);
  }

  await db.createVote({
    id: newId(),
    session_id: id,
    theme_id: themeId,
    member_id: member.id,
    created_at: nowIso(),
  });

  publishSession(id);
  return json({ ok: true });
}
