import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import type { ActionPatch } from "@/server/db/types";
import { NOTE_MAX } from "@/lib/types";
import { json, err, readJson, str } from "@/server/api-helpers";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Update an action item (member). */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; actionId: string }> }
) {
  const { id, actionId } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);

  const db = getDb();
  const action = await db.getActionById(actionId);
  if (!action || action.session_id !== id) return err("Action not found", 404);

  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);

  const patch: ActionPatch = {};
  if (body.title !== undefined) {
    const title = str(body.title).trim();
    if (title.length < 1 || title.length > NOTE_MAX) {
      return err(`Action must be 1–${NOTE_MAX} characters`, 400);
    }
    patch.title = title;
  }
  if (body.owner_alias !== undefined) {
    patch.owner_alias = str(body.owner_alias).trim().slice(0, 80);
  }
  if (body.due_date !== undefined) {
    const d = body.due_date;
    if (d === null || d === "") {
      patch.due_date = null;
    } else if (typeof d === "string" && DATE_RE.test(d)) {
      patch.due_date = d;
    } else {
      return err("due_date must be YYYY-MM-DD or null", 400);
    }
  }
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") {
      return err("done must be a boolean", 400);
    }
    patch.done = body.done ? 1 : 0;
  }

  const updated = (await db.updateAction(actionId, patch)) ?? action;
  publishSession(id);
  return json({
    action: {
      id: updated.id,
      text: updated.title,
      owner: updated.owner_alias,
      date: updated.due_date ?? "",
      done: updated.done === 1,
      themeId: updated.theme_id,
    },
  });
}
