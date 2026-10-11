"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { autoGroupNotes } from "@/lib/grouping";
import {
  activeKey,
  currentMember as currentMemberSelector,
  everyoneFinishedVoting,
  memberFinishedVoting,
  memberVotesUsed,
} from "@/lib/selectors";
import {
  downloadSnapshot,
  exportSnapshot,
  parseSnapshot,
} from "@/lib/snapshot";
import {
  COLUMNS,
  COLUMN_ORDER,
  VOTE_BUDGET,
  type BoardState,
  type ColumnKey,
  type ComposerMode,
  type SerializedSession,
  type SessionTimerMeta,
} from "@/lib/types";
import { reducer, type BoardAction, type RetroBoard } from "./use-retro-board";
import type { ComposerState } from "./use-retro-board";

/**
 * The synced board: same UI state machine as the local hook, but every
 * mutation also hits the session API, and the server pushes fresh state over
 * SSE. Optimistic updates keep the UI snappy; on API failure the hook
 * refetches the full session state from the server (the server is the source
 * of truth).
 *
 * Optimism policy (documented per method below):
 * - Trivially correct (notes, votes, renames, moves, actions, timer): dispatch
 *   the local reducer action optimistically, then call the API. Client-made
 *   ids (notes, actions) will differ from server ids; the next SSE event
 *   reconciles everything.
 * - Server-generated ids (themes): call the API first, then dispatch
 *   optimistically with the REAL id from the response — no temp-id
 *   bookkeeping, and SSE confirms.
 */
export interface SyncedBoard extends RetroBoard {
  isSynced: true;
  meta: SerializedSession["meta"];
  shareLink: string;
  refetch: () => Promise<void>;
}

/** Derive the client's countdown display from the server-authoritative timer. */
function withTimerFromMeta(
  state: BoardState,
  timer: SessionTimerMeta
): BoardState {
  if (!timer.running || !timer.endsAt) {
    return state.timerRunning || state.timerSeconds !== timer.seconds
      ? { ...state, timerRunning: false, timerSeconds: timer.seconds }
      : state;
  }
  const remaining = Math.max(
    0,
    Math.round((Date.parse(timer.endsAt) - Date.now()) / 1000)
  );
  return state.timerSeconds === remaining && state.timerRunning
    ? state
    : { ...state, timerSeconds: remaining, timerRunning: true };
}

export function useSyncedBoard(
  sessionId: string,
  initial: SerializedSession
): SyncedBoard {
  const router = useRouter();
  const [state, dispatch] = useReducer(
    reducer,
    initial.state,
    (s) => withTimerFromMeta(s, initial.meta.timer)
  );
  const [meta, setMeta] = useState(initial.meta);
  const [composer, setComposer] = useState<ComposerState>({
    open: false,
    mode: "note",
    column: "went",
    editingId: null,
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingFocusTheme, setPendingFocusTheme] = useState<string | null>(
    null
  );
  const [shareLink, setShareLink] = useState("");

  const stateRef = useRef(state);
  stateRef.current = state;
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const composerRef = useRef(composer);
  composerRef.current = composer;
  const toastTimer = useRef<number | undefined>(undefined);
  const timerGuardRef = useRef<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2400);
  }, []);

  useEffect(() => {
    setShareLink(`${window.location.origin}/s/${meta.shareToken}`);
  }, [meta.shareToken]);

  /** Thin wrapper around the session API. Throws on non-2xx. */
  const api = useCallback(
    async (path: string, init?: RequestInit): Promise<unknown> => {
      const res = await fetch(`/api/sessions/${sessionId}${path}`, {
        credentials: "include",
        ...init,
      });
      if (!res.ok) throw new Error(`API ${res.status} on ${path}`);
      const text = await res.text();
      return text ? (JSON.parse(text) as unknown) : null;
    },
    [sessionId]
  );

  const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  /** Reload the whole session from the server (source of truth). */
  const refetch = useCallback(async () => {
    try {
      const data = (await api("")) as SerializedSession;
      setMeta(data.meta);
      // Take the server state wholesale, then re-derive the countdown
      // display from the server-authoritative timer in meta.
      dispatch({
        type: "IMPORT_STATE",
        state: withTimerFromMeta(data.state, data.meta.timer),
      });
    } catch {
      // Offline or session gone; leave local state as-is.
    }
  }, [api]);

  /**
   * Optimistic mutation: apply the reducer action locally, then run the API
   * call. On failure, refetch the full server state to reconcile.
   */
  const mutate = useCallback(
    (action: BoardAction, apiCall: () => Promise<unknown>) => {
      dispatch(action);
      apiCall().catch(() => {
        showToast("Sync hiccup — refreshed from the server");
        void refetch();
      });
    },
    [refetch, showToast]
  );

  /* ---------------- writing ---------------- */

  const finishWriting = useCallback(
    (timeUp: boolean) => {
      const s = stateRef.current;
      const key = activeKey(s);
      if (!key || s.stage !== "write") return;
      const notes = s.notes.filter((n) => n.column === key);
      // Same grouping algorithm as the local hook; the server runs its own
      // copy and SSE reconciles any id differences.
      const groups = autoGroupNotes(notes, key);
      mutate({ type: "FINISH_WRITING", key, groups }, () =>
        api("/phase", json({ op: "finish_writing", topicId: key }))
      );
      showToast(
        (timeUp ? "Time is up — " : "") +
          `grouped ${notes.length} ${notes.length === 1 ? "note" : "notes"}` +
          ` into ${groups.length} ${groups.length === 1 ? "theme" : "themes"}`
      );
    },
    [api, mutate, showToast]
  );

  const openComposer = useCallback(
    (mode: ComposerMode, column?: ColumnKey, editingId: string | null = null) => {
      const s = stateRef.current;
      setComposer({
        open: true,
        mode,
        column: column ?? activeKey(s) ?? "went",
        editingId,
      });
    },
    []
  );

  const closeComposer = useCallback(() => {
    setComposer((c) => ({ ...c, open: false, editingId: null }));
  }, []);

  const submitComposer = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const c = composerRef.current;
      const s = stateRef.current;
      if (c.mode === "action") {
        // Optimistic id will differ from the server's; SSE reconciles.
        mutate({ type: "ADD_ACTION", text: trimmed }, () =>
          api("/actions", json({ text: trimmed }))
        );
        showToast("Action item added");
      } else if (c.editingId) {
        const id = c.editingId;
        mutate({ type: "UPDATE_NOTE", id, text: trimmed }, () =>
          api(`/notes/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: trimmed }),
          })
        );
        showToast("Note updated");
      } else {
        // Optimistic note id will differ from the server's; SSE reconciles.
        mutate(
          {
            type: "ADD_NOTE",
            column: c.column,
            text: trimmed,
            authorId: s.currentMemberId,
          },
          () => api("/notes", json({ topicId: c.column, content: trimmed }))
        );
        showToast("Note added");
      }
      closeComposer();
    },
    [api, closeComposer, mutate, showToast]
  );

  const deleteNote = useCallback(
    (id: string) => {
      mutate({ type: "DELETE_NOTE", id }, () =>
        api(`/notes/${id}`, { method: "DELETE" })
      );
      showToast("Note deleted");
    },
    [api, mutate, showToast]
  );

  /* ---------------- phases ---------------- */

  const completeMyVoting = useCallback(
    (key: ColumnKey) => {
      const s = stateRef.current;
      const me = s.currentMemberId;
      if (memberFinishedVoting(s, key, me)) return;
      // No member rotation in multi-user mode: each browser submits its own
      // member, the server reveals once everyone finished.
      mutate(
        {
          type: "COMPLETE_VOTING_MEMBER",
          key,
          memberId: me,
          nextMemberId: me,
        },
        () => api("/votes/complete", json({ topicId: key }))
      );
      showToast("Voting submitted — results reveal when everyone finishes");
    },
    [api, mutate, showToast]
  );

  const advance = useCallback(() => {
    const s = stateRef.current;
    const m = metaRef.current;
    const key = activeKey(s);
    // Mid-vote: any member may submit their own voting (no host gate).
    if (s.stage === "vote" && key && !everyoneFinishedVoting(s, key)) {
      completeMyVoting(key);
      return;
    }
    if (!m.isHost) {
      showToast("Only the host can move the session forward");
      return;
    }
    if (s.stage === "write" && key) {
      finishWriting(s.timerSeconds === 0);
      return;
    }
    if (s.stage === "group" && key) {
      mutate({ type: "START_VOTING", key }, () =>
        api("/phase", json({ op: "start_voting", topicId: key }))
      );
      showToast(
        "Themes are ready — vote totals stay hidden until everyone finishes"
      );
      return;
    }
    if (s.stage === "vote" && s.currentRound < 2) {
      const nextKey = COLUMN_ORDER[s.currentRound + 1];
      mutate({ type: "NEXT_ROUND" }, () =>
        api("/phase", json({ op: "next_round" }))
      );
      showToast(`Next topic: ${COLUMNS[nextKey].title}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    mutate({ type: "TO_REVIEW" }, () => api("/phase", json({ op: "to_review" })));
    showToast("All topics complete — review the results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [api, completeMyVoting, finishWriting, mutate, showToast]);

  /* ---------------- timer ---------------- */

  const toggleTimer = useCallback(() => {
    if (!metaRef.current.isHost) return;
    const running = metaRef.current.timer.running;
    mutate({ type: "TIMER_TOGGLE" }, () =>
      api("/timer", json({ op: running ? "pause" : "start" }))
    );
  }, [api, mutate]);

  const resetTimer = useCallback(() => {
    if (!metaRef.current.isHost) return;
    mutate({ type: "TIMER_RESET" }, () => api("/timer", json({ op: "reset" })));
  }, [api, mutate]);

  // Client-side countdown derived from the server timer. On expiry the host
  // auto-advances out of writing; everyone else gets a one-time notice.
  useEffect(() => {
    const id = window.setInterval(() => {
      const m = metaRef.current;
      if (!m.timer.running || !m.timer.endsAt) return;
      const remaining = Math.max(
        0,
        Math.round((Date.parse(m.timer.endsAt) - Date.now()) / 1000)
      );
      const prev = stateRef.current;
      if (!(prev.timerSeconds === remaining && prev.timerRunning)) {
        dispatch({
          type: "IMPORT_STATE",
          state: { ...prev, timerSeconds: remaining, timerRunning: true },
        });
      }
      if (remaining > 0) return;
      if (timerGuardRef.current === m.timer.endsAt) return;
      timerGuardRef.current = m.timer.endsAt;
      const s = stateRef.current;
      if (s.timerRunning) {
        dispatch({
          type: "IMPORT_STATE",
          state: { ...s, timerRunning: false },
        });
      }
      if (s.stage === "write" && m.isHost) advance();
      else if (s.stage !== "write") showToast("Time is up");
    }, 1000);
    return () => window.clearInterval(id);
  }, [advance, showToast]);

  /* ---------------- voting ---------------- */

  const voteGroup = useCallback(
    (groupId: string) => {
      const s = stateRef.current;
      const key = activeKey(s);
      if (!key || s.stage !== "vote") return;
      if (memberFinishedVoting(s, key, s.currentMemberId)) return;
      if (memberVotesUsed(s, key) >= VOTE_BUDGET) return;
      mutate({ type: "VOTE_GROUP", groupId, memberId: s.currentMemberId }, () =>
        api("/votes", json({ themeId: groupId }))
      );
    },
    [api, mutate]
  );

  /* ---------------- grouping (host) ---------------- */

  const renameGroup = useCallback(
    (id: string, title: string) => {
      mutate({ type: "RENAME_GROUP", id, title }, () =>
        api(`/themes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        })
      );
    },
    [api, mutate]
  );

  const addTheme = useCallback(
    async (column: ColumnKey) => {
      if (!metaRef.current.isHost) return;
      try {
        // Server-generated id: call first, then optimistically insert with the
        // real id — SSE confirms.
        const data = (await api("/themes", json({ topicId: column }))) as {
          theme: { id: string };
        };
        dispatch({ type: "ADD_THEME", column, id: data.theme.id });
        setPendingFocusTheme(data.theme.id);
      } catch {
        showToast("Couldn't create the theme — try again");
      }
    },
    [api, showToast]
  );

  const clearPendingFocusTheme = useCallback(
    () => setPendingFocusTheme(null),
    []
  );

  const moveNote = useCallback(
    (noteId: string, targetGroupId: string) => {
      const s = stateRef.current;
      if (s.stage !== "group" || !metaRef.current.isHost) return;
      const source = s.groups.find((g) => g.noteIds.indexOf(noteId) >= 0);
      const target = s.groups.find((g) => g.id === targetGroupId);
      if (!source || !target || target.column !== source.column || target.id === source.id)
        return;
      mutate({ type: "MOVE_NOTE", noteId, targetGroupId }, () =>
        api(`/themes/${targetGroupId}/move`, json({ cardId: noteId }))
      );
      showToast(`Anonymous note moved to ${target.title || "new theme"}`);
    },
    [api, mutate, showToast]
  );

  const moveNoteToNewTheme = useCallback(
    async (noteId: string, column: ColumnKey) => {
      const s = stateRef.current;
      if (s.stage !== "group" || !metaRef.current.isHost) return;
      try {
        const data = (await api("/themes", json({ topicId: column }))) as {
          theme: { id: string };
        };
        dispatch({ type: "ADD_THEME", column, id: data.theme.id });
        await api(`/themes/${data.theme.id}/move`, json({ cardId: noteId }));
        dispatch({ type: "MOVE_NOTE", noteId, targetGroupId: data.theme.id });
        setPendingFocusTheme(data.theme.id);
        showToast("Anonymous note moved to new theme");
      } catch {
        showToast("Couldn't move the note — refreshed from the server");
        void refetch();
      }
    },
    [api, refetch, showToast]
  );

  /* ---------------- actions ---------------- */

  const actionFromTheme = useCallback(
    (groupId: string) => {
      const s = stateRef.current;
      const g = s.groups.find((x) => x.id === groupId);
      const text = (g?.title || "Follow up on theme").slice(0, 280);
      // Optimistic id will differ from the server's; SSE reconciles.
      mutate({ type: "ACTION_FROM_THEME", groupId }, () =>
        api("/actions", json({ themeId: groupId, text }))
      );
      showToast("Action item added");
    },
    [api, mutate, showToast]
  );

  const setActionOwner = useCallback(
    (id: string, owner: string) => {
      mutate({ type: "SET_ACTION_OWNER", id, owner }, () =>
        api(`/actions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner_alias: owner }),
        })
      );
    },
    [api, mutate]
  );

  const setActionDate = useCallback(
    (id: string, date: string) => {
      mutate({ type: "SET_ACTION_DATE", id, date }, () =>
        api(`/actions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ due_date: date }),
        })
      );
    },
    [api, mutate]
  );

  const toggleActionDone = useCallback(
    (id: string) => {
      const s = stateRef.current;
      const a = s.actions.find((x) => x.id === id);
      mutate({ type: "TOGGLE_ACTION_DONE", id }, () =>
        api(`/actions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ done: !(a && a.done) }),
        })
      );
      if (a) showToast(a.done ? "Action reopened" : "Action completed");
    },
    [api, mutate, showToast]
  );

  /* ---------------- session-level ---------------- */

  // Title edits stay local: the session title is set at creation and only
  // affects the top-bar display.
  const setTitle = useCallback((title: string) => {
    dispatch({ type: "SET_TITLE", title });
  }, []);

  const normalizeTitle = useCallback(() => {
    const s = stateRef.current;
    const trimmed = s.title.trim();
    dispatch({ type: "SET_TITLE", title: trimmed || "Sprint retrospective" });
  }, []);

  const downloadBoard = useCallback(() => {
    const s = stateRef.current;
    const title = s.title.trim() || "Sprint retrospective";
    downloadSnapshot({ ...s, title });
    showToast("Board snapshot downloaded");
  }, [showToast]);

  const importBoardFile = useCallback(
    async (file: File) => {
      let snapshot: unknown;
      try {
        snapshot = exportSnapshot(parseSnapshot(JSON.parse(await file.text())));
      } catch {
        showToast("That file is not a Retro Board snapshot");
        return;
      }
      try {
        const res = await fetch("/api/sessions/import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot }),
        });
        if (!res.ok) throw new Error(`import ${res.status}`);
        const data = (await res.json()) as { shareToken: string };
        showToast("Snapshot imported as a new session");
        router.push(`/s/${data.shareToken}`);
      } catch {
        showToast("Couldn't import that snapshot — try again");
      }
    },
    [router, showToast]
  );

  /* ---------------- realtime ---------------- */

  useEffect(() => {
    let es: EventSource | null = null;
    let pollId: number | undefined;
    let failures = 0;
    let windowStart = Date.now();

    const onState = (e: Event) => {
      failures = 0;
      try {
        const data = JSON.parse((e as MessageEvent).data) as SerializedSession;
        setMeta(data.meta);
        dispatch({
          type: "IMPORT_STATE",
          state: withTimerFromMeta(data.state, data.meta.timer),
        });
      } catch {
        // Malformed event; the next one will catch up.
      }
    };
    const onError = () => {
      const now = Date.now();
      if (now - windowStart > 30000) {
        failures = 0;
        windowStart = now;
      }
      failures += 1;
      if (failures >= 3 && es) {
        // SSE looks dead; fall back to polling the session endpoint.
        es.close();
        es = null;
        pollId = window.setInterval(() => {
          void refetch();
        }, 5000);
      }
    };

    es = new EventSource(`/api/sessions/${sessionId}/events`);
    es.addEventListener("state", onState);
    es.onerror = onError;
    return () => {
      es?.close();
      if (pollId !== undefined) window.clearInterval(pollId);
    };
  }, [sessionId, refetch]);

  /* ---------------- keyboard shortcuts ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeComposer();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k" &&
        stateRef.current.stage === "write"
      ) {
        e.preventDefault();
        const key = activeKey(stateRef.current);
        if (key) openComposer("note", key);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeComposer, openComposer]);

  /* ---------------- return (RetroBoard-compatible) ---------------- */

  return {
    state,
    toastMsg,
    sessionOpen: false,
    setSessionOpen: () => {},
    resetOpen: false,
    setResetOpen: () => {},
    composer,
    openComposer,
    closeComposer,
    submitComposer,
    deleteNote,
    advance,
    toggleTimer,
    resetTimer,
    voteGroup,
    renameGroup,
    addTheme,
    moveNote,
    moveNoteToNewTheme,
    pendingFocusTheme,
    clearPendingFocusTheme,
    createSession: () => {
      showToast("Start new retros from the dashboard");
    },
    selectMember: () => {},
    addMember: () => {},
    setTitle,
    normalizeTitle,
    actionFromTheme,
    setActionOwner,
    setActionDate,
    toggleActionDone,
    downloadBoard,
    importBoardFile,
    confirmReset: () => {},
    currentMember: currentMemberSelector(state),
    host: meta.isHost,
    isSynced: true,
    meta,
    shareLink,
    refetch,
  };
}
