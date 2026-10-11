"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, LogOut, Plus, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SessionSummary {
  id: string;
  title: string;
  status: string;
  shareToken: string;
  createdAt: string;
  memberCount: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

function SessionCard({ session }: { session: SessionSummary }) {
  const [copied, setCopied] = React.useState(false);
  const shareUrl = `/s/${session.shareToken}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${shareUrl}`
      );
    } catch {
      // Clipboard unavailable (permissions, non-secure context); the visible
      // link below is the fallback.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <article className="glass flex flex-col rounded-3xl p-5">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 text-[16px] font-bold tracking-tight break-words text-slate-900 dark:text-white">
          {session.title}
        </h2>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 rounded-full font-mono text-[10px] tracking-wider uppercase",
            session.status === "active"
              ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "text-slate-500 dark:text-slate-400"
          )}
        >
          {session.status}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{formatDate(session.createdAt)}</span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" aria-hidden="true" />
          {session.memberCount}{" "}
          {session.memberCount === 1 ? "member" : "members"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 pt-1">
        <Button asChild size="sm" className="rounded-2xl">
          <Link href={shareUrl}>Open</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={copyLink}
          className="glass-btn rounded-2xl"
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </article>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [userName, setUserName] = React.useState<string | null>(null);
  const [sessions, setSessions] = React.useState<SessionSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch("/api/auth/me", { credentials: "include" });
        const meData = me.ok
          ? ((await me.json()) as { user: { name: string } | null })
          : null;
        if (!meData || !meData.user) {
          router.replace("/login?next=/dashboard");
          return;
        }
        if (cancelled) return;
        setUserName(meData.user.name);
        const res = await fetch("/api/sessions", { credentials: "include" });
        if (!res.ok) throw new Error(`sessions ${res.status}`);
        const data = (await res.json()) as { sessions: SessionSummary[] };
        if (!cancelled) setSessions(data.sessions);
      } catch {
        if (!cancelled) setError("Couldn't load your retros — try refreshing.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Cookie may already be gone; still head home.
    }
    router.push("/");
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/50 bg-white/55 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/45">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-[0_2px_12px_rgba(139,92,246,0.45)]">
              R
            </span>
            <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">
              Retro Board
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="rounded-2xl text-slate-600 dark:text-slate-300"
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="max-sm:hidden">Sign out</span>
            </Button>
            <Button asChild size="sm" className="rounded-2xl">
              <Link href="/new">
                <Plus className="size-4" aria-hidden="true" />
                New retro
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 pt-8 pb-16 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {userName ? `Welcome back, ${userName}` : "Your retros"}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Sessions you host. Share the link and the team joins anonymously.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-rose-300/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        {sessions === null && !error ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="glass h-40 animate-pulse rounded-3xl"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        ) : (
          !error && (
            <div className="glass mt-8 rounded-3xl p-10 text-center">
              <p className="text-[15px] font-semibold text-slate-900 dark:text-white">
                No retros yet
              </p>
              <p className="mx-auto mt-1.5 max-w-[380px] text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Create your first session and share the link — the team can
                join anonymously, no accounts needed.
              </p>
              <Button asChild className="mt-5 rounded-2xl">
                <Link href="/new">
                  <Plus className="size-4" aria-hidden="true" />
                  New retro
                </Link>
              </Button>
            </div>
          )
        )}
      </main>
    </div>
  );
}
