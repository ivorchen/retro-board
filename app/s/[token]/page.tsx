"use client";

import * as React from "react";
import Link from "next/link";
import { SessionBoard } from "@/components/session-board";
import { JoinCard } from "@/components/join-card";
import { ThemeToggle } from "@/components/theme-toggle";
import type { SerializedSession } from "@/lib/types";

type Phase =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "join"; title: string }
  | { kind: "ready"; sessionId: string; initial: SerializedSession }
  | { kind: "error"; message: string };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="glass mx-auto w-full max-w-[720px] animate-pulse rounded-3xl p-6">
      <div className="h-7 w-2/3 rounded-xl bg-slate-300/40 dark:bg-white/10" />
      <div className="mt-3 h-4 w-1/2 rounded-xl bg-slate-300/30 dark:bg-white/5" />
      <div className="mt-6 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-36 rounded-2xl bg-slate-300/25 dark:bg-white/5"
          />
        ))}
      </div>
    </div>
  );
}

export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = React.use(params);
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const byToken = await fetch(`/api/sessions/by-token/${token}`, {
          credentials: "include",
        });
        if (byToken.status === 404) {
          if (!cancelled) setPhase({ kind: "not-found" });
          return;
        }
        if (!byToken.ok) throw new Error(`lookup ${byToken.status}`);
        const info = (await byToken.json()) as {
          id: string;
          title: string;
          status: string;
        };
        const session = await fetch(`/api/sessions/${info.id}`, {
          credentials: "include",
        });
        if (session.status === 401) {
          if (!cancelled) setPhase({ kind: "join", title: info.title });
          return;
        }
        if (!session.ok) throw new Error(`session ${session.status}`);
        const initial = (await session.json()) as SerializedSession;
        if (!cancelled)
          setPhase({ kind: "ready", sessionId: info.id, initial });
      } catch {
        if (!cancelled)
          setPhase({
            kind: "error",
            message: "Couldn't load this retro — check your connection and try again.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (phase.kind === "ready")
    return <SessionBoard sessionId={phase.sessionId} initial={phase.initial} />;

  return (
    <Shell>
      {phase.kind === "loading" && <Skeleton />}
      {phase.kind === "join" && <JoinCard token={token} title={phase.title} />}
      {phase.kind === "not-found" && (
        <div className="glass-strong mx-auto w-full max-w-[440px] rounded-3xl p-7 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Retro not found
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            This share link doesn&rsquo;t match any session. It may have been
            deleted, or the link may be incomplete.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
          >
            Go home
          </Link>
        </div>
      )}
      {phase.kind === "error" && (
        <div className="glass-strong mx-auto w-full max-w-[440px] rounded-3xl p-7 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {phase.message}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500"
          >
            Try again
          </button>
        </div>
      )}
    </Shell>
  );
}
