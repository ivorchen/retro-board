/**
 * HS256 JWT helpers for session tokens.
 *
 * Edge-runtime safe: uses only `jose` + `TextEncoder` (no node:crypto),
 * so this module can be imported from `middleware.ts`.
 */

import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export interface JwtPayload {
  sub: string;
  email: string | null;
  name: string;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signJwt(
  p: { sub: string; email: string | null; name: string },
  expiresIn: string | number
): Promise<string> {
  const key = getSecret();
  return await new SignJWT({ email: p.email, name: p.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

/** Verifies a session token. Returns null on ANY failure (bad signature,
 *  expired, malformed, missing AUTH_SECRET — never throws). */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}
