"use client";

import * as React from "react";
import CurrencyInput, { CurrencyInputProps } from "react-currency-input-field";
import { cn } from "@/lib/utils";

export interface MoneyInputProps extends Omit<CurrencyInputProps, "className"> {
  className?: string; // allow string override
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, onValueChange, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">
          R$
        </span>
        <CurrencyInput
          decimalsLimit={2}
          decimalSeparator=","
          groupSeparator="."
          className={cn(
            "flex h-12 w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 focus-visible:outline-none focus:border-[#00875f] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            className
          )}
          onValueChange={onValueChange}
          title="Input currency" 
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";
