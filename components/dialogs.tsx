"use client";

import * as React from "react";
import type { RetroBoard } from "@/hooks/use-retro-board";
import { COLUMNS, NOTE_MAX } from "@/lib/types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

/* ---------------- Note / action composer ---------------- */

export function ComposerDialog({ board }: { board: RetroBoard }) {
  const { composer } = board;
  const [text, setText] = React.useState("");
  const areaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (composer.open) {
      const existing =
        composer.editingId != null
          ? board.state.notes.find((n) => n.id === composer.editingId)
          : undefined;
      setText(existing ? existing.text : "");
      const id = window.setTimeout(() => areaRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [composer.open, composer.editingId, board.state.notes]);

  let title = "";
  let sub = "";
  let saveLabel = "";
  if (composer.mode === "action") {
    title = "Add an action";
    sub = "Write one concrete next step. You can assign it after adding.";
    saveLabel = "Add action";
  } else if (composer.editingId) {
    const existing = board.state.notes.find((n) => n.id === composer.editingId);
    title = "Edit note";
    sub = existing ? COLUMNS[existing.column].prompt : "";
    saveLabel = "Save changes";
  } else {
    title = "Add to " + COLUMNS[composer.column].title;
    sub = COLUMNS[composer.column].prompt;
    saveLabel = "Add note";
  }

  return (
    <Dialog
      open={composer.open}
      onOpenChange={(open) => {
        if (!open) board.closeComposer();
      }}
    >
      <DialogContent className="glass-strong rounded-3xl sm:max-w-[500px]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            board.submitComposer(text);
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <DialogDescription>{sub}</DialogDescription>
          </DialogHeader>
          <Textarea
            ref={areaRef}
            value={text}
            maxLength={NOTE_MAX}
            placeholder="Type your thought…"
            required
            onChange={(e) => setText(e.target.value)}
            className="glass-soft min-h-[130px] resize-y rounded-2xl leading-relaxed"
          />
          <DialogFooter className="mt-3 items-center">
            <span className="mr-auto font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {text.length} / {NOTE_MAX}
            </span>
            <Button type="button" variant="outline" onClick={board.closeComposer}>
              Cancel
            </Button>
            <Button type="submit">{saveLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Session creation ---------------- */

const MEMBER_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export function SessionDialog({ board }: { board: RetroBoard }) {
  const [title, setTitle] = React.useState("Sprint retrospective");
  const [count, setCount] = React.useState(3);

  React.useEffect(() => {
    if (board.sessionOpen) {
      setTitle("Sprint retrospective");
      setCount(3);
    }
  }, [board.sessionOpen]);

  return (
    <Dialog open={board.sessionOpen} onOpenChange={() => {}}>
      <DialogContent
        className="glass-strong rounded-3xl sm:max-w-[500px] [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            board.createSession(title, count);
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Create a retro session</DialogTitle>
            <DialogDescription>
              You’ll join as the host and Member 1. Every participant stays
              anonymous on notes, themes, and votes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
            <div className="grid gap-1.5">
              <Label htmlFor="session-topic">Session topic</Label>
              <Input
                id="session-topic"
                value={title}
                maxLength={60}
                required
                onChange={(e) => setTitle(e.target.value)}
                className="glass-soft min-h-[42px] rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="session-members">Anonymous members</Label>
              <select
                id="session-members"
                className="glass-soft min-h-[42px] w-full rounded-xl px-2.5 text-sm text-slate-700 focus:outline-none dark:text-slate-200"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {MEMBER_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "member" : "members"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" asChild>
              <label htmlFor="board-file-input">Open saved board</label>
            </Button>
            <Button type="submit">Create session</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Reset confirmation ---------------- */

export function ResetDialog({ board }: { board: RetroBoard }) {
  return (
    <Dialog
      open={board.resetOpen}
      onOpenChange={(open) => {
        if (!open) board.setResetOpen(false);
      }}
    >
      <DialogContent className="glass-strong rounded-3xl sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-xl">Reset this board?</DialogTitle>
          <DialogDescription>
            This clears every note, vote, and action item from the current
            session. Download a snapshot first if you want to keep it.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => board.setResetOpen(false)}>
            Keep board
          </Button>
          <Button variant="destructive" onClick={board.confirmReset}>
            Reset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
