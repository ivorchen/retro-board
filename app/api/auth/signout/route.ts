import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth/session";

export const runtime = "nodejs";

/** Sign out: clear the session cookie and redirect home. */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  clearSessionCookie(res);
  return res;
}
