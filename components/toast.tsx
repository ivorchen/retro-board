"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toast({ message }: { message: string | null }) {
  return (
    <div
      className={cn(
        "glass-strong pointer-events-none fixed bottom-[max(22px,env(safe-area-inset-bottom))] left-1/2 z-[100] flex -translate-x-1/2 translate-y-4 items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium text-slate-800 opacity-0 transition-all duration-200 dark:text-slate-100",
        message && "translate-y-0 opacity-100"
      )}
      role="status"
      aria-live="polite"
    >
      <CheckCircle2
        className="size-4 shrink-0 text-emerald-500"
        aria-hidden="true"
      />
      {message}
    </div>
  );
}
