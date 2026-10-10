"use client";

import { Check, Plus } from "lucide-react";
import type { RetroBoard } from "@/hooks/use-retro-board";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function ActionSection({ board }: { board: RetroBoard }) {
  const { state } = board;

  return (
    <section
      aria-labelledby="actionsTitle"
      className="glass mt-4 overflow-hidden rounded-3xl"
    >
      <div className="flex items-center gap-3.5 border-b border-slate-200/50 px-4 py-4 max-sm:items-start dark:border-white/10">
        <div>
          <h2
            id="actionsTitle"
            className="text-base font-bold tracking-tight text-slate-900 dark:text-white"
          >
            Action items
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Turn a theme into a clear next step, then assign an anonymous member
            and date.
          </p>
        </div>
        <Button onClick={() => board.openComposer("action")} className="ml-auto shrink-0 max-sm:px-2.5">
          <Plus className="size-4" aria-hidden="true" />
          <span className="max-sm:hidden">Add action</span>
        </Button>
      </div>
      <div className="grid">
        {state.actions.length ? (
          state.actions.map((a) => (
            <div
              key={a.id}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_150px_140px_auto] items-center gap-2.5 border-t border-slate-200/50 px-4 py-3 first:border-t-0 max-md:grid-cols-2 dark:border-white/10",
                a.done && "opacity-70"
              )}
            >
              <div
                className={cn(
                  "font-semibold break-words text-slate-800 max-md:col-span-2 dark:text-slate-100",
                  a.done && "text-slate-500 line-through dark:text-slate-400"
                )}
              >
                {a.text}
              </div>
              <select
                className="glass-soft min-w-0 rounded-xl px-2.5 py-2 text-xs text-slate-600 focus:outline-none dark:text-slate-300"
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
                className="glass-soft rounded-xl text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => board.toggleActionDone(a.id)}
                className="glass-btn whitespace-nowrap max-md:justify-self-end"
              >
                {a.done ? (
                  "Reopen"
                ) : (
                  <>
                    <Check className="size-3.5" aria-hidden="true" />
                    Done
                  </>
                )}
              </Button>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
            No actions yet. Make one from a theme or add one directly.
          </div>
        )}
      </div>
    </section>
  );
}
