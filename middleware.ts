/**
 * Edge middleware: protects authenticated pages.
 *
 * Only edge-safe imports here (next/server + server/auth/jwt, which uses
 * only jose + TextEncoder). verifyJwt returns null on ANY failure — including
 * a missing AUTH_SECRET — so both cases deny with a redirect to /login.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyJwt } from "./server/auth/jwt";
import { appUrl } from "./server/auth/app-url";

export const config = {
  matcher: ["/dashboard/:path*", "/new/:path*"],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("rb_session")?.value;
  if (!token) {
    return NextResponse.redirect(appUrl("/login"));
  }
  const payload = await verifyJwt(token);
  if (!payload) {
    return NextResponse.redirect(appUrl("/login"));
  }
  return NextResponse.next();
}
