import {
  differenceInCalendarMonths,
  format,
  getDaysInMonth,
  isBefore,
  parse,
  startOfDay,
} from "date-fns";
import type { Card, CardBill, CardTransaction } from "@/types";

export type CardBillStatus =
  | "paid"
  | "paid_inferred"
  | "partial"
  | "closed"
  | "open"
  | "forecast"
  | "empty";

export const CARD_BILL_STATUS_LABEL: Record<
  Exclude<CardBillStatus, "empty">,
  string
> = {
  paid: "Paga",
  paid_inferred: "Paga (inferido)",
  partial: "Parcialmente paga",
  closed: "Fechada",
  open: "Aberta",
  forecast: "Prevista",
};

export interface CardPurchaseView {
  id: string;
  description: string;
  date: string | null;
  amount: number;
  category: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  isForecast: boolean;
}

export interface CardBillView {
  card: Card;
  monthRef: string;
  status: CardBillStatus;
  amount: number;
  dueDate: string | null;
  purchases: CardPurchaseView[];
  categories: { category: string; amount: number }[];
}

interface BuildCardBillViewInput {
  card: Card;
  bills: CardBill[];
  transactions: CardTransaction[];
  monthRef: string;
  today: Date;
}

const MONEY_TOLERANCE = 0.01;
const RECURRING_TOLERANCE = 0.1;
const FALLBACK_CATEGORY = "Outros";

const parseMonth = (monthRef: string) => parse(monthRef, "yyyy-MM", new Date());

const isInstallment = (tx: CardTransaction) => (tx.installmentTotal ?? 0) > 1;

function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[\d\p{P}\p{S}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dueDateFor(monthRef: string, dueDay: number): string {
  const day = Math.min(dueDay, getDaysInMonth(parseMonth(monthRef)));
  return `${monthRef}-${String(day).padStart(2, "0")}`;
}

function toPurchase(
  tx: CardTransaction,
  isForecast: boolean,
): CardPurchaseView {
  return {
    id: tx.id,
    description: tx.description,
    date: tx.purchaseDate,
    amount: Number(tx.amount),
    category: tx.category ?? FALLBACK_CATEGORY,
    installmentCurrent: tx.installmentCurrent ?? undefined,
    installmentTotal: tx.installmentTotal ?? undefined,
    isForecast,
  };
}

function summarizeCategories(purchases: CardPurchaseView[]) {
  const totals = new Map<string, number>();
  for (const purchase of purchases) {
    totals.set(
      purchase.category,
      (totals.get(purchase.category) ?? 0) + purchase.amount,
    );
  }
  return [...totals.entries()]
    .filter(([, amount]) => amount > MONEY_TOLERANCE)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function billStatus(bill: CardBill, today: Date): CardBillStatus {
  const total = Number(bill.totalAmount);
  const paid = Number(bill.paidAmount);
  if (bill.hasPaymentInfo) {
    if (paid >= total - MONEY_TOLERANCE) return "paid";
    if (paid > 0) return "partial";
    return "closed";
  }
  const due = parse(bill.dueDate, "yyyy-MM-dd", new Date());
  return isBefore(due, startOfDay(today)) ? "paid_inferred" : "closed";
}

function projectInstallments(
  transactions: CardTransaction[],
  latestMonth: string,
  monthRef: string,
): CardPurchaseView[] {
  const offset = differenceInCalendarMonths(
    parseMonth(monthRef),
    parseMonth(latestMonth),
  );
  return transactions
    .filter((tx) => tx.monthRef === latestMonth && isInstallment(tx))
    .flatMap((tx) => {
      const current = (tx.installmentCurrent ?? 1) + offset;
      if (current > (tx.installmentTotal ?? 0)) return [];
      return [
        {
          ...toPurchase(tx, true),
          id: `${tx.id}-forecast-${monthRef}`,
          installmentCurrent: current,
        },
      ];
    });
}

// Non-installment charges present in both of the last two closed bills
function projectRecurring(
  bills: CardBill[],
  transactions: CardTransaction[],
  monthRef: string,
): CardPurchaseView[] {
  const [latest, previous] = bills
    .filter((bill) => bill.monthRef < monthRef)
    .sort((a, b) => b.monthRef.localeCompare(a.monthRef));
  if (!latest || !previous) return [];

  const charges = (month: string) =>
    transactions.filter(
      (tx) =>
        tx.monthRef === month && !isInstallment(tx) && Number(tx.amount) > 0,
    );
  const previousCharges = charges(previous.monthRef);
  const seen = new Set<string>();

  return charges(latest.monthRef).flatMap((tx) => {
    const key = normalizeDescription(tx.description);
    const amount = Number(tx.amount);
    const match = previousCharges.some(
      (prev) =>
        normalizeDescription(prev.description) === key &&
        Math.abs(Number(prev.amount) - amount) <= amount * RECURRING_TOLERANCE,
    );
    if (!match || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        ...toPurchase(tx, true),
        id: `${tx.id}-forecast-${monthRef}`,
        date: null,
      },
    ];
  });
}

export function buildCardBillView({
  card,
  bills,
  transactions,
  monthRef,
  today,
}: BuildCardBillViewInput): CardBillView {
  const cardBills = bills.filter((bill) => bill.cardId === card.id);
  const cardTransactions = transactions.filter((tx) => tx.cardId === card.id);
  const empty: CardBillView = {
    card,
    monthRef,
    status: "empty",
    amount: 0,
    dueDate: null,
    purchases: [],
    categories: [],
  };

  const bill = cardBills.find((b) => b.monthRef === monthRef);
  const monthTransactions = cardTransactions.filter(
    (tx) => tx.monthRef === monthRef,
  );

  if (bill || monthTransactions.length > 0) {
    const purchases = monthTransactions
      .map((tx) => toPurchase(tx, false))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return {
      ...empty,
      status: bill ? billStatus(bill, today) : "open",
      amount: bill
        ? Number(bill.totalAmount)
        : purchases.reduce((sum, p) => sum + p.amount, 0),
      dueDate: bill ? bill.dueDate : dueDateFor(monthRef, card.dueDay),
      purchases,
      categories: summarizeCategories(purchases),
    };
  }

  const latestMonth = [
    ...cardBills.map((b) => b.monthRef),
    ...cardTransactions.map((tx) => tx.monthRef),
  ].sort()[cardBills.length + cardTransactions.length - 1];

  if (!latestMonth || monthRef <= latestMonth) return empty;

  const purchases = [
    ...projectInstallments(cardTransactions, latestMonth, monthRef),
    ...projectRecurring(cardBills, cardTransactions, monthRef),
  ];
  return {
    ...empty,
    status: "forecast",
    amount: purchases.reduce((sum, p) => sum + p.amount, 0),
    dueDate: dueDateFor(monthRef, card.dueDay),
    purchases,
    categories: summarizeCategories(purchases),
  };
}
