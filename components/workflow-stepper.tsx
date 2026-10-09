"use client";

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
    <section className="workflow" aria-label="Steps for this topic">
      <ol className="stage-list">
        {STEPS.map((step, i) => (
          <li
            key={step.key}
            className={cn(
              "stage-step",
              step.key === state.stage && "active",
              current > i && "complete"
            )}
          >
            <b>{i + 1}</b>
            <span>
              <strong>{step.title}</strong>
              <small>{step.hint}</small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
