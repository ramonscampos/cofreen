import type { SyncStatus } from "@/types";

const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Opening the app syncs at most once a day; failures count as attempts so a
// broken connection doesn't retry on every visit (the manual button still can)
export function shouldAutoSync(status: SyncStatus | null, now: Date): boolean {
  const attempts = [status?.lastSuccessAt, status?.lastErrorAt]
    .filter((value): value is string => !!value)
    .map((value) => new Date(value).getTime());
  if (attempts.length === 0) return true;
  return now.getTime() - Math.max(...attempts) >= AUTO_SYNC_INTERVAL_MS;
}
