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
    <header className="topbar">
      <div className="topline">
        <div className="title-wrap">
          <input
            className="board-title"
            value={state.title}
            maxLength={TITLE_MAX}
            aria-label="Board title"
            onChange={(e) => board.setTitle(e.target.value)}
            onBlur={board.normalizeTitle}
          />
          <div className="session-meta">
            <span className="session-dot" />
            <span>Host-led · anonymous</span>
            <span aria-hidden="true">·</span>
            <span>
              {noteCount} {noteCount === 1 ? "note" : "notes"}
            </span>
          </div>
        </div>
        <div className="toolbar" aria-label="Board tools">
          <label className="btn" htmlFor="board-file-input" title="Open a saved board">
            <Upload size={16} aria-hidden="true" />
            <span className="text-on-small">Open</span>
          </label>
          <Button
            onClick={board.downloadBoard}
            title="Download board snapshot"
          >
            <Download size={16} aria-hidden="true" />
            <span className="text-on-small">Download</span>
          </Button>
          <Button
            variant="danger"
            size="icon"
            onClick={() => board.setResetOpen(true)}
            title="Reset board"
            aria-label="Reset board"
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
      <PhaseBar board={board} />
    </header>
  );
}
