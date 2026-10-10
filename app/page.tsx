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
    <div className="min-h-screen">
      <TopBar board={board} />
      <main className="mx-auto w-full max-w-[1560px] px-4 pt-5 pb-14 sm:px-6">
        <StatusStrip board={board} />
        <WorkflowStepper board={board} />
        {review && (
          <div className="glass mb-4 rounded-2xl p-4 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            <strong className="font-semibold text-slate-900 dark:text-white">
              Review the results.
            </strong>{" "}
            The highest-voted themes appear first. Discuss what matters most,
            then turn a theme into an owned action.
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
