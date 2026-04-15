import type {
  Card,
  CardTransaction,
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

export function mergeTransactionsAndTemplates(
  transactions: Transaction[],
  templates: RecurringTemplate[],
  monthRef: string,
  cards: Card[] = [],
  cardTransactions: CardTransaction[] = [],
): DashboardItem[] {
  const items: DashboardItem[] = [];

  // Store recurring templates that are linked to cards here, to merge later
  const recurringCardTemplates: DashboardItem[] = [];

  // 1. Add all real transactions
  transactions.forEach((t) => {
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
      cardId: t.cardId ?? undefined,
    });
  });

  // 2. Process Templates (Manual Installments or Recurring)
  templates.forEach((template) => {
    if (template.isActive === false) return;

    // Common Rule: Respect start month
    if (template.monthRef && template.monthRef > monthRef) return;

    // Calculate dynamic installment info for Manual Installments
    let effectiveCurrent: number | undefined;
    let effectiveTotal: number | undefined;
    let isInstallmentPlan = false;

    if (template.installmentTotal && template.installmentTotal > 1) {
      const [viewYear, viewMonth] = monthRef.split("-").map(Number);
      const [startYear, startMonth] = (template.monthRef || monthRef)
        .split("-")
        .map(Number);

      const diffMonths = (viewYear - startYear) * 12 + (viewMonth - startMonth);
      const current = (template.installmentCurrent || 1) + diffMonths;

      if (current > template.installmentTotal) return; // Finished

      effectiveCurrent = current;
      effectiveTotal = template.installmentTotal;
      isInstallmentPlan = true;
    }

    // Check if there is already a transaction for this template in this month (Manual override)
    const hasTransaction = transactions.some(
      (t) => t.templateId === template.id && t.monthRef === monthRef,
    );

    if (!hasTransaction) {
      const newItem = {
        id: template.id,
        kind: template.kind,
        description: template.description,
        amount: Number(template.defaultAmount),
        paid: false,
        isRecurring: !isInstallmentPlan, // If installment, distinct icon
        originalTemplateId: template.id,
        day: template.dayOfMonth,
        installmentCurrent: effectiveCurrent ?? undefined,
        installmentTotal: effectiveTotal ?? undefined,
        cardId: template.cardId ?? undefined, // Ensure cardId is passed
      };

      // If this template is linked to a card, store it for later grouping
      if (template.cardId) {
        recurringCardTemplates.push(newItem);
      } else {
        items.push(newItem);
      }
    }
  });

  // 3. Process Cards (Virtual vs Manual Bills)
  cards.forEach((card) => {
    // Find the sub-transactions for this card/month
    const subTransactions = cardTransactions.filter(
      (ct) => ct.cardId === card.id && ct.monthRef === monthRef,
    );

    // Calculate sum of real transactions
    const subSum = subTransactions.reduce((acc, curr) => {
      const val =
        curr.installmentTotal && curr.installmentTotal > 1
          ? Number(curr.amount) / curr.installmentTotal
          : Number(curr.amount);
      return acc + val;
    }, 0);

    // Find recurring templates for this card
    const cardRecurringItems = recurringCardTemplates.filter(
      (item) => item.cardId === card.id,
    );

    // Merge them into the subTransactions logic for display
    const mappedRecurring: CardTransaction[] = cardRecurringItems.map(
      (item) => ({
        id: item.id,
        userId: "",
        cardId: card.id,
        monthRef: monthRef,
        description: item.description,
        amount: item.amount.toString(),
        installmentTotal: item.installmentTotal,
        installmentCurrent: item.installmentCurrent,
        createdAt: new Date().toISOString(),
        isRecurring: item.isRecurring,
      }),
    );

    // Calculate sum of recurring items
    const recurringSum = mappedRecurring.reduce((acc, curr) => {
      return acc + Number(curr.amount);
    }, 0);

    const finalSum = subSum + recurringSum;
    const finalSubTransactions = [...subTransactions, ...mappedRecurring];

    // Check if there is already a MANUAL transaction (bill) for this card
    const manualBillIndex = items.findIndex(
      (item) => item.cardId === card.id && item.transactionId,
    );

    if (manualBillIndex >= 0) {
      // If manual bill exists, we attach the full list of transactions (including recurring)
      // so they can be seen in expanded view.
      // We do NOT update the amount, as manual bill amount is user-defined.
      items[manualBillIndex].cardTransactions = finalSubTransactions;
      items[manualBillIndex].cardColor = card.color;
    } else {
      // Virtual Bill: Sum everything up
      items.push({
        id: `virtual-card-${card.id}`,
        kind: "expense",
        description: card.bankName,
        amount: finalSum,
        paid: false,
        isRecurring: false,
        day: card.dueDay,
        cardId: card.id,
        cardColor: card.color,
        cardTransactions: finalSubTransactions,
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

// This function relies on 'items' being fully merged with Card logic.
// Manual Bills are in 'items'. Virtual Bills are in 'items'.
// Regular expenses are in 'items'.
export function calculateTotals(items: DashboardItem[]): MonthTotals {
  let incoming = 0;
  let expense = 0;

  items.forEach((item) => {
    if (item.kind === "incoming") {
      incoming += item.amount;
    } else if (item.kind === "expense") {
      // Logic:
      // If it's a Manual Bill (Transaction with cardId) -> Added.
      // If it's a Virtual Bill (starts with virtual-) -> Added.
      // If it's a regular expense -> Added.
      // Templates are also added if merged.

      const val =
        item.installmentTotal && item.installmentTotal > 1
          ? item.amount / item.installmentTotal
          : item.amount;

      expense += val;
    }
  });

  return { incoming, expense, total: incoming - expense };
}
