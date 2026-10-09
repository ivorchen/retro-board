"use client";

import * as React from "react";
import type { RetroBoard } from "@/hooks/use-retro-board";
import { COLUMNS, NOTE_MAX } from "@/lib/types";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
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

  if (!composer.open) return null;

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
    <div className="composer-backdrop" onClick={(e) => {
      if (e.target === e.currentTarget) board.closeComposer();
    }}>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          board.submitComposer(text);
        }}
      >
        <h2>{title}</h2>
        <p className="composer-sub">{sub}</p>
        <Textarea
          ref={areaRef}
          value={text}
          maxLength={NOTE_MAX}
          placeholder="Type your thought…"
          required
          onChange={(e) => setText(e.target.value)}
        />
        <div className="composer-foot">
          <span className="char-count">
            {text.length} / {NOTE_MAX}
          </span>
          <Button type="button" onClick={board.closeComposer}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {saveLabel}
          </Button>
        </div>
      </form>
    </div>
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
    <Dialog
      open={board.sessionOpen}
      onClose={() => {}}
      labelledBy="sessionTitleHeading"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          board.createSession(title, count);
        }}
      >
        <DialogTitle id="sessionTitleHeading">Create a retro session</DialogTitle>
        <DialogDescription>
          You’ll join as the host and Member 1. Every participant stays anonymous
          on notes, themes, and votes.
        </DialogDescription>
        <div className="setup-fields">
          <label className="setup-field">
            Session topic
            <Input
              value={title}
              maxLength={60}
              required
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="setup-field">
            Anonymous members
            <select
              className="field"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              {MEMBER_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "member" : "members"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <label className="btn" htmlFor="board-file-input">
            Open saved board
          </label>
          <Button type="submit" variant="primary">
            Create session
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

/* ---------------- Reset confirmation ---------------- */

export function ResetDialog({ board }: { board: RetroBoard }) {
  return (
    <Dialog
      open={board.resetOpen}
      onClose={() => board.setResetOpen(false)}
      labelledBy="resetTitle"
    >
      <DialogTitle id="resetTitle">Reset this board?</DialogTitle>
      <DialogDescription>
        This clears every note, vote, and action item from the current session.
        Download a snapshot first if you want to keep it.
      </DialogDescription>
      <DialogFooter>
        <Button onClick={() => board.setResetOpen(false)}>Keep board</Button>
        <Button variant="primary" onClick={board.confirmReset}>
          Reset
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
