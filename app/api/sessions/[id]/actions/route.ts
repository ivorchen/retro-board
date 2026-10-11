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
} from "@/server/api-helpers";

export const runtime = "nodejs";

/** Create an action item (member). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);

  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);
  const text = str(body.text).trim();
  if (text.length < 1 || text.length > NOTE_MAX) {
    return err(`Action must be 1–${NOTE_MAX} characters`, 400);
  }

  const db = getDb();
  let themeId: string | null = null;
  const themeIdRaw = str(body.themeId);
  if (themeIdRaw) {
    const theme = await db.getThemeById(themeIdRaw);
    if (!theme || theme.session_id !== id) return err("Theme not found", 404);
    themeId = theme.id;
  }

  const action = await db.createAction({
    id: newId(),
    session_id: id,
    theme_id: themeId,
    title: text,
    owner_alias: "",
    due_date: null,
    done: 0,
    created_at: nowIso(),
  });

  publishSession(id);
  return json(
    {
      action: {
        id: action.id,
        text: action.title,
        owner: "",
        date: "",
        done: false,
        themeId,
      },
    },
    201
  );
}
