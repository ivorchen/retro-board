/**
 * In-process pub/sub for session updates.
 *
 * This works because the app runs as a single Node.js process: SSE route
 * handlers subscribe per session and mutation handlers publish after writes.
 *
 * If the app ever scales to multiple server instances, replace this module
 * with a Postgres LISTEN/NOTIFY (or Redis pub/sub) adapter behind the same
 * interface — subscribeSession / publishSession — without touching callers.
 */

type Listener = () => void;

/**
 * Channel registry lives on globalThis (not module scope) so it survives
 * Next.js dev-server module re-evaluation (HMR/Turbopack): a long-lived SSE
 * connection subscribed under one module instance must still be reachable
 * when a later request is served by a freshly evaluated copy of this module.
 * Same reason the DB handle is cached on globalThis in server/db/index.ts.
 */
const g = globalThis as unknown as {
  __rb_channels?: Map<string, Set<Listener>>;
};
function channels(): Map<string, Set<Listener>> {
  if (!g.__rb_channels) g.__rb_channels = new Map();
  return g.__rb_channels;
}

/** Subscribe to updates for a session. Returns an unsubscribe function. */
export function subscribeSession(
  sessionId: string,
  onUpdate: () => void
): () => void {
  const ch = channels();
  let set = ch.get(sessionId);
  if (!set) {
    set = new Set();
    ch.set(sessionId, set);
  }
  set.add(onUpdate);
  return () => {
    const current = ch.get(sessionId);
    if (current) {
      current.delete(onUpdate);
      if (current.size === 0) ch.delete(sessionId);
    }
  };
}

/** Notify all subscribers of a session. A failing listener is contained so
 *  it can't break the fan-out to the others. */
export function publishSession(sessionId: string): void {
  const set = channels().get(sessionId);
  if (!set) return;
  for (const fn of [...set]) {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  }
}
