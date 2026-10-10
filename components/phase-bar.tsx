"use client";

import { Check } from "lucide-react";
import { COLUMNS, COLUMN_ORDER } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { RetroBoard } from "@/hooks/use-retro-board";

export function PhaseBar({ board }: { board: RetroBoard }) {
  const { state } = board;
  const review = state.stage === "review";
  const stageName =
    state.stage === "write" ? "Write" : state.stage === "group" ? "Group" : "Vote";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 max-sm:block">
      <span className="font-mono text-[11px] font-medium tracking-widest text-slate-500 uppercase dark:text-slate-400 max-sm:mb-2 max-sm:block">
        Topic
      </span>
      <div
        className="flex flex-wrap gap-1.5 max-sm:grid max-sm:grid-cols-3"
        aria-label="Retrospective topics"
      >
        {COLUMN_ORDER.map((key, i) => {
          const isActive = !review && i === state.currentRound;
          const isComplete = review || i < state.currentRound;
          return (
            <button
              key={key}
              type="button"
              disabled
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                isActive &&
                  "border border-violet-300/60 bg-white/70 text-slate-900 shadow-[0_2px_12px_rgba(139,92,246,0.25),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-white dark:shadow-[0_2px_12px_rgba(139,92,246,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]",
                !isActive &&
                  isComplete &&
                  "border border-transparent text-slate-600 dark:text-slate-300",
                !isActive &&
                  !isComplete &&
                  "cursor-default text-slate-400 opacity-60 dark:text-slate-500"
              )}
            >
              {isComplete && !isActive ? (
                <Check className="size-3.5 text-emerald-500" aria-hidden="true" />
              ) : (
                <span className="font-mono text-[10px] opacity-70 max-sm:hidden">
                  0{i + 1}
                </span>
              )}
              {COLUMNS[key].title}
            </button>
          );
        })}
      </div>
      <div className="ml-auto text-xs text-slate-500 max-sm:hidden dark:text-slate-400">
        {review
          ? "All topics complete · Review & act"
          : `Round ${state.currentRound + 1} of 3 · ${stageName}`}
      </div>
    </div>
  );
}
