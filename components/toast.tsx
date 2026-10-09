"use client";

import { cn } from "@/lib/utils";

export function Toast({ message }: { message: string | null }) {
  return (
    <div
      className={cn("toast", message && "show")}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
