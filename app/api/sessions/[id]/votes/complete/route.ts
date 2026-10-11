import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { parseSettings } from "@/server/db/types";
import { json, err, readJson, str } from "@/server/api-helpers";

export const runtime = "nodejs";

/** Mark voting complete for a topic (idempotent per member). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  const member = viewer.member;

  const body = await readJson(req);
  const topicId = body ? str(body.topicId) : "";
  if (!topicId) return err("topicId is required", 400);

  const db = getDb();
  const session = await db.getSessionById(id);
  if (!session) return err("Session not found", 404);

  const settings = parseSettings(session.settings);
  const list = settings.voteCompletions[topicId] ?? [];
  if (!list.includes(member.id)) list.push(member.id);
  settings.voteCompletions[topicId] = list;
  await db.updateSession(id, { settings: JSON.stringify(settings) });

  publishSession(id);
  return json({ ok: true });
}
