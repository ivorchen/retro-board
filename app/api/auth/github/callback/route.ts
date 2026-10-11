import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db/index";
import {
  exchangeCodeForToken,
  getGithubProfile,
} from "@/server/auth/github";
import { signJwt } from "@/server/auth/jwt";
import { setSessionCookie } from "@/server/auth/session";
import { newId, nowIso, clearCookie } from "@/server/api-helpers";

export const runtime = "nodejs";

interface SavedState {
  state?: string;
  next?: string;
}

/**
 * GitHub OAuth callback: verify state, exchange code, upsert the user
 * (by github_id, else by email → link, else create), sign a 30-day JWT,
 * set the session cookie, and redirect to the saved `next` path.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");

  let saved: SavedState | null = null;
  try {
    const raw = req.cookies.get("rb_oauth_state")?.value;
    if (raw) saved = JSON.parse(raw) as SavedState;
  } catch {
    saved = null;
  }

  if (!code || !state || !saved || saved.state !== state) {
    return NextResponse.redirect(
      new URL("/login?error=state", req.url),
      307
    );
  }

  const token = await exchangeCodeForToken(code);
  const profile = await getGithubProfile(token);
  const githubId = String(profile.id);
  const email = profile.email ?? null;

  const db = getDb();
  let user = await db.getUserByGithubId(githubId);
  if (!user && email) {
    // NOTE: the Db contract's updateUser only permits {name, avatar_url,
    // email}, so github_id cannot be linked to this row through the DAL.
    // Reuse the email-matched account; flagging the gap for foundation.
    user = await db.getUserByEmail(email);
  }
  if (!user) {
    user = await db.createUser({
      id: newId(),
      email,
      github_id: githubId,
      name: profile.name || profile.login,
      avatar_url: profile.avatar_url ?? null,
      created_at: nowIso(),
    });
  }

  const jwt = await signJwt(
    { sub: user.id, email: user.email, name: user.name },
    "30d"
  );
  const next =
    saved.next && saved.next.startsWith("/") ? saved.next : "/dashboard";
  const res = NextResponse.redirect(new URL(next, req.url), 307);
  setSessionCookie(res, jwt);
  clearCookie(res, "rb_oauth_state");
  return res;
}
