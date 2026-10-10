import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-xl border border-slate-300/70 bg-white/60 px-3 py-2 text-sm text-slate-900 shadow-sm backdrop-blur-md transition-colors placeholder:text-slate-400 focus-visible:border-violet-400 focus-visible:ring-2 focus-visible:ring-violet-400/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
