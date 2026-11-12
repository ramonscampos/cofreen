"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

interface PaidGroupProps {
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

// Collapsible "Pagos" group. Height animates through grid rows (0fr -> 1fr),
// which needs no measuring, so the layout never jumps.
export function PaidGroup({
  count,
  open,
  onOpenChange,
  children,
}: PaidGroupProps) {
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className="flex min-h-11 w-full items-center gap-3 text-xs uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <span>Pagos ({count})</span>
        <span className="h-px flex-1 bg-zinc-800" aria-hidden />
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        {/* inert keeps hidden rows out of the tab order and the a11y tree */}
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <div className="space-y-4 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
