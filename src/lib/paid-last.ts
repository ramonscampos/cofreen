import type { DashboardItem } from "@/types";

// Only expenses get paid off; the paid flag of an income is not shown
export function isPaidItem(item: DashboardItem): boolean {
  return item.kind === "expense" && item.paid;
}

// Pending items first, paid ones after; the order inside each group is kept
export function splitPaidLast(items: DashboardItem[]): {
  pending: DashboardItem[];
  paid: DashboardItem[];
} {
  const pending: DashboardItem[] = [];
  const paid: DashboardItem[] = [];
  for (const item of items) {
    (isPaidItem(item) ? paid : pending).push(item);
  }
  return { pending, paid };
}
