"use client";

import * as React from "react";
import { useRetroBoard } from "@/hooks/use-retro-board";
import { TopBar } from "@/components/top-bar";
import { StatusStrip } from "@/components/status-strip";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { Board } from "@/components/board";
import { ActionSection } from "@/components/action-section";
import { ComposerDialog, ResetDialog, SessionDialog } from "@/components/dialogs";
import { Toast } from "@/components/toast";

export default function Page() {
  const board = useRetroBoard();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (file) await board.importBoardFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const review = board.state.stage === "review";

  return (
    <div className="app">
      <TopBar board={board} />
      <main className="workspace">
        <StatusStrip board={board} />
        <WorkflowStepper board={board} />
        {review && (
          <div className="review-intro">
            <strong>Review the results.</strong> The highest-voted themes appear
            first. Discuss what matters most, then turn a theme into an owned
            action.
          </div>
        )}
        <Board board={board} />
        {review && <ActionSection board={board} />}
      </main>

      <ComposerDialog board={board} />
      <SessionDialog board={board} />
      <ResetDialog board={board} />
      <Toast message={board.toastMsg} />

      <input
        id="board-file-input"
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={onFileChange}
      />
    </div>
  );
}
