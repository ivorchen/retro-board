import type { BoardState, ColumnKey, Member, Note, RetroGroup } from "./types";
import { COLUMN_ORDER } from "./types";

export function activeKey(state: BoardState): ColumnKey | null {
  return COLUMN_ORDER[state.currentRound] || null;
}

export function currentMember(state: BoardState): Member {
  return (
    state.members.find((m) => m.id === state.currentMemberId) || state.members[0]
  );
}

export function isHost(state: BoardState): boolean {
  return state.currentMemberId === state.hostId;
}

export function memberName(state: BoardState, id: string): string {
  const member = state.members.find((m) => m.id === id);
  return member ? member.name : "Member";
}

export function groupsFor(state: BoardState, key: ColumnKey): RetroGroup[] {
  return state.groups.filter((g) => g.column === key);
}

export function completedVoters(state: BoardState, key: ColumnKey): string[] {
  const list = state.voteCompletions && state.voteCompletions[key];
  return Array.isArray(list) ? list : [];
}

export function memberFinishedVoting(
  state: BoardState,
  key: ColumnKey,
  id: string
): boolean {
  return completedVoters(state, key).indexOf(id) >= 0;
}

export function everyoneFinishedVoting(
  state: BoardState,
  key: ColumnKey
): boolean {
  return (
    state.members.length > 0 &&
    state.members.every((member) => memberFinishedVoting(state, key, member.id))
  );
}

export function memberVotesUsed(state: BoardState, key: ColumnKey): number {
  return groupsFor(state, key).reduce(
    (total, g) =>
      total + Math.max(0, Number(g.votesBy && g.votesBy[state.currentMemberId]) || 0),
    0
  );
}

export function notesForGroup(state: BoardState, group: RetroGroup): Note[] {
  return group.noteIds
    .map((id) => state.notes.find((n) => n.id === id))
    .filter((n): n is Note => Boolean(n));
}

export function votesForGroup(group: RetroGroup): number {
  return group.votes;
}
