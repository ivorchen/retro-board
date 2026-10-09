"use client";

import type { RetroBoard } from "@/hooks/use-retro-board";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function ActionSection({ board }: { board: RetroBoard }) {
  const { state } = board;

  return (
    <section className="action-section" aria-labelledby="actionsTitle">
      <div className="action-head">
        <div>
          <h2 id="actionsTitle">Action items</h2>
          <p>
            Turn a theme into a clear next step, then assign an anonymous member
            and date.
          </p>
        </div>
        <Button onClick={() => board.openComposer("action")}>+ Add action</Button>
      </div>
      <div className="actions">
        {state.actions.length ? (
          state.actions.map((a) => (
            <div
              key={a.id}
              className={cn("action-row", a.done && "done")}
            >
              <div className="action-copy">{a.text}</div>
              <select
                className="field"
                value={a.owner}
                aria-label="Anonymous action owner"
                onChange={(e) => board.setActionOwner(a.id, e.target.value)}
              >
                <option value="">Unassigned</option>
                {state.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {(member.id === state.hostId ? "Host · " : "") + member.name}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={a.date}
                aria-label="Due date"
                onChange={(e) => board.setActionDate(a.id, e.target.value)}
              />
              <Button
                className="done-btn"
                onClick={() => board.toggleActionDone(a.id)}
              >
                {a.done ? "Reopen" : "Mark done"}
              </Button>
            </div>
          ))
        ) : (
          <div className="action-empty">
            No actions yet. Make one from a theme or add one directly.
          </div>
        )}
      </div>
    </section>
  );
}
