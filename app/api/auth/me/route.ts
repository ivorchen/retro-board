import { NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { json } from "@/server/api-helpers";

export const runtime = "nodejs";

/** Current signed-in user, or null. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  return json({
    user: user ? { id: user.id, email: user.email, name: user.name } : null,
  });
}
