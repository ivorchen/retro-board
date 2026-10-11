import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { json, err } from "@/server/api-helpers";

export const runtime = "nodejs";

/** Public: resolve a share token to session id/title/status. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const s = await getDb().getSessionByToken(token);
  if (!s) return err("Session not found", 404);
  return json({ id: s.id, title: s.title, status: s.status });
}
