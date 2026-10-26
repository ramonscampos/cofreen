import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-md bg-zinc-700/40 motion-safe:animate-pulse",
        className,
      )}
    />
  );
}
