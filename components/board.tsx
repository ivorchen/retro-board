"use client";

import * as React from "react";
import type { RetroBoard } from "@/hooks/use-retro-board";
import {
  activeKey,
  everyoneFinishedVoting,
  groupsFor,
  memberFinishedVoting,
  memberVotesUsed,
  notesForGroup,
} from "@/lib/selectors";
import {
  COLUMNS,
  COLUMN_ORDER,
  THEME_TITLE_MAX,
  VOTE_BUDGET,
  type ColumnKey,
  type Note,
  type RetroGroup,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

type ThemeMode = "group" | "vote" | "summary" | "review";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/* ---------------- Note card (write stage: blurred & anonymous) ---------------- */

function NoteCard({
  board,
  note,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  board: RetroBoard;
  note: Note;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  return (
    <article className="card" aria-label="Hidden anonymous note">
      <div className="card-menu">
        <button
          className="card-menu-btn"
          type="button"
          onClick={onToggleMenu}
          aria-label="Note options"
        >
          ···
        </button>
        {menuOpen && (
          <div className="menu-pop">
            <button
              className="delete"
              type="button"
              onClick={() => {
                board.deleteNote(note.id);
                onCloseMenu();
              }}
            >
              Delete note
            </button>
          </div>
        )}
      </div>
      <p className="card-text concealed" aria-hidden="true">
        {note.text}
      </p>
      <div className="card-footer">
        <span className="concealed-label">Anonymous · hidden until grouping</span>
        <span className="card-time">{note.created}</span>
      </div>
    </article>
  );
}

/* ---------------- Theme card (group / vote / summary / review) ---------------- */

interface DragHandlers {
  draggedNoteId: string | null;
  dropTargetId: string | null;
  onDragStart: (e: React.DragEvent, noteId: string) => void;
  onDragEnd: () => void;
  onThemeDragOver: (e: React.DragEvent, themeId: string) => void;
  onThemeDrop: (e: React.DragEvent, themeId: string) => void;
}

function ThemeCard({
  board,
  group,
  mode,
  allGroups,
  drag,
}: {
  board: RetroBoard;
  group: RetroGroup;
  mode: ThemeMode;
  allGroups?: RetroGroup[];
  drag?: DragHandlers;
}) {
  const { state } = board;
  const host = board.host;
  const key = activeKey(state);
  const notes = notesForGroup(state, group);
  const title = group.title || "Untitled theme";
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (board.pendingFocusTheme === group.id && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      board.clearPendingFocusTheme();
    }
  }, [board.pendingFocusTheme, group.id, board]);

  const head =
    mode === "group" && host ? (
      <input
        ref={inputRef}
        className="theme-title-input"
        value={title}
        maxLength={THEME_TITLE_MAX}
        aria-label="Theme name"
        onChange={(e) => board.renameGroup(group.id, e.target.value)}
      />
    ) : (
      <h3 className="theme-title">{title}</h3>
    );

  let notesNode: React.ReactNode;
  if (mode === "group" && drag) {
    notesNode = (
      <>
        {notes.map((note) => (
          <div
            key={note.id}
            className={cn(
              "regroup-note",
              drag.draggedNoteId === note.id && "dragging"
            )}
            draggable={host}
            onDragStart={host ? (e) => drag.onDragStart(e, note.id) : undefined}
            onDragEnd={host ? drag.onDragEnd : undefined}
          >
            {host && (
              <span className="drag-cue" aria-hidden="true">
                DRAG
              </span>
            )}
            <p className="theme-note">{note.text}</p>
            {host && (
              <select
                className="move-select"
                value={group.id}
                aria-label="Move anonymous note to another theme"
                onChange={(e) => {
                  const targetId = e.target.value;
                  if (targetId === "__new__")
                    board.moveNoteToNewTheme(note.id, group.column);
                  else board.moveNote(note.id, targetId);
                }}
              >
                {(allGroups ?? []).map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.title || "Untitled theme"}
                  </option>
                ))}
                <option value="__new__">New theme…</option>
              </select>
            )}
          </div>
        ))}
      </>
    );
  } else {
    notesNode = (
      <>
        {notes.map((n) => (
          <p key={n.id} className="theme-note">
            {n.text}
          </p>
        ))}
      </>
    );
  }

  let foot: React.ReactNode = null;
  if (mode === "vote" && key) {
    const revealed = everyoneFinishedVoting(state, key);
    const done = memberFinishedVoting(state, key, state.currentMemberId);
    const disabled = done || memberVotesUsed(state, key) >= VOTE_BUDGET;
    foot = revealed ? (
      <div className="theme-foot">
        <span className="theme-votes">{plural(group.votes, "vote", "votes")}</span>
      </div>
    ) : (
      <div className="theme-foot">
        <span className="theme-votes">{plural(notes.length, "note", "notes")}</span>
        <button
          className="vote-btn"
          type="button"
          onClick={() => board.voteGroup(group.id)}
          disabled={disabled}
          aria-label={`Vote for ${title}`}
        >
          <span aria-hidden="true">▲</span>
          <span>Vote</span>
        </button>
      </div>
    );
  } else if (mode === "summary") {
    foot = (
      <div className="theme-foot">
        <span className="theme-votes">{plural(group.votes, "vote", "votes")}</span>
      </div>
    );
  } else if (mode === "review") {
    foot = (
      <div className="theme-foot">
        <Button onClick={() => board.actionFromTheme(group.id)}>+ Make action</Button>
        <span className="theme-votes">{plural(group.votes, "vote", "votes")}</span>
      </div>
    );
  }

  return (
    <section
      className={cn("theme", drag && drag.dropTargetId === group.id && "drop-target")}
      onDragOver={
        drag && host ? (e) => drag.onThemeDragOver(e, group.id) : undefined
      }
      onDrop={drag && host ? (e) => drag.onThemeDrop(e, group.id) : undefined}
    >
      <div className="theme-head">
        {head}
        <span className="theme-count">{notes.length}</span>
      </div>
      <div className="theme-notes">{notesNode}</div>
      {foot}
    </section>
  );
}

/* ---------------- Column ---------------- */

function ColumnView({
  board,
  columnKey,
  index,
  menuFor,
  setMenuFor,
  drag,
}: {
  board: RetroBoard;
  columnKey: ColumnKey;
  index: number;
  menuFor: string | null;
  setMenuFor: (id: string | null) => void;
  drag: DragHandlers;
}) {
  const { state } = board;
  const host = board.host;
  const key = activeKey(state);
  const review = state.stage === "review";
  const active = index === state.currentRound;
  const notes = state.notes.filter((n) => n.column === columnKey);

  let body: React.ReactNode;
  if (review) {
    const groups = groupsFor(state, columnKey)
      .slice()
      .sort((a, b) => b.votes - a.votes);
    body = groups.length ? (
      groups.map((g) => (
        <ThemeCard key={g.id} board={board} group={g} mode="review" />
      ))
    ) : (
      <div className="empty">No themes were created for this topic.</div>
    );
  } else if (index < state.currentRound) {
    const groups = groupsFor(state, columnKey)
      .slice()
      .sort((a, b) => b.votes - a.votes);
    body = groups.length ? (
      groups.map((g) => (
        <ThemeCard key={g.id} board={board} group={g} mode="summary" />
      ))
    ) : (
      <div className="locked-message">This topic is complete.</div>
    );
  } else if (index > state.currentRound) {
    body = (
      <div className="locked-message">
        Finish {key ? COLUMNS[key].title : ""} before starting this topic.
      </div>
    );
  } else if (state.stage === "write") {
    body = notes.length ? (
      notes.map((n) => (
        <NoteCard
          key={n.id}
          board={board}
          note={n}
          menuOpen={menuFor === n.id}
          onToggleMenu={() => setMenuFor(menuFor === n.id ? null : n.id)}
          onCloseMenu={() => setMenuFor(null)}
        />
      ))
    ) : (
      <div className="empty">
        No notes yet.
        <br />
        Start with one honest observation.
      </div>
    );
  } else if (state.stage === "group") {
    const groups = groupsFor(state, columnKey);
    body = groups.length ? (
      <>
        <div className="group-tools">
          <div className="auto-group-summary">
            <span className="auto-group-mark">✓</span>
            <span>
              {host ? (
                <>
                  <strong>Automatic grouping complete.</strong> As host, drag
                  notes between themes, rename themes, or create a new one.
                </>
              ) : (
                <>
                  <strong>The host is reviewing themes.</strong> Notes remain
                  anonymous while the host corrects the grouping.
                </>
              )}
            </span>
          </div>
          {host && (
            <Button onClick={() => board.addTheme(columnKey)}>+ New theme</Button>
          )}
        </div>
        <div className="theme-stack">
          {groups.map((g) => (
            <ThemeCard
              key={g.id}
              board={board}
              group={g}
              mode="group"
              allGroups={groups}
              drag={drag}
            />
          ))}
        </div>
      </>
    ) : (
      <div className="empty">No notes to group for this topic.</div>
    );
  } else {
    const groups = groupsFor(state, columnKey).slice();
    if (key && everyoneFinishedVoting(state, key))
      groups.sort((a, b) => b.votes - a.votes);
    body = groups.length ? (
      groups.map((g) => (
        <ThemeCard key={g.id} board={board} group={g} mode="vote" />
      ))
    ) : (
      <div className="empty">No themes to vote on.</div>
    );
  }

  return (
    <article
      className={cn(
        "column",
        !review && !active && "inactive",
        !review && index > state.currentRound && "future"
      )}
      data-column={columnKey}
    >
      <div className="column-head">
        <div className="column-title-row">
          <h2 className="column-title">{COLUMNS[columnKey].title}</h2>
          <span className="count">{notes.length}</span>
        </div>
        <p className="column-prompt">{COLUMNS[columnKey].prompt}</p>
        {active && state.stage === "write" && (
          <button
            className="add-note"
            type="button"
            onClick={() => board.openComposer("note", columnKey)}
          >
            + Add a note
          </button>
        )}
      </div>
      <div className="notes">{body}</div>
    </article>
  );
}

/* ---------------- Board ---------------- */

export function Board({ board }: { board: RetroBoard }) {
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = React.useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!menuFor) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".card-menu")) setMenuFor(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuFor]);

  const drag: DragHandlers = {
    draggedNoteId,
    dropTargetId,
    onDragStart: (e, noteId) => {
      setDraggedNoteId(noteId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", noteId);
    },
    onDragEnd: () => {
      setDraggedNoteId(null);
      setDropTargetId(null);
    },
    onThemeDragOver: (e, themeId) => {
      e.preventDefault();
      setDropTargetId(themeId);
      e.dataTransfer.dropEffect = "move";
    },
    onThemeDrop: (e, themeId) => {
      e.preventDefault();
      const id = draggedNoteId;
      setDraggedNoteId(null);
      setDropTargetId(null);
      if (id) board.moveNote(id, themeId);
    },
  };

  return (
    <section className="board" aria-label="Retrospective board">
      {COLUMN_ORDER.map((key, i) => (
        <ColumnView
          key={key}
          board={board}
          columnKey={key}
          index={i}
          menuFor={menuFor}
          setMenuFor={setMenuFor}
          drag={drag}
        />
      ))}
    </section>
  );
}
