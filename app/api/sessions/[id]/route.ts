import { NextRequest } from "next/server";
import { resolveViewer, getSessionState } from "@/server/session";
import { json, err } from "@/server/api-helpers";

export const runtime = "nodejs";

/** Full serialized session state for the requesting member. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  const state = await getSessionState(id, viewer.member.id);
  return json(state);
}
