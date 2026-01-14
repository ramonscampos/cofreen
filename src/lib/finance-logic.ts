import { DashboardItem, RecurringTemplate, Transaction } from "@/types"

export function getCurrentMonthRef(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function getPreviousMonthRef(monthRef: string): string {
  const [yearStr, monthStr] = monthRef.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  const date = new Date(year, month - 1 - 1, 1) // Subtract 1 for index, 1 for prev month
  const newYear = date.getFullYear()
  const newMonth = String(date.getMonth() + 1).padStart(2, '0')
  return `${newYear}-${newMonth}`
}

export function getNextMonthRef(monthRef: string): string {
  const [yearStr, monthStr] = monthRef.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  const date = new Date(year, month - 1 + 1, 1) // Subtract 1 for index, +1 for next
  const newYear = date.getFullYear()
  const newMonth = String(date.getMonth() + 1).padStart(2, '0')
  return `${newYear}-${newMonth}`
}

export function formatMonthDisplay(monthRef: string): string {
  const [year, month] = monthRef.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  // Portuguese format: "janeiro 2024"
  return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

export function mergeTransactionsAndTemplates(
  transactions: Transaction[],
  templates: RecurringTemplate[],
  monthRef: string
): DashboardItem[] {
  const items: DashboardItem[] = []
  
  // 1. Add all real transactions
  transactions.forEach(t => {
    items.push({
      type: 'real',
      id: t.id,
      kind: t.kind,
      description: t.description,
      amount: Number(t.amount),
      paid: t.paid,
      isRecurring: t.is_recurring,
      transactionId: t.id,
      originalTemplateId: t.template_id || undefined,
      // approximate day from created_at
      day: new Date(t.created_at).getDate(),
      installmentCurrent: t.installment_current || undefined,
      installmentTotal: t.installment_total || undefined
    })
  })

  // 2. Add templates that don't have a matching transaction for this month
  templates.forEach(template => {
    if (!template.is_active) return

    // New Rule: If template has a start month (month_ref), strictly respect it.
    // If template.month_ref > current monthRef, it hasn't started yet.
    if (template.month_ref && template.month_ref > monthRef) return

    // Check if there is already a transaction for this template in this month
    const hasTransaction = transactions.some(
      t => t.template_id === template.id && t.month_ref === monthRef
    )

    if (!hasTransaction) {
      items.push({
        type: 'expected',
        id: template.id,
        kind: template.kind,
        description: template.description,
        amount: Number(template.default_amount),
        paid: false,
        isRecurring: true,
        originalTemplateId: template.id,
        day: template.day_of_month
      })
    }
  })

  // Sort by day (approximate)
  return items.sort((a, b) => (a.day || 0) - (b.day || 0))
}

export interface MonthTotals {
  incoming: number
  expense: number
  total: number
}

// This function needs to be robust to handle the requirements:
// - Expense Total = Sum of normal expenses + Manual Card Bills + VIRTUAL Card Bills (if no manual bill exists)
export function calculateTotals(
  items: DashboardItem[],
  initialCards: { id: string }[],
  initialCardTransactions: { card_id: string, month_ref: string, amount: number }[],
  initialTransactions: { kind: string, card_id?: string | null, month_ref: string }[],
  currentMonthRef: string
): MonthTotals {
  let incoming = 0;
  let expense = 0;

  items.forEach((item) => {
    if (item.type === "real") {
      if (item.kind === "incoming") {
        incoming += item.amount;
      } else {
        // It is an expense.
        // If it has a card_id, it is a manual card bill. It affects totals.
        // If it has NO card_id, it is a normal expense. It affects totals.
        expense += item.amount;
      }
    }
  });

  // NOW, handle the "Calculated card bill" part.
  initialCards.forEach((card) => {
    const hasManualBill = initialTransactions.some(
      (t) =>
        t.kind === "expense" &&
        t.card_id === card.id &&
        t.month_ref === currentMonthRef,
    );

    if (!hasManualBill) {
      // Calculate virtual bill
      const virtualSum = initialCardTransactions
        .filter(
          (ct) => ct.card_id === card.id && ct.month_ref === currentMonthRef,
        )
        .reduce((sum, ct) => sum + Number(ct.amount), 0);

      expense += virtualSum;
    }
  });

  return { incoming, expense, total: incoming - expense };
}
