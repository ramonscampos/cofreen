import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white ring-offset-background placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {/* Custom arrow icon could go here if we wanted to hide native appearance entirely */}
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
