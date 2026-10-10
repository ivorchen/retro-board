"use client";

import { Download, Trash2, Upload } from "lucide-react";
import type { RetroBoard } from "@/hooks/use-retro-board";
import { TITLE_MAX } from "@/lib/types";
import { Button } from "./ui/button";
import { PhaseBar } from "./phase-bar";
import { ThemeToggle } from "./theme-toggle";

export function TopBar({ board }: { board: RetroBoard }) {
  const { state } = board;
  const noteCount = state.notes.length;

  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-white/55 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/45">
      {/* specular top highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
      />
      <div className="mx-auto w-full max-w-[1560px] px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[180px] flex-1">
            <input
              className="w-full max-w-[440px] border-b border-transparent bg-transparent px-0 pt-0.5 pb-1.5 text-[clamp(22px,3vw,31px)] leading-tight font-bold tracking-tight text-slate-900 transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-violet-400 focus:outline-none dark:text-white dark:hover:border-white/20"
              value={state.title}
              maxLength={TITLE_MAX}
              aria-label="Board title"
              placeholder="Untitled retro"
              onChange={(e) => board.setTitle(e.target.value)}
              onBlur={board.normalizeTitle}
            />
            <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Host-led · anonymous</span>
              <span aria-hidden="true">·</span>
              <span>
                {noteCount} {noteCount === 1 ? "note" : "notes"}
              </span>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center justify-end gap-2"
            aria-label="Board tools"
          >
            <Button variant="outline" asChild className="glass-btn max-sm:flex-1">
              <label htmlFor="board-file-input" title="Open a saved board">
                <Upload className="size-4" aria-hidden="true" />
                <span className="max-sm:hidden">Open</span>
              </label>
            </Button>
            <Button
              variant="outline"
              onClick={board.downloadBoard}
              title="Download board snapshot"
              className="glass-btn max-sm:flex-1"
            >
              <Download className="size-4" aria-hidden="true" />
              <span className="max-sm:hidden">Download</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => board.setResetOpen(true)}
              title="Reset board"
              aria-label="Reset board"
              className="glass-btn text-rose-600 hover:text-rose-700 dark:text-rose-400"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <PhaseBar board={board} />
      </div>
    </header>
  );
}
