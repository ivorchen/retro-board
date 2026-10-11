"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Github, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const router = useRouter();
  const { next: nextParam } = React.use(searchParams);
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/dashboard";

  const [checking, setChecking] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [devLink, setDevLink] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user: { id: string } | null } | null) => {
        if (cancelled) return;
        if (data && data.user) router.replace(next);
        else setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [next, router]);

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
      setSent(true);
    } catch {
      setError("Couldn't send the magic link — please try again.");
    } finally {
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
      <div className="glass-strong w-full max-w-[420px] rounded-3xl p-7">
        <Link
          href="/"
          className="font-mono text-[11px] font-medium tracking-widest text-violet-600 uppercase hover:underline dark:text-violet-300"
        >
          ← Retro Board
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Log in
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Host retros and keep them in your dashboard.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-rose-300/50 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-700 dark:text-rose-300"
          >
            {error}
          </p>
        )}

        {sent ? (
          <div className="mt-6 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            <strong className="font-semibold text-slate-900 dark:text-white">
              Check your inbox.
            </strong>{" "}
            We sent a magic link to{" "}
            <span className="font-medium">{email.trim()}</span>.
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
        ) : (
          <>
            <div className="mt-6 grid gap-2.5">
              <Button asChild className="min-h-[46px] rounded-2xl">
                <a href={`/api/auth/github?next=${encodeURIComponent(next)}`}>
                  <Github className="size-4" aria-hidden="true" />
                  Continue with GitHub
                </a>
              </Button>
            </div>

            <div className="my-5 flex items-center gap-3 text-[11px] font-medium tracking-wider text-slate-400 uppercase dark:text-slate-500">
              <span
                className="h-px flex-1 bg-slate-300/50 dark:bg-white/10"
                aria-hidden="true"
              />
              or
              <span
                className="h-px flex-1 bg-slate-300/50 dark:bg-white/10"
                aria-hidden="true"
              />
            </div>

            <form onSubmit={sendMagicLink} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="login-email">Email address</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="glass-soft min-h-[44px] rounded-2xl"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={busy}
                className="glass-btn min-h-[44px] rounded-2xl"
              >
                <Mail className="size-4" aria-hidden="true" />
                {busy ? "Sending…" : "Email me a magic link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
