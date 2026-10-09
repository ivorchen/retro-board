"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * shadcn-style dialog shell rendered with the board's own dialog styling:
 * fixed backdrop, centered panel, closes on backdrop click.
 */
function Dialog({ open, onClose, labelledBy, children, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open ]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn("dialog", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>
  );
}

function DialogTitle({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return <h2 id={id}>{children}</h2>;
}

function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="dialog-foot">{children}</div>;
}

export { Dialog, DialogTitle, DialogDescription, DialogFooter };
