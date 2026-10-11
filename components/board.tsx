"use client";

import * as React from "react";
import { EyeOff, GripVertical } from "lucide-react";
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

/* Per-column Liquid Glass tone. All classes are complete literals for Tailwind. */
const TONES: Record<
  ColumnKey,
  { bar: string; chip: string; card: string; ring: string; voteHover: string }
> = {
  went: {
    bar: "from-amber-200 via-amber-400 to-orange-400",
    chip: "border-amber-300/50 bg-amber-300/25 text-amber-800 dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-200",
    card: "border-amber-200/50 dark:border-amber-200/15",
    ring: "ring-amber-400/70",
    voteHover: "hover:border-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-400/10",
  },
  improve: {
    bar: "from-rose-200 via-rose-400 to-pink-500",
    chip: "border-rose-300/50 bg-rose-300/25 text-rose-800 dark:border-rose-300/25 dark:bg-rose-400/10 dark:text-rose-200",
    card: "border-rose-200/50 dark:border-rose-200/15",
    ring: "ring-rose-400/70",
    voteHover: "hover:border-rose-300 hover:bg-rose-100/60 dark:hover:bg-rose-400/10",
  },
  ideas: {
    bar: "from-emerald-200 via-emerald-400 to-teal-500",
    chip: "border-emerald-300/50 bg-emerald-300/25 text-emerald-800 dark:border-emerald-300/25 dark:bg-emerald-400/10 dark:text-emerald-200",
    card: "border-emerald-200/50 dark:border-emerald-200/15",
    ring: "ring-emerald-400/70",
    voteHover: "hover:border-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-400/10",
  },
};

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
    <article
      className="glass-soft group relative rounded-2xl p-3.5"
      aria-label="Hidden anonymous note"
    >
      <div className="absolute top-2 right-2">
        <button
          className="grid size-[30px] place-items-center rounded-xl text-lg leading-none text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-200"
          type="button"
          onClick={onToggleMenu}
          aria-label="Note options"
        >
          ···
        </button>
        {menuOpen && (
          <div className="glass-strong absolute top-9 right-0 z-20 w-[170px] rounded-xl p-1.5">
            <button
              className="w-full rounded-xl px-2.5 py-2 text-left text-xs font-medium text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
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
      <p
        className="mr-8 mb-3 leading-relaxed break-words whitespace-pre-wrap blur-md select-none"
        aria-hidden="true"
      >
        {note.text}
      </p>
      <div className="flex min-h-[30px] items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
          <EyeOff className="size-3.5" aria-hidden="true" />
          Anonymous · hidden until grouping
        </span>
        <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
          {note.created}
        </span>
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
  columnKey,
  allGroups,
  drag,
}: {
  board: RetroBoard;
  group: RetroGroup;
  mode: ThemeMode;
  columnKey: ColumnKey;
  allGroups?: RetroGroup[];
  drag?: DragHandlers;
}) {
  const { state } = board;
  const host = board.host;
  const key = activeKey(state);
  const notes = notesForGroup(state, group);
  const title = group.title || "Untitled theme";
  const inputRef = React.useRef<HTMLInputElement>(null);
  const tone = TONES[columnKey];

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
        className="-m-1.5 w-full min-w-0 rounded-xl border border-transparent bg-transparent px-1.5 py-1 text-sm font-bold text-slate-900 transition-colors hover:border-slate-300/70 focus:border-violet-400 focus:bg-white/70 focus:outline-none dark:text-white dark:hover:border-white/20 dark:focus:bg-white/10"
        value={title}
        maxLength={THEME_TITLE_MAX}
        aria-label="Theme name"
        onChange={(e) => board.renameGroup(group.id, e.target.value)}
      />
    ) : (
      <h3 className="min-w-0 flex-1 text-sm font-bold break-words text-slate-900 dark:text-white">
        {title}
      </h3>
    );

  let notesNode: React.ReactNode;
  if (mode === "group" && drag) {
    notesNode = (
      <>
        {notes.map((note) => (
          <div
            key={note.id}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-transparent border-b-slate-200/60 px-2 py-2 transition-all dark:border-b-white/10",
              drag.draggedNoteId === note.id &&
                "scale-[0.98] border-violet-300/60 bg-violet-100/40 opacity-60 dark:border-violet-300/30 dark:bg-violet-400/10",
              host && "cursor-grab active:cursor-grabbing"
            )}
            draggable={host}
            onDragStart={host ? (e) => drag.onDragStart(e, note.id) : undefined}
            onDragEnd={host ? drag.onDragEnd : undefined}
          >
            {host && (
              <span
                className="flex items-center gap-0.5 font-mono text-[9px] font-semibold tracking-wider text-slate-400 uppercase dark:text-slate-500"
                aria-hidden="true"
              >
                <GripVertical className="size-3.5" />
                <span className="max-lg:hidden">Drag</span>
              </span>
            )}
            <p className="m-0 text-xs leading-relaxed break-words text-slate-700 dark:text-slate-200">
              {note.text}
            </p>
            {host && (
              <select
                className="max-w-[150px] rounded-xl border border-slate-300/60 bg-white/60 px-2 py-1.5 text-[11px] text-slate-500 backdrop-blur-sm focus:outline-none max-lg:w-full max-lg:max-w-none dark:border-white/15 dark:bg-white/10 dark:text-slate-300"
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
          <p
            key={n.id}
            className="m-0 border-b border-dashed border-slate-300/60 pb-1.5 text-xs leading-relaxed break-words text-slate-700 last:border-b-0 last:pb-0 dark:border-white/10 dark:text-slate-200"
          >
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
      <div className="flex items-center gap-2 px-3 pt-0 pb-3">
        <span className="ml-auto font-mono text-sm font-bold text-slate-800 tabular-nums dark:text-slate-100">
          {plural(group.votes, "vote", "votes")}
        </span>
      </div>
    ) : (
      <div className="flex items-center gap-2 px-3 pt-0 pb-3">
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {plural(notes.length, "note", "notes")}
        </span>
        <button
          className={cn(
            "glass ml-auto inline-flex h-[30px] min-w-[64px] items-center justify-center gap-1.5 rounded-full px-3 font-mono text-xs font-semibold text-slate-700 transition-all disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200",
            !disabled && tone.voteHover
          )}
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
      <div className="flex items-center gap-2 px-3 pt-0 pb-3">
        <span className="ml-auto font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
          {plural(group.votes, "vote", "votes")}
        </span>
      </div>
    );
  } else if (mode === "review") {
    foot = (
      <div className="flex items-center gap-2 px-3 pt-0 pb-3">
        <Button size="sm" onClick={() => board.actionFromTheme(group.id)}>
          + Make action
        </Button>
        <span className="ml-auto font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
          {plural(group.votes, "vote", "votes")}
        </span>
      </div>
    );
  }

  return (
    <section
      className={cn(
        "glass-soft overflow-hidden rounded-2xl transition-all",
        tone.card,
        drag &&
          drag.dropTargetId === group.id &&
          cn("scale-[1.01] ring-2 ring-offset-2 ring-offset-transparent", tone.ring)
      )}
      onDragOver={
        drag && host ? (e) => drag.onThemeDragOver(e, group.id) : undefined
      }
      onDrop={drag && host ? (e) => drag.onThemeDrop(e, group.id) : undefined}
    >
      <div className="flex items-center gap-2 border-b border-slate-200/50 px-3 py-2.5 dark:border-white/10">
        {head}
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold whitespace-nowrap",
            tone.chip
          )}
        >
          {notes.length}
        </span>
      </div>
      <div className="grid gap-1.5 px-3 py-2.5">{notesNode}</div>
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
  const tone = TONES[columnKey];

  let body: React.ReactNode;
  if (review) {
    const groups = groupsFor(state, columnKey)
      .slice()
      .sort((a, b) => b.votes - a.votes);
    body = groups.length ? (
      groups.map((g) => (
        <ThemeCard key={g.id} board={board} group={g} mode="review" columnKey={columnKey} />
      ))
    ) : (
      <div className="glass-soft grid min-h-[116px] place-items-center rounded-2xl p-5 text-center text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
        No themes were created for this topic.
      </div>
    );
  } else if (index < state.currentRound) {
    const groups = groupsFor(state, columnKey)
      .slice()
      .sort((a, b) => b.votes - a.votes);
    body = groups.length ? (
      groups.map((g) => (
        <ThemeCard key={g.id} board={board} group={g} mode="summary" columnKey={columnKey} />
      ))
    ) : (
      <div className="grid min-h-[96px] place-items-center p-4 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        This topic is complete.
      </div>
    );
  } else if (index > state.currentRound) {
    body = (
      <div className="grid min-h-[96px] place-items-center p-4 text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
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
      <div className="glass-soft grid min-h-[116px] place-items-center rounded-2xl border-dashed p-5 text-center text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
        <span>
          No notes yet.
          <br />
          Start with one honest observation.
        </span>
      </div>
    );
  } else if (state.stage === "group") {
    const groups = groupsFor(state, columnKey);
    body = groups.length ? (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="glass-soft flex flex-1 basis-[320px] items-center gap-2.5 rounded-2xl p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="grid size-6 flex-none place-items-center rounded-full bg-emerald-400/25 font-mono text-[11px] font-bold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              ✓
            </span>
            <span>
              {host ? (
                <>
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    Automatic grouping complete.
                  </strong>{" "}
                  As host, drag notes between themes, rename themes, or create a
                  new one.
                </>
              ) : (
                <>
                  <strong className="font-semibold text-slate-900 dark:text-white">
                    The host is reviewing themes.
                  </strong>{" "}
                  Notes remain anonymous while the host corrects the grouping.
                </>
              )}
            </span>
          </div>
          {host && (
            <Button size="sm" onClick={() => board.addTheme(columnKey)}>
              + New theme
            </Button>
          )}
        </div>
        <div className="grid gap-2.5">
          {groups.map((g) => (
            <ThemeCard
              key={g.id}
              board={board}
              group={g}
              mode="group"
              columnKey={columnKey}
              allGroups={groups}
              drag={drag}
            />
          ))}
        </div>
      </>
    ) : (
      <div className="glass-soft grid min-h-[116px] place-items-center rounded-2xl p-5 text-center text-[13px] text-slate-500 dark:text-slate-400">
        No notes to group for this topic.
      </div>
    );
  } else {
    const groups = groupsFor(state, columnKey).slice();
    if (key && everyoneFinishedVoting(state, key))
      groups.sort((a, b) => b.votes - a.votes);
    body = groups.length ? (
      groups.map((g) => (
        <ThemeCard key={g.id} board={board} group={g} mode="vote" columnKey={columnKey} />
      ))
    ) : (
      <div className="glass-soft grid min-h-[116px] place-items-center rounded-2xl p-5 text-center text-[13px] text-slate-500 dark:text-slate-400">
        No themes to vote on.
      </div>
    );
  }

  return (
    <article
      className={cn(
        "glass min-w-0 overflow-hidden rounded-3xl transition-opacity",
        !review && !active && "opacity-60 max-md:hidden"
      )}
      data-column={columnKey}
    >
      {/* tone accent bar */}
      <div
        aria-hidden="true"
        className={cn("h-1.5 bg-gradient-to-r", tone.bar)}
      />
      <div className="border-b border-slate-200/50 px-4 pt-3.5 pb-3 dark:border-white/10">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">
            {COLUMNS[columnKey].title}
          </h2>
          <span className="ml-auto font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {notes.length}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {COLUMNS[columnKey].prompt}
        </p>
        {active && state.stage === "write" && (
          <button
            className="mt-3 min-h-[40px] w-full rounded-xl border border-dashed border-slate-400/60 bg-white/30 px-3 py-2 text-left text-sm font-semibold text-slate-500 backdrop-blur-sm transition-all hover:border-violet-400/70 hover:bg-violet-100/40 hover:text-slate-800 dark:border-white/20 dark:bg-white/5 dark:text-slate-400 dark:hover:border-violet-300/40 dark:hover:bg-violet-400/10 dark:hover:text-slate-100"
            type="button"
            onClick={() => board.openComposer("note", columnKey)}
          >
            + Add a note
          </button>
        )}
      </div>
      <div className="grid min-h-[150px] content-start gap-2.5 p-3 max-md:min-h-[92px]">
        {body}
      </div>
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
    <section
      className="grid grid-cols-3 items-start gap-3.5 max-md:grid-cols-1 max-md:gap-4"
      aria-label="Retrospective board"
    >
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
