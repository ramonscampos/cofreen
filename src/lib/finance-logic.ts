import { Card, CardTransaction, DashboardItem, RecurringTemplate, Transaction } from "@/types"

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
  monthRef: string,
  cards: Card[] = [],
  cardTransactions: CardTransaction[] = []
): DashboardItem[] {
  const items: DashboardItem[] = []
  
  // Store recurring templates that are linked to cards here, to merge later
  const recurringCardTemplates: DashboardItem[] = []
  
  // 1. Add all real transactions
  transactions.forEach(t => {
    items.push({
      id: t.id,
      kind: t.kind,
      description: t.description,
      amount: Number(t.amount),
      paid: t.paid,
      isRecurring: t.is_recurring,
      transactionId: t.id,
      originalTemplateId: t.template_id || undefined,
      day: t.transaction_date 
        ? new Date(t.transaction_date + 'T12:00:00').getDate() 
        : new Date(t.created_at).getDate(),
      installmentCurrent: t.installment_current || undefined,
      installmentTotal: t.installment_total || undefined,
      cardId: t.card_id || undefined,
    })
  })

  // 2. Process Templates (Manual Installments or Recurring)
  templates.forEach(template => {
    if (!template.is_active) return

    // Common Rule: Respect start month
    if (template.month_ref && template.month_ref > monthRef) return

    // Calculate dynamic installment info for Manual Installments
    let effectiveCurrent = undefined;
    let effectiveTotal = undefined;
    let isInstallmentPlan = false;

    if (template.installment_total && template.installment_total > 1) {
       const [viewYear, viewMonth] = monthRef.split('-').map(Number);
       const [startYear, startMonth] = (template.month_ref || monthRef).split('-').map(Number);
       
       const diffMonths = (viewYear - startYear) * 12 + (viewMonth - startMonth);
       const current = (template.installment_current || 1) + diffMonths;

       if (current > template.installment_total) return; // Finished

       effectiveCurrent = current;
       effectiveTotal = template.installment_total;
       isInstallmentPlan = true;
    }

    // Check if there is already a transaction for this template in this month (Manual override)
    const hasTransaction = transactions.some(
      t => t.template_id === template.id && t.month_ref === monthRef
    )



    if (!hasTransaction) {
      const newItem = {
        id: template.id,
        kind: template.kind,
        description: template.description,
        amount: Number(template.default_amount),
        paid: false,
        isRecurring: !isInstallmentPlan, // If installment, distinct icon
        originalTemplateId: template.id,
        day: template.day_of_month,
        installmentCurrent: effectiveCurrent,
        installmentTotal: effectiveTotal,
        cardId: template.card_id, // Ensure cardId is passed
      }

      // If this template is linked to a card, store it for later grouping
      if (template.card_id) {
        recurringCardTemplates.push(newItem)
      } else {
        items.push(newItem)
      }
    }
  })

  // 3. Process Cards (Virtual vs Manual Bills)
  cards.forEach(card => {
     // Find the sub-transactions for this card/month
     const subTransactions = cardTransactions.filter(ct => ct.card_id === card.id && ct.month_ref === monthRef)

     // Calculate sum of real transactions
     const subSum = subTransactions.reduce((acc, curr) => {
          const val = (curr.installment_total && curr.installment_total > 1)
             ? Number(curr.amount) / curr.installment_total
             : Number(curr.amount);
          return acc + val;
     }, 0)

     // Find recurring templates for this card
     const cardRecurringItems = recurringCardTemplates.filter(item => item.cardId === card.id)
        
     // Merge them into the subTransactions logic for display
     const mappedRecurring: CardTransaction[] = cardRecurringItems.map(item => ({
          id: item.id,
          user_id: '',
          card_id: card.id,
          month_ref: monthRef,
          description: item.description,
          amount: item.amount,
          installment_total: item.installmentTotal,
          installment_current: item.installmentCurrent,
          created_at: new Date().toISOString(),
          is_recurring: item.isRecurring
     }))

     // Calculate sum of recurring items
     const recurringSum = mappedRecurring.reduce((acc, curr) => {
           return acc + Number(curr.amount);
     }, 0)
        
     const finalSum = subSum + recurringSum
     const finalSubTransactions = [...subTransactions, ...mappedRecurring]

     // Check if there is already a MANUAL transaction (bill) for this card
     const manualBillIndex = items.findIndex(item => item.cardId === card.id && item.transactionId); 
     
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
            kind: 'expense', 
            description: card.bank_name, 
            amount: finalSum,
            paid: false, 
            isRecurring: false, 
            day: card.due_day,
            cardId: card.id,
            cardColor: card.color,
            cardTransactions: finalSubTransactions
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
      
      const val = (item.installmentTotal && item.installmentTotal > 1)
        ? item.amount / item.installmentTotal
        : item.amount;
      
      expense += val;
    }
  });

  return { incoming, expense, total: incoming - expense };
}
