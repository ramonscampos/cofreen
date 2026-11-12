"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  formatMonthDisplay,
  getNextMonthRef,
  getPreviousMonthRef,
} from "@/lib/finance-logic";

interface MonthSwitcherProps {
  monthRef: string;
}

export function MonthSwitcher({ monthRef }: MonthSwitcherProps) {
  const pathname = usePathname();

  // Only the URL changes; month data comes from the client cache, so there
  // is no server render on every switch
  const goTo = (month: string) =>
    window.history.pushState(null, "", `${pathname}?month=${month}`);
  const handlePrev = () => goTo(getPreviousMonthRef(monthRef));
  const handleNext = () => goTo(getNextMonthRef(monthRef));

  return (
    <div className="flex items-center gap-1 text-gray-6 sm:gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        aria-label="Mês anterior"
        onClick={handlePrev}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span
        aria-live="polite"
        className="min-w-36 whitespace-nowrap text-center text-base font-bold capitalize"
      >
        {formatMonthDisplay(monthRef)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        aria-label="Próximo mês"
        onClick={handleNext}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
