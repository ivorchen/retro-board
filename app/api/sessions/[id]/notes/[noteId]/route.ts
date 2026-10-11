import { NextRequest } from "next/server";
import { getDb } from "@/server/db/index";
import { resolveViewer } from "@/server/session";
import { publishSession } from "@/server/realtime";
import { NOTE_MAX } from "@/lib/types";
import {
  json,
  err,
  readJson,
  str,
} from "@/server/api-helpers";
import { toNote } from "@/server/api-helpers";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

/** Edit a note: the author or the host. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, noteId } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);

  const db = getDb();
  const card = await db.getCardById(noteId);
  if (!card || card.session_id !== id) return err("Note not found", 404);
  if (card.member_id !== viewer.member.id && !viewer.member.is_host) {
    return err("Only the author or host can edit this note", 403);
  }

  const body = await readJson(req);
  const content = body ? str(body.content).trim() : "";
  if (content.length < 1 || content.length > NOTE_MAX) {
    return err(`Note must be 1–${NOTE_MAX} characters`, 400);
  }

  const updated = (await db.updateCardContent(noteId, content)) ?? card;
  publishSession(id);
  return json({ note: toNote(updated, viewer.member.id) });
}

/** Delete a note: the author or the host. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { id, noteId } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);

  const db = getDb();
  const card = await db.getCardById(noteId);
  if (!card || card.session_id !== id) return err("Note not found", 404);
  if (card.member_id !== viewer.member.id && !viewer.member.is_host) {
    return err("Only the author or host can delete this note", 403);
  }

  await db.deleteCard(noteId);
  publishSession(id);
  return json({ ok: true });
}
