import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { THEME_TITLE_MAX } from "@/lib/types";
import {
  json,
  err,
  newId,
  nowIso,
  readJson,
  str,
} from "@/server/api-helpers";

export const runtime = "nodejs";

/** Host: create a theme in a topic. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  if (!viewer.member.is_host) {
    return err("Only the host can manage themes", 403);
  }

  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);
  const topicId = str(body.topicId);
  if (!topicId) return err("topicId is required", 400);
  const title = str(body.title).trim().slice(0, THEME_TITLE_MAX) || "New theme";

  const theme = await getDb().createTheme({
    id: newId(),
    session_id: id,
    topic_id: topicId,
    title,
    created_at: nowIso(),
  });

  publishSession(id);
  return json(
    { theme: { id: theme.id, topicId: theme.topic_id, title: theme.title } },
    201
  );
}
