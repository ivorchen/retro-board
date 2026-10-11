/**
 * Session & anonymous-identity cookie helpers.
 *
 * The `cookie` header is parsed manually (no NextRequest dependency) so these
 * helpers work with plain `Request` objects too. Responses use NextResponse's
 * cookie jar (`res.cookies.set`).
 */

import { NextResponse } from "next/server";
import { verifyJwt } from "./jwt";

export const SESSION_COOKIE = "rb_session";
export const ANON_COOKIE = "rb_anon";
export const OAUTH_STATE_COOKIE = "rb_oauth_state";
export const NEXT_COOKIE = "rb_next";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string;
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const ANON_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

interface CookieOpts {
  maxAge?: number;
  httpOnly?: boolean;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
}

export function setCookie(
  res: NextResponse,
  name: string,
  value: string,
  opts: CookieOpts = {}
): void {
  res.cookies.set(name, value, {
    httpOnly: opts.httpOnly ?? true,
    path: opts.path ?? "/",
    maxAge: opts.maxAge,
    sameSite: opts.sameSite ?? "lax",
    secure: opts.secure ?? process.env.NODE_ENV === "production",
  });
}

/** Reads the rb_session cookie and verifies the JWT inside. */
export async function getSessionUser(
  req: Request
): Promise<SessionUser | null> {
  const token = getCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const payload = await verifyJwt(token);
  if (!payload) return null;
  return { id: payload.sub, email: payload.email, name: payload.name };
}

/** Signed session JWT cookie: httpOnly, 30 days, secure in production. */
export function setSessionCookie(res: NextResponse, token: string): void {
  setCookie(res, SESSION_COOKIE, token, { maxAge: SESSION_MAX_AGE });
}

export function clearSessionCookie(res: NextResponse): void {
  setCookie(res, SESSION_COOKIE, "", { maxAge: 0 });
}

/** Anonymous identity cookie: httpOnly, 1 year, SameSite lax. */
export function setAnonCookie(res: NextResponse, token: string): void {
  setCookie(res, ANON_COOKIE, token, { maxAge: ANON_MAX_AGE });
}

export function getAnonToken(req: Request): string | undefined {
  return getCookie(req, ANON_COOKIE);
}
