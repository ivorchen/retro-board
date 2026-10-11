"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, EyeOff, ListChecks, Timer, Vote } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: EyeOff,
    title: "Anonymous by design",
    text: "Notes, themes, and votes never show who wrote them — only aliases like Member 3. Honest signal, no politics.",
  },
  {
    icon: Timer,
    title: "Guided rounds",
    text: "Write → Group → Vote for each topic, with a shared timer and automatic theme clustering the host can correct.",
  },
  {
    icon: Vote,
    title: "Blind voting",
    text: "Totals stay hidden until every member finishes voting, then reveal sorted by strength. Decisions become owned actions.",
  },
];

const STEPS = [
  {
    icon: ListChecks,
    kicker: "01 · Write",
    text: "Everyone writes quietly — one concrete thought per card, five minutes on the timer.",
  },
  {
    icon: ListChecks,
    kicker: "02 · Group",
    text: "Cards cluster into themes automatically; the host drags, renames, and tidies before voting.",
  },
  {
    icon: ListChecks,
    kicker: "03 · Vote",
    text: "Five votes each, totals hidden until everyone finishes. Top themes become action items with owners and dates.",
  },
];

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user: { id: string } | null } | null) => {
        if (!cancelled) setLoggedIn(Boolean(data && data.user));
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/50 bg-white/55 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/45">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3 px-4 py-3 sm:px-6">
          <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white shadow-[0_2px_12px_rgba(139,92,246,0.45)]">
            R
          </span>
          <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">
            Retro Board
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {loggedIn ? (
              <Button asChild className="rounded-2xl">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="glass-btn rounded-2xl">
                <Link href="/login">Log in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 pb-20 sm:px-6">
        {/* hero */}
        <section className="pt-16 pb-12 text-center sm:pt-24">
          <p className="font-mono text-[11px] font-medium tracking-widest text-violet-600 uppercase dark:text-violet-300">
            Anonymous team retrospectives
          </p>
          <h1 className="mx-auto mt-4 max-w-[720px] text-[clamp(34px,6vw,60px)] leading-[1.05] font-bold tracking-tight text-slate-900 dark:text-white">
            Retros your team will actually be honest in
          </h1>
          <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-slate-600 dark:text-slate-300">
            Guided Write → Group → Vote rounds, blind voting, and action items —
            with everyone anonymous and the whole session on one shareable link.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-2xl px-7">
              <Link href="/dashboard">
                Start a retro
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="glass-btn rounded-2xl px-7"
            >
              <a href="#how-it-works">How it works</a>
            </Button>
          </div>
        </section>

        {/* features */}
        <section className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="glass rounded-3xl p-6"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-violet-700 dark:text-violet-300">
                <f.icon className="size-5" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-[16px] font-bold tracking-tight text-slate-900 dark:text-white">
                {f.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {f.text}
              </p>
            </article>
          ))}
        </section>

        {/* how it works */}
        <section id="how-it-works" className="mt-16 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-[520px] text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            One round per topic — Went well, Could improve, Try next — then a
            review where the strongest themes become action items.
          </p>
          <ol className="mt-8 grid list-none gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.kicker} className="glass-soft rounded-3xl p-6">
                <p className="font-mono text-[11px] font-semibold tracking-widest text-violet-600 uppercase dark:text-violet-300">
                  {s.kicker}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {s.text}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* closing CTA */}
        <section className="glass mt-16 rounded-3xl p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Run your next retro in minutes
          </h2>
          <p className="mx-auto mt-2 max-w-[460px] text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Create a session, share the link, and let the rounds do the
            facilitation. Guests can join anonymously — no account needed.
          </p>
          <Button asChild size="lg" className="mt-6 rounded-2xl px-7">
            <Link href="/dashboard">
              Start a retro
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-white/50 py-6 dark:border-white/10">
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Retro Board · anonymous retrospectives with guided rounds
        </p>
      </footer>
    </div>
  );
}
