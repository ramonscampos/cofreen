import { differenceInCalendarMonths, parse } from "date-fns";
import type {
  CreateTransactionPayload,
  DashboardItem,
  RecurringTemplate,
  Transaction,
} from "@/types";

export function getCurrentMonthRef(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getPreviousMonthRef(monthRef: string): string {
  const [yearStr, monthStr] = monthRef.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const date = new Date(year, month - 1 - 1, 1); // Subtract 1 for index, 1 for prev month
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${newYear}-${newMonth}`;
}

export function getNextMonthRef(monthRef: string): string {
  const [yearStr, monthStr] = monthRef.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const date = new Date(year, month - 1 + 1, 1); // Subtract 1 for index, +1 for next
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${newYear}-${newMonth}`;
}

export function formatMonthDisplay(monthRef: string): string {
  const [year, month] = monthRef.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  // Portuguese format: "janeiro 2024"
  return date.toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

export function getMonthDiff(fromMonthRef: string, toMonthRef: string): number {
  const reference = new Date();
  return differenceInCalendarMonths(
    parse(toMonthRef, "yyyy-MM", reference),
    parse(fromMonthRef, "yyyy-MM", reference),
  );
}

// Installment amounts are stored as the purchase total
export function getMonthlyAmount(
  amount: number,
  installmentTotal?: number | null,
): number {
  return installmentTotal && installmentTotal > 1
    ? amount / installmentTotal
    : amount;
}

// Card spending comes from synced card bills (see lib/cards). Legacy rows tied
// to a card are ignored so they never double count against a bill.
export function mergeTransactionsAndTemplates(
  transactions: Transaction[],
  templates: RecurringTemplate[],
  monthRef: string,
): DashboardItem[] {
  const items: DashboardItem[] = [];
  const ownTransactions = transactions.filter((t) => !t.cardId);

  // 1. Add all real transactions
  ownTransactions.forEach((t) => {
    items.push({
      id: t.id,
      kind: t.kind,
      description: t.description,
      amount: Number(t.amount),
      paid: !!t.paid,
      isRecurring: !!t.isRecurring,
      transactionId: t.id,
      originalTemplateId: t.templateId ?? undefined,
      day: t.transactionDate
        ? new Date(`${t.transactionDate}T12:00:00`).getDate()
        : new Date(t.createdAt).getDate(),
      installmentCurrent: t.installmentCurrent ?? undefined,
      installmentTotal: t.installmentTotal ?? undefined,
    });
  });

  // 2. Process Templates (Manual Installments or Recurring)
  templates.forEach((template) => {
    if (template.isActive === false || template.cardId) return;

    // Common Rule: Respect start month
    if (template.monthRef && template.monthRef > monthRef) return;

    // Calculate dynamic installment info for Manual Installments
    let effectiveCurrent: number | undefined;
    let effectiveTotal: number | undefined;
    let isInstallmentPlan = false;

    if (template.installmentTotal && template.installmentTotal > 1) {
      const diffMonths = getMonthDiff(template.monthRef || monthRef, monthRef);
      const current = (template.installmentCurrent || 1) + diffMonths;

      if (current > template.installmentTotal) return; // Finished

      effectiveCurrent = current;
      effectiveTotal = template.installmentTotal;
      isInstallmentPlan = true;
    }

    // Check if there is already a transaction for this template in this month (Manual override)
    const hasTransaction = ownTransactions.some(
      (t) => t.templateId === template.id && t.monthRef === monthRef,
    );

    if (!hasTransaction) {
      items.push({
        id: template.id,
        kind: template.kind,
        description: template.description,
        amount: Number(template.defaultAmount),
        paid: false,
        isRecurring: !isInstallmentPlan, // If installment, distinct icon
        originalTemplateId: template.id,
        day: template.dayOfMonth,
        installmentCurrent: effectiveCurrent,
        installmentTotal: effectiveTotal,
      });
    }
  });

  // Sort by day (approximate)
  return items.sort((a, b) => (a.day || 0) - (b.day || 0));
}

export interface MonthTotals {
  incoming: number;
  expense: number;
  total: number;
}

export function calculateTotals(items: DashboardItem[]): MonthTotals {
  let incoming = 0;
  let expense = 0;

  items.forEach((item) => {
    if (item.kind === "incoming") {
      incoming += item.amount;
    } else if (item.kind === "expense") {
      expense += getMonthlyAmount(item.amount, item.installmentTotal);
    }
  });

  return { incoming, expense, total: incoming - expense };
}

// Payload for materializing a projected template as a paid transaction.
// Installment fields must travel along, since amounts are stored as totals.
export function buildPaidTemplateTransaction(
  item: DashboardItem,
  monthRef: string,
): CreateTransactionPayload & { templateId: string } {
  return {
    description: item.description,
    amount: item.amount,
    kind: item.kind,
    monthRef,
    paid: true,
    templateId: item.originalTemplateId ?? item.id,
    isRecurring: item.isRecurring,
    installmentCurrent: item.installmentCurrent ?? null,
    installmentTotal: item.installmentTotal ?? null,
  };
}
