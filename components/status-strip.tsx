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
        <strong>Discuss the strongest themes.</strong> Turn the decisions into
        clear actions with owners and dates.
      </>
    );
  } else if (state.stage === "write" && key) {
    content = (
      <>
        <strong>Write quietly.</strong> Add one concrete thought about{" "}
        {COLUMNS[key].short}.
      </>
    );
  } else if (state.stage === "group") {
    content = host ? (
      <>
        <strong>Review the automatic groups.</strong> Drag anonymous notes
        between themes before voting starts.
      </>
    ) : (
      <>
        <strong>Grouping in progress.</strong> The host is correcting themes
        before voting starts.
      </>
    );
  } else if (key && everyoneFinishedVoting(state, key)) {
    content = (
      <>
        <strong>Voting complete.</strong> Results are revealed; highest-voted
        themes appear first.
      </>
    );
  } else {
    content = (
      <>
        <strong>Vote privately.</strong> Totals stay hidden until every
        anonymous member finishes.
      </>
    );
  }
  return (
    <div className="prompt" id="sessionPrompt">
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
    <section className="status-strip" aria-label="Session status">
      <Prompt board={board} />
      <div className="tools">
        <div className="member-switch" aria-label="Current anonymous participant">
          <Badge variant={host ? "host" : "member"}>
            {host ? "HOST" : "MEMBER"}
          </Badge>
          <select
            aria-label="Current anonymous participant"
            value={state.currentMemberId}
            onChange={(e) => board.selectMember(e.target.value)}
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
          <Button onClick={board.addMember} disabled={!host}>
            + Member
          </Button>
        </div>

        {showBudget && (
          <Badge variant="budget">
            {iAmDone
              ? `${member.name}: voting submitted`
              : `${member.name}: ${remaining} ${remaining === 1 ? "vote left" : "votes left"}`}
          </Badge>
        )}

        {showTimer && (
          <div className="timer" aria-label="Writing timer">
            <span className="time-value">{formatTime(state.timerSeconds)}</span>
            <Button
              size="icon"
              onClick={board.toggleTimer}
              disabled={!host}
              aria-label={state.timerRunning ? "Pause timer" : "Start timer"}
              title={state.timerRunning ? "Pause timer" : "Start timer"}
            >
              {state.timerRunning ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button
              size="icon"
              onClick={board.resetTimer}
              disabled={!host}
              aria-label="Reset timer"
              title="Reset timer"
            >
              <RotateCcw size={16} />
            </Button>
          </div>
        )}

        {!advanceHidden && (
          <Button variant="primary" onClick={board.advance} disabled={advanceDisabled}>
            {advanceLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
