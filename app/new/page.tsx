"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TITLE_MAX } from "@/lib/types";

export default function NewSessionPage() {
  const router = useRouter();
  const [checking, setChecking] = React.useState(true);
  const [title, setTitle] = React.useState("Sprint retrospective");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user: { id: string } | null } | null) => {
        if (cancelled) return;
        if (!data || !data.user) router.replace("/login?next=/new");
        else setChecking(false);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login?next=/new");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed.slice(0, TITLE_MAX) }),
      });
      if (res.status !== 201) throw new Error(`create ${res.status}`);
      const data = (await res.json()) as { id: string; shareToken: string };
      router.push(`/s/${data.shareToken}`);
    } catch {
      setError("Couldn't create the session — please try again.");
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="glass h-10 w-10 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="glass-strong w-full max-w-[480px] rounded-3xl p-7">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          New retro session
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          You&rsquo;ll join as the host. Everyone else joins from the share
          link — anonymously, no account needed.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-rose-300/50 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-700 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        <form onSubmit={create} className="mt-6 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="new-title">Session title</Label>
            <Input
              id="new-title"
              required
              maxLength={TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sprint retrospective"
              className="glass-soft min-h-[46px] rounded-2xl"
            />
          </div>
          <Button
            type="submit"
            disabled={busy || !title.trim()}
            className="min-h-[46px] rounded-2xl"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {busy ? "Creating…" : "Create session"}
          </Button>
        </form>
      </div>
    </div>
  );
}
