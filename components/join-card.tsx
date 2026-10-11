"use client";

import * as React from "react";
import { Github, Mail, User, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type JoinMode = "choose" | "email" | "named" | "done-email";

export function JoinCard({ token, title }: { token: string; title: string }) {
  const [mode, setMode] = React.useState<JoinMode>("choose");
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [devLink, setDevLink] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const next = `/s/${token}`;

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/by-token/${token}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { id: string } | null) => {
        if (!cancelled && data) setSessionId(data.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const join = async (body: { mode: "anonymous" | "named"; displayName?: string }) => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`join ${res.status}`);
      window.location.reload();
    } catch {
      setError("Couldn't join — please try again.");
      setBusy(false);
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, next }),
      });
      if (!res.ok) throw new Error(`email ${res.status}`);
      const data = (await res.json()) as { ok: boolean; devLink?: string };
      setDevLink(data.devLink ?? null);
      setMode("done-email");
    } catch {
      setError("Couldn't send the magic link — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitNamed = (e: React.FormEvent) => {
    e.preventDefault();
    const name = displayName.trim();
    if (!name) return;
    void join({ mode: "named", displayName: name.slice(0, 40) });
  };

  return (
    <div className="glass-strong mx-auto w-full max-w-[440px] rounded-3xl p-7">
      <p className="font-mono text-[11px] font-medium tracking-widest text-violet-600 uppercase dark:text-violet-300">
        You&rsquo;re invited
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        Pick how you&rsquo;d like to join this retrospective. Your notes, votes,
        and identity stay anonymous to the team.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-rose-300/50 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      {mode === "done-email" ? (
        <div className="mt-6 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          <strong className="font-semibold text-slate-900 dark:text-white">
            Check your inbox.
          </strong>{" "}
          We sent a magic link to <span className="font-medium">{email.trim()}</span> —
          it brings you straight back here.
          {devLink && (
            <span className="mt-2 block">
              <a
                href={devLink}
                className="font-medium text-violet-700 underline underline-offset-2 dark:text-violet-300"
              >
                Open the dev sign-in link
              </a>
            </span>
          )}
        </div>
      ) : mode === "email" ? (
        <form onSubmit={sendMagicLink} className="mt-6 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="join-email">Email address</Label>
            <Input
              id="join-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="glass-soft min-h-[44px] rounded-2xl"
            />
          </div>
          <Button type="submit" disabled={busy} className="min-h-[44px] rounded-2xl">
            <Mail className="size-4" aria-hidden="true" />
            {busy ? "Sending…" : "Email me a magic link"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode("choose")}
            className="rounded-2xl"
          >
            Back
          </Button>
        </form>
      ) : mode === "named" ? (
        <form onSubmit={submitNamed} className="mt-6 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="join-name">Display name</Label>
            <Input
              id="join-name"
              required
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Alex"
              className="glass-soft min-h-[44px] rounded-2xl"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Shown to the team as your alias — never your email.
            </p>
          </div>
          <Button
            type="submit"
            disabled={busy || !sessionId}
            className="min-h-[44px] rounded-2xl"
          >
            <User className="size-4" aria-hidden="true" />
            {busy ? "Joining…" : "Join with this name"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode("choose")}
            className="rounded-2xl"
          >
            Back
          </Button>
        </form>
      ) : (
        <div className="mt-6 grid gap-2.5">
          <Button asChild className="min-h-[46px] rounded-2xl">
            <a href={`/api/auth/github?next=${encodeURIComponent(next)}`}>
              <Github className="size-4" aria-hidden="true" />
              Continue with GitHub
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={() => setMode("email")}
            className="glass-btn min-h-[46px] rounded-2xl"
          >
            <Mail className="size-4" aria-hidden="true" />
            Continue with email
          </Button>
          <div className="my-1 flex items-center gap-3 text-[11px] font-medium tracking-wider text-slate-400 uppercase dark:text-slate-500">
            <span className="h-px flex-1 bg-slate-300/50 dark:bg-white/10" aria-hidden="true" />
            Join without an account
            <span className="h-px flex-1 bg-slate-300/50 dark:bg-white/10" aria-hidden="true" />
          </div>
          <Button
            variant="outline"
            onClick={() => setMode("named")}
            disabled={!sessionId}
            className="glass-btn min-h-[46px] rounded-2xl"
          >
            <User className="size-4" aria-hidden="true" />
            Join with a display name
          </Button>
          <Button
            variant="ghost"
            onClick={() => void join({ mode: "anonymous" })}
            disabled={busy || !sessionId}
            className="min-h-[46px] rounded-2xl"
          >
            <UserX className="size-4" aria-hidden="true" />
            {busy ? "Joining…" : "Continue anonymously"}
          </Button>
        </div>
      )}
    </div>
  );
}
