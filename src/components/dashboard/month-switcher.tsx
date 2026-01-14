"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const handlePrev = () => {
    const prev = getPreviousMonthRef(monthRef);
    router.push(`/?month=${prev}`);
  };

  const handleNext = () => {
    const next = getNextMonthRef(monthRef);
    router.push(`/?month=${next}`);
  };

  return (
    <div className="flex items-center gap-2 text-gray-6">
      <Button type="button" variant="ghost" size="icon" onClick={handlePrev}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-base font-bold capitalize min-w-35 text-center">
        {formatMonthDisplay(monthRef)}
      </span>
      <Button type="button" variant="ghost" size="icon" onClick={handleNext}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
