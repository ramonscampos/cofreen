import { buildCardBillView, type CardBillView } from "@/lib/cards/bill-view";
import {
  calculateTotals,
  type MonthTotals,
  mergeTransactionsAndTemplates,
} from "@/lib/finance-logic";
import type { MonthData } from "@/lib/month-data";
import type { DashboardItem } from "@/types";

export interface MonthView {
  items: DashboardItem[];
  cardBills: CardBillView[];
  totals: MonthTotals;
}

export function buildMonthView(
  data: MonthData,
  monthRef: string,
  today: Date,
): MonthView {
  const items = mergeTransactionsAndTemplates(
    data.transactions,
    data.templates,
    monthRef,
  );
  const cardBills = data.cards
    .map((card) =>
      buildCardBillView({
        card,
        bills: data.cardBills,
        transactions: data.cardTransactions,
        monthRef,
        today,
      }),
    )
    .sort((a, b) => a.card.dueDay - b.card.dueDay);

  const base = calculateTotals(items);
  const cardsTotal = cardBills.reduce((sum, bill) => sum + bill.amount, 0);
  const expense = base.expense + cardsTotal;

  return {
    items,
    cardBills,
    totals: {
      incoming: base.incoming,
      expense,
      total: base.incoming - expense,
    },
  };
}
