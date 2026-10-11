import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getGithubAuthUrl } from "@/server/auth/github";
import { setShortCookie } from "@/server/api-helpers";

export const runtime = "nodejs";

/**
 * Begin GitHub OAuth: stash {state, next} in a short-lived httpOnly cookie,
 * then redirect to GitHub's authorize URL.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("next") || "/dashboard";
  const next = raw.startsWith("/") ? raw : "/dashboard";
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getGithubAuthUrl(state), 307);
  setShortCookie(
    res,
    "rb_oauth_state",
    JSON.stringify({ state, next }),
    600
  );
  return res;
}
