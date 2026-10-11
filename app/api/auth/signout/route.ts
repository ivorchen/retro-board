import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/auth/session";
import { appUrl } from "@/server/auth/app-url";

export const runtime = "nodejs";

/** Sign out: clear the session cookie and redirect home. */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(appUrl("/"), 303);
  clearSessionCookie(res);
  return res;
}
