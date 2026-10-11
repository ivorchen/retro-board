/**
 * Email magic-link helpers.
 *
 * The raw token goes to the user's inbox (embedded in the link); only the
 * sha256 hash is stored in the DB, so a database leak never yields usable
 * tokens. Consumption is atomic via `Db.consumeEmailToken`.
 */

import { createHash, randomBytes } from "node:crypto";
import { getAppUrl } from "./github";

export function newEmailToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function buildMagicLink(raw: string): string {
  return `${getAppUrl()}/api/auth/email/callback?token=${encodeURIComponent(raw)}`;
}

// ---------------------------------------------------------------------------
// PRODUCTION SEAM: local dev has no email provider, so this default
// implementation just logs the link. Swap it for Resend/SMTP before
// shipping to production — keep the named export signature unchanged.
// ---------------------------------------------------------------------------
export async function sendMagicLink(
  email: string,
  link: string
): Promise<void> {
  console.log(`[auth] magic link for ${email}: ${link}`);
}
