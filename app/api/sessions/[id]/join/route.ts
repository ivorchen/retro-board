import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { setAnonCookie } from "@/server/auth/session";
import { publishSession } from "@/server/realtime";
import {
  json,
  err,
  newId,
  nowIso,
  sha256,
  readJson,
  str,
} from "@/server/api-helpers";

export const runtime = "nodejs";

/**
 * Join a session. Idempotent: existing members get their memberId/alias.
 * Signed-in users are linked by user_id (no cookie); anonymous members get
 * a join token whose hash is stored and whose raw value rides in an
 * httpOnly anon cookie.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const db = getDb();
  const session = await db.getSessionById(id);
  if (!session) return err("Session not found", 404);

  const viewer = await resolveViewer(id, req);
  if (viewer.member) {
    return json({ memberId: viewer.member.id, alias: viewer.member.alias });
  }

  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);

  const mode = body.mode === "named" ? "named" : "anonymous";
  const displayName = str(body.displayName).trim();
  const count = await db.countMembers(id);
  const alias =
    mode === "named" && displayName
      ? displayName.slice(0, 40)
      : `Member ${count + 1}`;

  let joinTokenHash: string | null = null;
  let anonToken: string | null = null;
  if (!viewer.user) {
    anonToken = randomBytes(32).toString("hex");
    joinTokenHash = sha256(anonToken);
  }

  const member = await db.createMember({
    id: newId(),
    session_id: id,
    user_id: viewer.user ? viewer.user.id : null,
    display_name: mode === "named" ? displayName.slice(0, 40) : null,
    alias,
    is_host: 0,
    is_anonymous: mode === "named" ? 0 : 1,
    join_token_hash: joinTokenHash,
    joined_at: nowIso(),
  });

  const res = json({ memberId: member.id, alias: member.alias });
  if (anonToken) setAnonCookie(res, anonToken);
  publishSession(id);
  return res;
}
