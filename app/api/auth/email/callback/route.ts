import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db/index";
import { signJwt } from "@/server/auth/jwt";
import { setSessionCookie } from "@/server/auth/session";
import { newId, nowIso, sha256, clearCookie } from "@/server/api-helpers";
import { appUrl } from "@/server/auth/app-url";

export const runtime = "nodejs";

/**
 * Magic-link callback: atomically consume the token, upsert the user by
 * email, sign a 30-day JWT, set the session cookie, and redirect to the
 * saved `rb_next` path (or /dashboard).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const fail = () =>
    NextResponse.redirect(appUrl("/login?error=invalid_token"), 307);
  if (!token) return fail();

  const db = getDb();
  const row = await db.consumeEmailToken(sha256(token), nowIso());
  if (!row) return fail();

  let user = await db.getUserByEmail(row.email);
  if (!user) {
    user = await db.createUser({
      id: newId(),
      email: row.email,
      github_id: null,
      name: row.email.split("@")[0],
      avatar_url: null,
      created_at: nowIso(),
    });
  }

  const jwt = await signJwt(
    { sub: user.id, email: user.email, name: user.name },
    "30d"
  );
  const nextRaw = req.cookies.get("rb_next")?.value;
  const next =
    nextRaw && nextRaw.startsWith("/") ? nextRaw : "/dashboard";
  const res = NextResponse.redirect(appUrl(next), 307);
  setSessionCookie(res, jwt);
  clearCookie(res, "rb_next");
  return res;
}
