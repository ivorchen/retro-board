import { NextResponse } from "next/server";
import { randomBytes, createHash, randomUUID } from "node:crypto";

/** JSON response helper. */
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Error envelope: { error: message }. */
export function err(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** New UUID string (crypto.randomUUID). */
export function newId(): string {
  return randomUUID();
}

/** Current time as ISO-8601 UTC string. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** 12-char URL-safe share token. */
export function newShareToken(): string {
  return randomBytes(9).toString("base64url");
}

/** Hex SHA-256 digest (for tokens stored at rest). */
export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Parse a JSON request body; null on invalid/empty/non-object body. */
export async function readJson(
  req: Request
): Promise<Record<string, unknown> | null> {
  try {
    const v = (await req.json()) as unknown;
    return typeof v === "object" && v !== null
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Coerce an unknown value to string ("" for non-strings). */
export function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Parse the session topics JSON blob; [] on invalid input. */
export function parseTopics(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** Set a short-lived httpOnly cookie on a response. */
export function setShortCookie(
  res: NextResponse,
  name: string,
  value: string,
  maxAgeSeconds = 600
): void {
  res.cookies.set(name, value, {
    httpOnly: true,
    maxAge: maxAgeSeconds,
    path: "/",
    sameSite: "lax",
  });
}

/** Clear a cookie (matches the path used when setting). */
export function clearCookie(res: NextResponse, name: string): void {
  res.cookies.set(name, "", { maxAge: 0, path: "/" });
}

/** Map a card row to the public note shape (no identity leakage). */
export function toNote(
  card: { id: string; topic_id: string; content: string; member_id: string | null; created_at: string },
  authorFallbackId: string
) {
  return {
    id: card.id,
    column: card.topic_id,
    text: card.content,
    votes: 0,
    authorId: card.member_id ?? authorFallbackId,
    created: card.created_at,
  };
}
