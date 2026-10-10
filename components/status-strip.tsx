"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import type { RetroBoard } from "@/hooks/use-retro-board";
import {
  activeKey,
  everyoneFinishedVoting,
  memberFinishedVoting,
  memberVotesUsed,
} from "@/lib/selectors";
import { COLUMNS, VOTE_BUDGET } from "@/lib/types";
import { formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

function Prompt({ board }: { board: RetroBoard }) {
  const { state } = board;
  const key = activeKey(state);
  const host = board.host;

  let content: React.ReactNode;
  if (state.stage === "review") {
    content = (
      <>
        <strong className="font-semibold text-slate-900 dark:text-white">
          Discuss the strongest themes.
        </strong>{" "}
        Turn the decisions into clear actions with owners and dates.
      </>
    );
  } else if (state.stage === "write" && key) {
    content = (
      <>
        <strong className="font-semibold text-slate-900 dark:text-white">
          Write quietly.
        </strong>{" "}
        Add one concrete thought about {COLUMNS[key].short}.
      </>
    );
  } else if (state.stage === "group") {
    content = host ? (
      <>
        <strong className="font-semibold text-slate-900 dark:text-white">
          Review the automatic groups.
        </strong>{" "}
        Drag anonymous notes between themes before voting starts.
      </>
    ) : (
      <>
        <strong className="font-semibold text-slate-900 dark:text-white">
          Grouping in progress.
        </strong>{" "}
        The host is correcting themes before voting starts.
      </>
    );
  } else if (key && everyoneFinishedVoting(state, key)) {
    content = (
      <>
        <strong className="font-semibold text-slate-900 dark:text-white">
          Voting complete.
        </strong>{" "}
        Results are revealed; highest-voted themes appear first.
      </>
    );
  } else {
    content = (
      <>
        <strong className="font-semibold text-slate-900 dark:text-white">
          Vote privately.
        </strong>{" "}
        Totals stay hidden until every anonymous member finishes.
      </>
    );
  }
  return (
    <div className="text-sm text-slate-600 dark:text-slate-300" id="sessionPrompt">
      {content}
    </div>
  );
}

export function StatusStrip({ board }: { board: RetroBoard }) {
  const { state } = board;
  const key = activeKey(state);
  const host = board.host;
  const review = state.stage === "review";
  const member = board.currentMember;

  const showBudget =
    state.stage === "vote" && key !== null && !everyoneFinishedVoting(state, key);
  const remaining = key ? Math.max(0, VOTE_BUDGET - memberVotesUsed(state, key)) : 0;
  const iAmDone = key !== null && memberFinishedVoting(state, key, state.currentMemberId);

  const showTimer = state.stage === "write" || review;

  let advanceLabel = "";
  let advanceDisabled = false;
  const advanceHidden = review;
  if (state.stage === "write") {
    advanceLabel = host ? "Finish writing" : "Waiting for host";
    advanceDisabled = !host;
  } else if (state.stage === "group") {
    advanceLabel = host ? "Start voting" : "Waiting for host";
    advanceDisabled = !host;
  } else if (key && everyoneFinishedVoting(state, key)) {
    advanceLabel = host
      ? state.currentRound < 2
        ? "Next topic"
        : "Review results"
      : "Waiting for host";
    advanceDisabled = !host;
  } else {
    advanceLabel = iAmDone ? "Voting submitted" : "Finish my voting";
    advanceDisabled = iAmDone;
  }

  return (
    <section
      aria-label="Session status"
      className="glass mb-4 grid items-center gap-4 rounded-2xl p-4 md:grid-cols-[minmax(220px,1fr)_auto]"
    >
      <Prompt board={board} />
      <div className="flex flex-wrap items-center justify-end gap-2 max-md:justify-start">
        <div
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/50 bg-white/50 p-1 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
          aria-label="Current anonymous participant"
        >
          <Badge
            className={cn(
              "font-mono text-[9px] tracking-wider uppercase",
              host
                ? "border-transparent bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-200/70 text-slate-500 dark:bg-white/10 dark:text-slate-400"
            )}
          >
            {host ? "Host" : "Member"}
          </Badge>
          <select
            aria-label="Current anonymous participant"
            value={state.currentMemberId}
            onChange={(e) => board.selectMember(e.target.value)}
            className="max-w-[152px] border-0 bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-700 focus:outline-none dark:text-slate-200"
          >
            {state.members.map((m) => {
              const finished =
                state.stage === "vote" &&
                key !== null &&
                memberFinishedVoting(state, key, m.id);
              const label = (m.id === state.hostId ? "Host · " : "") + m.name;
              return (
                <option key={m.id} value={m.id}>
                  {label}
                  {finished ? " · done" : ""}
                </option>
              );
            })}
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={board.addMember}
            disabled={!host}
            className="h-8 text-xs"
          >
            + Member
          </Button>
        </div>

        {showBudget && (
          <Badge
            variant="outline"
            className="glass font-mono text-xs text-slate-600 dark:text-slate-300"
          >
            {iAmDone
              ? `${member.name}: voting submitted`
              : `${member.name}: ${remaining} ${remaining === 1 ? "vote left" : "votes left"}`}
          </Badge>
        )}

        {showTimer && (
          <div
            className="inline-flex items-center gap-1 rounded-xl border border-white/50 bg-white/50 p-1 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
            aria-label="Writing timer"
          >
            <span className="min-w-[57px] text-center font-mono text-[13px] font-medium text-slate-800 tabular-nums dark:text-slate-100">
              {formatTime(state.timerSeconds)}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={board.toggleTimer}
              disabled={!host}
              aria-label={state.timerRunning ? "Pause timer" : "Start timer"}
              title={state.timerRunning ? "Pause timer" : "Start timer"}
            >
              {state.timerRunning ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={board.resetTimer}
              disabled={!host}
              aria-label="Reset timer"
              title="Reset timer"
            >
              <RotateCcw className="size-4" />
            </Button>
          </div>
        )}

        {!advanceHidden && (
          <Button onClick={board.advance} disabled={advanceDisabled}>
            {advanceLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
