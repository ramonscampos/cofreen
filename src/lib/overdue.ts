import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  getPreviousMonthRef,
  mergeTransactionsAndTemplates,
} from "@/lib/finance-logic";
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
  const previousMonthRef = getPreviousMonthRef(monthRef);
  if (previousMonthRef < OVERDUE_START_MONTH) return [];
  if (monthRef > format(today, "yyyy-MM")) return [];

  const monthName = format(parse(previousMonthRef, "yyyy-MM", today), "MMM", {
    locale: ptBR,
  });

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
      overdueLabel: `Atrasada · ${monthName}`,
    }));
}
