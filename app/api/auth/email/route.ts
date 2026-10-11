import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import {
  newEmailToken,
  buildMagicLink,
  sendMagicLink,
} from "@/server/auth/email";
import { getAppUrl } from "@/server/auth/github";
import {
  json,
  err,
  nowIso,
  readJson,
  str,
  setShortCookie,
} from "@/server/api-helpers";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Request a magic link: create a hashed, 15-minute single-use token and
 * email the link. Always returns {ok:true} so addresses can't be probed.
 */
export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (!body) return err("Invalid request body", 400);

  const email = str(body.email).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return err("Invalid email address", 400);

  const { raw, hash } = newEmailToken();
  await getDb().createEmailToken({
    token_hash: hash,
    email,
    user_id: null,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    created_at: nowIso(),
  });

  const link = buildMagicLink(raw);
  await sendMagicLink(email, link);

  const data: { ok: true; devLink?: string } = { ok: true };
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(getAppUrl())) {
    data.devLink = link;
  }

  const res = json(data);
  const next = str(body.next);
  if (next.startsWith("/")) {
    setShortCookie(res, "rb_next", next, 600);
  }
  return res;
}
