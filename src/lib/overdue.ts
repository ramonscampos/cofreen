import { format, parse, subMonths } from "date-fns";
import { mergeTransactionsAndTemplates } from "@/lib/finance-logic";
import type { DashboardItem, RecurringTemplate, Transaction } from "@/types";

// Payment marks before this month were wiped in the move to synced cards
const OVERDUE_START_MONTH = "2026-11";

// Last month's expenses that were never marked paid show up again, as overdue
export function buildOverdueItems(
  previousTransactions: Transaction[],
  templates: RecurringTemplate[],
  monthRef: string,
  today: Date,
): DashboardItem[] {
  const previousMonthRef = format(
    subMonths(parse(monthRef, "yyyy-MM", today), 1),
    "yyyy-MM",
  );
  if (previousMonthRef < OVERDUE_START_MONTH) return [];
  if (monthRef > format(today, "yyyy-MM")) return [];

  return mergeTransactionsAndTemplates(
    previousTransactions,
    templates,
    previousMonthRef,
  )
    .filter((item) => item.kind === "expense" && !item.paid)
    .map((item) => ({
      ...item,
      id: `overdue-${previousMonthRef}-${item.id}`,
      monthRef: previousMonthRef,
      overdueFromMonthRef: previousMonthRef,
    }));
}
