"use client";

import { COLUMNS, COLUMN_ORDER } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { RetroBoard } from "@/hooks/use-retro-board";

export function PhaseBar({ board }: { board: RetroBoard }) {
  const { state } = board;
  const review = state.stage === "review";
  const stageName =
    state.stage === "write" ? "Write" : state.stage === "group" ? "Group" : "Vote";

  return (
    <div className="phasebar">
      <span className="phase-label">TOPIC</span>
      <div className="phase-list" aria-label="Retrospective topics">
        {COLUMN_ORDER.map((key, i) => (
          <button
            key={key}
            className={cn(
              "phase",
              !review && i === state.currentRound && "active",
              (review || i < state.currentRound) && "complete"
            )}
            type="button"
            disabled
          >
            <span className="phase-index">0{i + 1}</span>
            {COLUMNS[key].title}
          </button>
        ))}
      </div>
      <div className="phase-help">
        {review
          ? "All topics complete · Review & act"
          : `Round ${state.currentRound + 1} of 3 · ${stageName}`}
      </div>
    </div>
  );
}
