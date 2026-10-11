import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { json, err, readJson, str } from "@/server/api-helpers";

export const runtime = "nodejs";

/** Host: move a note into a theme (same session, same topic). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; themeId: string }> }
) {
  const { id, themeId } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  if (!viewer.member.is_host) {
    return err("Only the host can manage themes", 403);
  }

  const body = await readJson(req);
  const cardId = body ? str(body.cardId) : "";
  if (!cardId) return err("cardId is required", 400);

  const db = getDb();
  const theme = await db.getThemeById(themeId);
  if (!theme || theme.session_id !== id) return err("Theme not found", 404);
  const card = await db.getCardById(cardId);
  if (!card || card.session_id !== id) return err("Note not found", 404);
  if (card.topic_id !== theme.topic_id) {
    return err("Note and theme must be in the same column", 400);
  }

  await db.removeCardFromThemes(id, cardId);
  const themeCards = await db.listThemeCards(id);
  const ids = themeCards
    .filter((tc) => tc.theme_id === themeId)
    .map((tc) => tc.card_id);
  if (!ids.includes(cardId)) ids.push(cardId);
  await db.setThemeCards(themeId, ids);

  publishSession(id);
  return json({ ok: true });
}
