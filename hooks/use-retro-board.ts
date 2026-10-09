"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { autoGroupNotes } from "../lib/grouping";
import {
  activeKey,
  completedVoters,
  currentMember,
  everyoneFinishedVoting,
  isHost,
  memberFinishedVoting,
  memberVotesUsed,
} from "../lib/selectors";
import {
  clearStoredBoard,
  downloadSnapshot,
  hasStoredBoard,
  loadBoard,
  parseSnapshot,
  saveBoard,
} from "../lib/snapshot";
import { uid } from "../lib/utils";
import {
  COLUMNS,
  COLUMN_ORDER,
  REVIEW_SECONDS,
  VOTE_BUDGET,
  WRITE_SECONDS,
  type ActionItem,
  type BoardState,
  type ColumnKey,
  type ComposerMode,
  type Member,
  type Note,
  type RetroGroup,
} from "../lib/types";

export interface ComposerState {
  open: boolean;
  mode: ComposerMode;
  column: ColumnKey;
  editingId: string | null;
}

type BoardAction =
  | { type: "SET_TITLE"; title: string }
  | { type: "CREATE_SESSION"; title: string; memberCount: number }
  | { type: "SELECT_MEMBER"; id: string }
  | { type: "ADD_MEMBER" }
  | { type: "ADD_NOTE"; column: ColumnKey; text: string; authorId: string }
  | { type: "UPDATE_NOTE"; id: string; text: string }
  | { type: "DELETE_NOTE"; id: string }
  | { type: "FINISH_WRITING"; key: ColumnKey; groups: RetroGroup[] }
  | { type: "START_VOTING"; key: ColumnKey }
  | { type: "COMPLETE_VOTING_MEMBER"; key: ColumnKey; memberId: string; nextMemberId: string }
  | { type: "NEXT_ROUND" }
  | { type: "TO_REVIEW" }
  | { type: "VOTE_GROUP"; groupId: string; memberId: string }
  | { type: "RENAME_GROUP"; id: string; title: string }
  | { type: "ADD_THEME"; column: ColumnKey; id: string }
  | { type: "MOVE_NOTE"; noteId: string; targetGroupId: string }
  | { type: "ADD_ACTION"; text: string }
  | { type: "ACTION_FROM_THEME"; groupId: string }
  | { type: "SET_ACTION_OWNER"; id: string; owner: string }
  | { type: "SET_ACTION_DATE"; id: string; date: string }
  | { type: "TOGGLE_ACTION_DONE"; id: string }
  | { type: "TIMER_TICK" }
  | { type: "TIMER_TOGGLE" }
  | { type: "TIMER_RESET" }
  | { type: "TIMER_STOP" }
  | { type: "IMPORT_STATE"; state: BoardState }
  | { type: "RESET_BOARD" };

function defaultState(): BoardState {
  return {
    title: "Sprint retrospective",
    currentRound: 0,
    stage: "write",
    notes: [],
    groups: [],
    actions: [],
    members: [{ id: "member-1", name: "Member 1" }],
    hostId: "member-1",
    currentMemberId: "member-1",
    voteCompletions: { went: [], improve: [], ideas: [] },
    timerSeconds: WRITE_SECONDS,
    timerRunning: false,
  };
}

function moveNoteInGroups(
  groups: RetroGroup[],
  noteId: string,
  targetGroupId: string
): RetroGroup[] {
  const source = groups.find((g) => g.noteIds.indexOf(noteId) >= 0);
  const target = groups.find((g) => g.id === targetGroupId);
  if (!source || !target || target.column !== source.column || target.id === source.id)
    return groups;
  return groups
    .map((g) => {
      if (g.id === source.id)
        return { ...g, noteIds: g.noteIds.filter((id) => id !== noteId) };
      if (g.id === target.id && g.noteIds.indexOf(noteId) < 0)
        return { ...g, noteIds: [...g.noteIds, noteId] };
      return g;
    })
    .filter(
      (g) => g.column !== source.column || g.noteIds.length > 0 || g.id === target.id
    );
}

function reducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "SET_TITLE":
      return { ...state, title: action.title };
    case "CREATE_SESSION": {
      const members: Member[] = [];
      for (let i = 0; i < action.memberCount; i++) {
        members.push({
          id: i === 0 ? "member-1" : uid("member"),
          name: "Member " + (i + 1),
        });
      }
      return {
        ...defaultState(),
        title: action.title,
        members,
        hostId: members[0].id,
        currentMemberId: members[0].id,
      };
    }
    case "SELECT_MEMBER":
      if (!state.members.some((m) => m.id === action.id)) return state;
      return { ...state, currentMemberId: action.id };
    case "ADD_MEMBER": {
      const member: Member = {
        id: uid("member"),
        name: "Member " + (state.members.length + 1),
      };
      return {
        ...state,
        members: [...state.members, member],
        currentMemberId: member.id,
      };
    }
    case "ADD_NOTE": {
      const note: Note = {
        id: uid("note"),
        column: action.column,
        text: action.text,
        votes: 0,
        authorId: action.authorId,
        created: "just now",
      };
      return { ...state, notes: [note, ...state.notes] };
    }
    case "UPDATE_NOTE":
      return {
        ...state,
        notes: state.notes.map((n) =>
          n.id === action.id ? { ...n, text: action.text } : n
        ),
      };
    case "DELETE_NOTE": {
      const notes = state.notes.filter((n) => n.id !== action.id);
      const groups = state.groups
        .map((g) => ({ ...g, noteIds: g.noteIds.filter((id) => id !== action.id) }))
        .filter((g) => g.noteIds.length > 0);
      return { ...state, notes, groups };
    }
    case "FINISH_WRITING":
      return {
        ...state,
        stage: "group",
        groups: [
          ...state.groups.filter((g) => g.column !== action.key),
          ...action.groups,
        ],
      };
    case "START_VOTING":
      return {
        ...state,
        stage: "vote",
        groups: state.groups.filter(
          (g) => g.column !== action.key || g.noteIds.length > 0
        ),
      };
    case "COMPLETE_VOTING_MEMBER": {
      const list = state.voteCompletions[action.key] || [];
      return {
        ...state,
        currentMemberId: action.nextMemberId,
        voteCompletions: {
          ...state.voteCompletions,
          [action.key]: list.indexOf(action.memberId) < 0
            ? [...list, action.memberId]
            : list,
        },
      };
    }
    case "NEXT_ROUND":
      return {
        ...state,
        currentRound: state.currentRound + 1,
        stage: "write",
        timerSeconds: WRITE_SECONDS,
        timerRunning: false,
      };
    case "TO_REVIEW":
      return {
        ...state,
        currentRound: 3,
        stage: "review",
        timerSeconds: REVIEW_SECONDS,
        timerRunning: false,
      };
    case "VOTE_GROUP":
      return {
        ...state,
        groups: state.groups.map((g) => {
          if (g.id !== action.groupId) return g;
          const votesBy = { ...g.votesBy };
          votesBy[action.memberId] = (votesBy[action.memberId] || 0) + 1;
          return { ...g, votesBy, votes: g.votes + 1 };
        }),
      };
    case "RENAME_GROUP":
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === action.id
            ? { ...g, title: action.title.slice(0, 80) }
            : g
        ),
      };
    case "ADD_THEME":
      return {
        ...state,
        groups: [
          ...state.groups,
          {
            id: action.id,
            column: action.column,
            title: "New theme",
            noteIds: [],
            votes: 0,
            votesBy: {},
          },
        ],
      };
    case "MOVE_NOTE":
      return {
        ...state,
        groups: moveNoteInGroups(state.groups, action.noteId, action.targetGroupId),
      };
    case "ADD_ACTION": {
      const item: ActionItem = {
        id: uid("action"),
        text: action.text.trim(),
        owner: "",
        date: "",
        done: false,
      };
      return { ...state, actions: [...state.actions, item] };
    }
    case "ACTION_FROM_THEME": {
      const source = state.groups.find((g) => g.id === action.groupId);
      if (!source) return state;
      const item: ActionItem = {
        id: uid("action"),
        text: source.title || "Follow up on theme",
        owner: "",
        date: "",
        done: false,
      };
      return { ...state, actions: [...state.actions, item] };
    }
    case "SET_ACTION_OWNER":
      return {
        ...state,
        actions: state.actions.map((a) =>
          a.id === action.id ? { ...a, owner: action.owner } : a
        ),
      };
    case "SET_ACTION_DATE":
      return {
        ...state,
        actions: state.actions.map((a) =>
          a.id === action.id ? { ...a, date: action.date } : a
        ),
      };
    case "TOGGLE_ACTION_DONE":
      return {
        ...state,
        actions: state.actions.map((a) =>
          a.id === action.id ? { ...a, done: !a.done } : a
        ),
      };
    case "TIMER_TICK":
      return {
        ...state,
        timerSeconds: Math.max(0, state.timerSeconds - 1),
      };
    case "TIMER_TOGGLE":
      return { ...state, timerRunning: !state.timerRunning };
    case "TIMER_RESET":
      return {
        ...state,
        timerRunning: false,
        timerSeconds: state.stage === "review" ? REVIEW_SECONDS : WRITE_SECONDS,
      };
    case "TIMER_STOP":
      return { ...state, timerRunning: false };
    case "IMPORT_STATE":
      return { ...action.state, timerRunning: false };
    case "RESET_BOARD":
      return defaultState();
    default:
      return state;
  }
}

function initBoard(arg: BoardState): BoardState {
  return loadBoard() ?? arg;
}

export function useRetroBoard() {
  const [state, dispatch] = useReducer(reducer, defaultState(), initBoard);
  const [sessionOpen, setSessionOpen] = useState<boolean>(() => !hasStoredBoard());
  const [resetOpen, setResetOpen] = useState(false);
  const [composer, setComposer] = useState<ComposerState>({
    open: false,
    mode: "note",
    column: "went",
    editingId: null,
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingFocusTheme, setPendingFocusTheme] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const toastTimer = useRef<number | undefined>(undefined);
  const skipNextSave = useRef(false);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2400);
  }, []);

  // Persist to localStorage (debounced). The original board never actually
  // persisted despite the README claiming it; the Next.js port implements it.
  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const id = window.setTimeout(() => saveBoard(stateRef.current), 400);
    return () => window.clearTimeout(id);
  }, [state]);

  const finishWriting = useCallback(
    (timeUp: boolean) => {
      const s = stateRef.current;
      const key = activeKey(s);
      if (!key || s.stage !== "write") return;
      const notes = s.notes.filter((n) => n.column === key);
      const groups = autoGroupNotes(notes, key);
      dispatch({ type: "FINISH_WRITING", key, groups });
      showToast(
        (timeUp ? "Time is up — " : "") +
          `grouped ${notes.length} ${notes.length === 1 ? "note" : "notes"}` +
          ` into ${groups.length} ${groups.length === 1 ? "theme" : "themes"}`
      );
    },
    [showToast]
  );

  // Countdown timer. On expiry during writing, writing auto-finishes;
  // otherwise the host gets a "time is up" notice.
  useEffect(() => {
    if (!state.timerRunning) return;
    const id = window.setInterval(() => {
      const s = stateRef.current;
      if (s.timerSeconds > 0) {
        dispatch({ type: "TIMER_TICK" });
      } else {
        dispatch({ type: "TIMER_STOP" });
        if (s.stage === "write") finishWriting(true);
        else showToast("Discussion time is up");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.timerRunning, finishWriting, showToast]);

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
      const c = composer;
      const s = stateRef.current;
      if (c.mode === "action") {
        dispatch({ type: "ADD_ACTION", text: trimmed });
        showToast("Action item added");
      } else if (c.editingId) {
        dispatch({ type: "UPDATE_NOTE", id: c.editingId, text: trimmed });
        showToast("Note updated");
      } else {
        dispatch({
          type: "ADD_NOTE",
          column: c.column,
          text: trimmed,
          authorId: s.currentMemberId,
        });
        showToast("Note added");
      }
      closeComposer();
    },
    [composer, closeComposer, showToast]
  );

  const deleteNote = useCallback(
    (id: string) => {
      dispatch({ type: "DELETE_NOTE", id });
      showToast("Note deleted");
    },
    [showToast]
  );

  const advance = useCallback(() => {
    const s = stateRef.current;
    const key = activeKey(s);
    const hostOnly =
      s.stage === "write" ||
      s.stage === "group" ||
      (s.stage === "vote" && key !== null && everyoneFinishedVoting(s, key));
    if (hostOnly && !isHost(s)) {
      showToast("Only the host can move the session forward");
      return;
    }
    dispatch({ type: "TIMER_STOP" });
    if (s.stage === "write" && key) {
      finishWriting(s.timerSeconds === 0);
      return;
    }
    if (s.stage === "group" && key) {
      dispatch({ type: "START_VOTING", key });
      showToast("Themes are ready — vote totals stay hidden until everyone finishes");
      return;
    }
    if (s.stage === "vote" && key && !everyoneFinishedVoting(s, key)) {
      const done = [...completedVoters(s, key), s.currentMemberId];
      const next = s.members.find((m) => done.indexOf(m.id) < 0);
      dispatch({
        type: "COMPLETE_VOTING_MEMBER",
        key,
        memberId: s.currentMemberId,
        nextMemberId: next ? next.id : s.hostId,
      });
      showToast(
        next
          ? `Voting submitted — ${next.name} is next`
          : "Everyone finished — results revealed to the host"
      );
      return;
    }
    if (s.stage === "vote" && s.currentRound < 2) {
      const nextKey = COLUMN_ORDER[s.currentRound + 1];
      dispatch({ type: "NEXT_ROUND" });
      showToast(`Next topic: ${COLUMNS[nextKey].title}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    dispatch({ type: "TO_REVIEW" });
    showToast("All topics complete — review the results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [finishWriting, showToast]);

  const toggleTimer = useCallback(() => {
    if (!isHost(stateRef.current)) return;
    dispatch({ type: "TIMER_TOGGLE" });
  }, []);

  const resetTimer = useCallback(() => {
    if (!isHost(stateRef.current)) return;
    dispatch({ type: "TIMER_RESET" });
  }, []);

  const voteGroup = useCallback((groupId: string) => {
    const s = stateRef.current;
    const key = activeKey(s);
    if (!key || s.stage !== "vote") return;
    if (memberFinishedVoting(s, key, s.currentMemberId)) return;
    if (memberVotesUsed(s, key) >= VOTE_BUDGET) return;
    dispatch({ type: "VOTE_GROUP", groupId, memberId: s.currentMemberId });
  }, []);

  const renameGroup = useCallback((id: string, title: string) => {
    dispatch({ type: "RENAME_GROUP", id, title });
  }, []);

  const addTheme = useCallback(
    (column: ColumnKey) => {
      if (!isHost(stateRef.current)) return;
      const id = uid("group");
      dispatch({ type: "ADD_THEME", column, id });
      setPendingFocusTheme(id);
    },
    []
  );

  const clearPendingFocusTheme = useCallback(() => setPendingFocusTheme(null), []);

  const moveNote = useCallback(
    (noteId: string, targetGroupId: string) => {
      const s = stateRef.current;
      if (s.stage !== "group" || !isHost(s)) return;
      const source = s.groups.find((g) => g.noteIds.indexOf(noteId) >= 0);
      const target = s.groups.find((g) => g.id === targetGroupId);
      if (!source || !target || target.column !== source.column || target.id === source.id)
        return;
      dispatch({ type: "MOVE_NOTE", noteId, targetGroupId });
      showToast(`Anonymous note moved to ${target.title || "new theme"}`);
    },
    [showToast]
  );

  const moveNoteToNewTheme = useCallback(
    (noteId: string, column: ColumnKey) => {
      const s = stateRef.current;
      if (s.stage !== "group" || !isHost(s)) return;
      const id = uid("group");
      dispatch({ type: "ADD_THEME", column, id });
      dispatch({ type: "MOVE_NOTE", noteId, targetGroupId: id });
      setPendingFocusTheme(id);
      showToast("Anonymous note moved to new theme");
    },
    [showToast]
  );

  const createSession = useCallback(
    (title: string, memberCount: number) => {
      dispatch({
        type: "CREATE_SESSION",
        title: title.trim() || "Sprint retrospective",
        memberCount: Math.min(12, Math.max(1, memberCount)),
      });
      setSessionOpen(false);
      showToast("Session created · you are the host and Member 1");
    },
    [showToast]
  );

  const selectMember = useCallback(
    (id: string) => {
      dispatch({ type: "SELECT_MEMBER", id });
      const s = stateRef.current;
      const member = s.members.find((m) => m.id === id);
      if (member) {
        showToast(
          (id === s.hostId ? "Host selected" : "Anonymous participant selected") +
            " · " +
            member.name
        );
      }
    },
    [showToast]
  );

  const addMember = useCallback(() => {
    const s = stateRef.current;
    if (!isHost(s)) {
      showToast("Only the host can add participants");
      return;
    }
    const name = "Member " + (s.members.length + 1);
    dispatch({ type: "ADD_MEMBER" });
    showToast(`Anonymous ${name} added and selected`);
  }, [showToast]);

  const setTitle = useCallback((title: string) => {
    dispatch({ type: "SET_TITLE", title });
  }, []);

  const normalizeTitle = useCallback(() => {
    const s = stateRef.current;
    const trimmed = s.title.trim();
    dispatch({
      type: "SET_TITLE",
      title: trimmed || "Sprint retrospective",
    });
  }, []);

  const actionFromTheme = useCallback(
    (groupId: string) => {
      dispatch({ type: "ACTION_FROM_THEME", groupId });
      showToast("Action item added");
    },
    [showToast]
  );

  const setActionOwner = useCallback((id: string, owner: string) => {
    dispatch({ type: "SET_ACTION_OWNER", id, owner });
  }, []);

  const setActionDate = useCallback((id: string, date: string) => {
    dispatch({ type: "SET_ACTION_DATE", id, date });
  }, []);

  const toggleActionDone = useCallback(
    (id: string) => {
      const s = stateRef.current;
      const a = s.actions.find((x) => x.id === id);
      dispatch({ type: "TOGGLE_ACTION_DONE", id });
      if (a) showToast(a.done ? "Action reopened" : "Action completed");
    },
    [showToast]
  );

  const downloadBoard = useCallback(() => {
    const s = stateRef.current;
    dispatch({
      type: "SET_TITLE",
      title: s.title.trim() || "Sprint retrospective",
    });
    downloadSnapshot({
      ...s,
      title: s.title.trim() || "Sprint retrospective",
    });
    showToast("Board snapshot downloaded");
  }, [showToast]);

  const importBoardFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const board = parseSnapshot(JSON.parse(text));
        dispatch({ type: "TIMER_STOP" });
        dispatch({ type: "IMPORT_STATE", state: board });
        setSessionOpen(false);
        showToast("Board snapshot opened");
      } catch {
        showToast("That file is not a Retro Board snapshot");
      }
    },
    [showToast]
  );

  const confirmReset = useCallback(() => {
    dispatch({ type: "TIMER_STOP" });
    dispatch({ type: "RESET_BOARD" });
    skipNextSave.current = true;
    clearStoredBoard();
    setResetOpen(false);
    setSessionOpen(true);
    showToast("Board reset · create a new session");
  }, [showToast]);

  // Keyboard shortcuts: Ctrl/Cmd+K opens the note composer while writing;
  // Escape closes the composer and any open dialog/menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeComposer();
        setResetOpen(false);
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

  return {
    state,
    toastMsg,
    sessionOpen,
    setSessionOpen,
    resetOpen,
    setResetOpen,
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
    createSession,
    selectMember,
    addMember,
    setTitle,
    normalizeTitle,
    actionFromTheme,
    setActionOwner,
    setActionDate,
    toggleActionDone,
    downloadBoard,
    importBoardFile,
    confirmReset,
    currentMember: currentMember(state),
    host: isHost(state),
  };
}

export type RetroBoard = ReturnType<typeof useRetroBoard>;
