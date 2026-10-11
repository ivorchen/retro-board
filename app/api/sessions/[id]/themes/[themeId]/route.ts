import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { THEME_TITLE_MAX } from "@/lib/types";
import { json, err, readJson, str } from "@/server/api-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; themeId: string }> };

/** Host: rename a theme. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, themeId } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  if (!viewer.member.is_host) {
    return err("Only the host can manage themes", 403);
  }

  const db = getDb();
  const theme = await db.getThemeById(themeId);
  if (!theme || theme.session_id !== id) return err("Theme not found", 404);

  const body = await readJson(req);
  const title = body ? str(body.title).trim() : "";
  if (title.length < 1 || title.length > THEME_TITLE_MAX) {
    return err(`Title must be 1–${THEME_TITLE_MAX} characters`, 400);
  }

  const updated = (await db.renameTheme(themeId, title)) ?? theme;
  publishSession(id);
  return json({
    theme: { id: updated.id, topicId: updated.topic_id, title: updated.title },
  });
}
