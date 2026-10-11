import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { parseSettings } from "@/server/db/types";
import { REVIEW_SECONDS, WRITE_SECONDS } from "@/lib/types";
import { json, err, readJson, str } from "@/server/api-helpers";

export const runtime = "nodejs";

/** Host: start / pause / reset the round timer. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  if (!viewer.member.is_host) {
    return err("Only the host can control the timer", 403);
  }

  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);
  const op = str(body.op);
  const secondsRaw = body.seconds;
  const seconds =
    typeof secondsRaw === "number" && Number.isFinite(secondsRaw)
      ? Math.floor(secondsRaw)
      : undefined;
  if (seconds !== undefined && (seconds < 0 || seconds > 86400)) {
    return err("seconds must be between 0 and 86400", 400);
  }

  const db = getDb();
  const session = await db.getSessionById(id);
  if (!session) return err("Session not found", 404);

  const settings = parseSettings(session.settings);
  const timer = settings.timer;

  if (op === "start") {
    const s = seconds ?? timer.seconds;
    settings.timer = {
      endsAt: new Date(Date.now() + s * 1000).toISOString(),
      seconds: s,
      running: true,
    };
  } else if (op === "pause") {
    const remaining = timer.endsAt
      ? Math.max(
          0,
          Math.round((new Date(timer.endsAt).getTime() - Date.now()) / 1000)
        )
      : timer.seconds;
    settings.timer = { endsAt: null, seconds: remaining, running: false };
  } else if (op === "reset") {
    const s =
      seconds ??
      (session.current_phase === "review" ? REVIEW_SECONDS : WRITE_SECONDS);
    settings.timer = { endsAt: null, seconds: s, running: false };
  } else {
    return err("Unknown operation", 400);
  }

  await db.updateSession(id, { settings: JSON.stringify(settings) });
  publishSession(id);
  return json({ timer: settings.timer });
}
