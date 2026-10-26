import { Skeleton } from "@/components/ui/skeleton";

// Static keys: placeholder rows have no identity of their own
const CARD_ROWS = ["card-1", "card-2", "card-3"];
const LIST_ROWS = ["row-1", "row-2", "row-3", "row-4", "row-5", "row-6"];

// Mirrors the dashboard layout so content doesn't jump when it arrives
export function DashboardSkeleton() {
  return (
    <div
      className="space-y-8"
      role="status"
      aria-busy="true"
      aria-label="Carregando mês"
    >
      <div className="grid gap-8 md:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-lg bg-[#323238] p-6 space-y-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-36" />
        <Skeleton className="h-12 w-36" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-6 w-24" />
        {CARD_ROWS.map((row) => (
          <div
            key={row}
            className="flex min-h-16 items-center gap-4 rounded-md bg-[#29292e] px-4"
          >
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {LIST_ROWS.map((row) => (
          <div
            key={row}
            className="grid min-h-16 grid-cols-[4fr_2fr_2fr_1fr] items-center gap-4 rounded-md bg-[#29292e] px-4"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-8" />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
