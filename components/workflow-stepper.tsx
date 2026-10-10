"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetroBoard } from "@/hooks/use-retro-board";

const STEPS = [
  { key: "write", title: "Write", hint: "5 minutes, one thought per note" },
  { key: "group", title: "Group", hint: "Review and correct automatic themes" },
  { key: "vote", title: "Vote", hint: "Results reveal after everyone finishes" },
] as const;

export function WorkflowStepper({ board }: { board: RetroBoard }) {
  const { state } = board;
  if (state.stage === "review") return null;
  const order = ["write", "group", "vote"];
  const current = order.indexOf(state.stage);

  return (
    <section
      aria-label="Steps for this topic"
      className="glass mb-4 overflow-hidden rounded-2xl"
    >
      <ol className="grid list-none grid-cols-3 max-sm:grid-cols-1">
        {STEPS.map((step, i) => {
          const isActive = step.key === state.stage;
          const isComplete = current > i;
          return (
            <li
              key={step.key}
              className={cn(
                "relative flex min-w-0 items-center gap-3 px-4 py-3 transition-colors",
                "border-white/40 max-sm:border-t max-sm:first:border-t-0 sm:border-l sm:first:border-l-0 dark:border-white/10",
                isActive &&
                  "bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-transparent"
              )}
            >
              <span
                className={cn(
                  "grid size-[26px] flex-none place-items-center rounded-full border font-mono text-[11px] font-semibold transition-all",
                  isComplete
                    ? "border-emerald-400/60 bg-emerald-400/80 text-white shadow-[0_2px_8px_rgba(52,211,153,0.4)]"
                    : isActive
                      ? "border-violet-400/60 bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_2px_12px_rgba(139,92,246,0.45)]"
                      : "border-slate-300/70 bg-white/50 text-slate-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-400"
                )}
              >
                {isComplete ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="min-w-0">
                <strong
                  className={cn(
                    "block text-[13px]",
                    isActive
                      ? "text-slate-900 dark:text-white"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  {step.title}
                </strong>
                <small
                  className={cn(
                    "mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400",
                    !isActive && !isComplete && "max-sm:hidden"
                  )}
                >
                  {step.hint}
                </small>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
