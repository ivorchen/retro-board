import { NextRequest, NextResponse } from "next/server";
import { resolveViewer, getSessionState } from "@/server/session";
import { subscribeSession } from "@/server/realtime";
import { err } from "@/server/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-sent events for a session: pushes the current serialized state
 * immediately, then re-pushes on every publishSession(sessionId). A `: ping`
 * comment every 25s keeps idle connections alive.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const viewer = await resolveViewer(id, req);
  if (!viewer.member) return err("Unauthorized", 401);
  const memberId = viewer.member.id;

  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(
            encoder.encode(`event: state\ndata: ${payload}\n\n`)
          );
        } catch {
          // Stream already closed; ignore.
        }
      };

      const pushState = () => {
        getSessionState(id, memberId)
          .then((state) => send(JSON.stringify(state)))
          .catch(() => {
            // Transient failure; the next publish will retry.
          });
      };

      // subscribeSession notifies with no payload; re-fetch and push state.
      unsubscribe = subscribeSession(id, pushState);
      pushState();

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // Stream already closed; ignore.
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed; ignore.
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
