import {
  addMonths,
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
const RECURRING_DAY_TOLERANCE = 4;
const RECURRING_BILLS = 3;
const NAMED_SUBSCRIPTION_MONTHS = 2;
const SUBSCRIPTION_NAME =
  /\b(sub|subs|subscr|subscription|assinatura|mensalidade)\b/i;
const FALLBACK_CATEGORY = "Outros";
// "Loja 3/12" or "Loja - Parcela 3/12", as banks name installment charges
const INSTALLMENT_SUFFIX = /\s*(-\s*)?(parcela\s*)?\d{1,2}\/\d{1,2}\s*$/i;
const ADJUSTMENT_DESCRIPTION = "Saldo anterior e ajustes";
const ADJUSTMENT_CATEGORY = "Ajustes";

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
    description: isInstallment(tx)
      ? tx.description.replace(INSTALLMENT_SUFFIX, "")
      : tx.description,
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

// Each installment series is projected from its most advanced synced row, so
// a series not yet posted to the open bill still shows up in later months
function projectInstallments(
  transactions: CardTransaction[],
  monthRef: string,
): CardPurchaseView[] {
  const latestBySeries = new Map<string, CardTransaction>();
  for (const tx of transactions.filter(isInstallment)) {
    const key = [
      normalizeDescription(tx.description),
      tx.installmentTotal,
      tx.purchaseDate,
      tx.amount,
    ].join("|");
    const current = latestBySeries.get(key);
    if (!current || tx.monthRef > current.monthRef) {
      latestBySeries.set(key, tx);
    }
  }

  return [...latestBySeries.values()].flatMap((tx) => {
    const offset = differenceInCalendarMonths(
      parseMonth(monthRef),
      parseMonth(tx.monthRef),
    );
    const current = (tx.installmentCurrent ?? 1) + offset;
    if (offset <= 0 || current > (tx.installmentTotal ?? 0)) return [];
    return [
      {
        ...toPurchase(tx, true),
        id: `${tx.id}-forecast-${monthRef}`,
        installmentCurrent: current,
      },
    ];
  });
}

const dayOfMonth = (tx: CardTransaction) =>
  tx.purchaseDate ? Number(tx.purchaseDate.slice(8, 10)) : null;

function isSameCharge(a: CardTransaction, b: CardTransaction): boolean {
  const dayA = dayOfMonth(a);
  const dayB = dayOfMonth(b);
  if (dayA === null || dayB === null) return false;
  const dayGap = Math.abs(dayA - dayB);
  const amountA = Number(a.amount);
  return (
    normalizeDescription(a.description) ===
      normalizeDescription(b.description) &&
    Math.abs(Number(b.amount) - amountA) <= amountA * RECURRING_TOLERANCE &&
    Math.min(dayGap, 31 - dayGap) <= RECURRING_DAY_TOLERANCE
  );
}

// A subscription charges the same amount around the same day in each of the
// last closed bills; frequent purchases at one store vary in day and value
function projectRecurring(
  bills: CardBill[],
  transactions: CardTransaction[],
  monthRef: string,
): CardPurchaseView[] {
  const recentBills = bills
    .filter((bill) => bill.monthRef < monthRef)
    .sort((a, b) => b.monthRef.localeCompare(a.monthRef))
    .slice(0, RECURRING_BILLS);
  if (recentBills.length < RECURRING_BILLS) return [];

  const charges = (month: string) =>
    transactions.filter(
      (tx) =>
        tx.monthRef === month && !isInstallment(tx) && Number(tx.amount) > 0,
    );
  const [latest, ...previous] = recentBills.map((bill) =>
    charges(bill.monthRef),
  );
  const used = new Set<string>();

  return latest.flatMap((tx) => {
    const matches = previous.map((bill) =>
      bill.find((prev) => !used.has(prev.id) && isSameCharge(tx, prev)),
    );
    if (matches.some((match) => !match)) return [];
    for (const match of matches) used.add((match as CardTransaction).id);
    return [
      {
        ...toPurchase(tx, true),
        id: `${tx.id}-forecast-${monthRef}`,
        date: null,
      },
    ];
  });
}

// Charges whose name says subscription are projected from the first bill they
// show up in, before the three-bill pattern can be seen
function projectNamedSubscriptions(
  transactions: CardTransaction[],
  monthRef: string,
  alreadyProjected: CardPurchaseView[],
): CardPurchaseView[] {
  const recentMonths = [
    ...new Set(
      transactions
        .filter((tx) => tx.monthRef < monthRef)
        .map((tx) => tx.monthRef),
    ),
  ]
    .sort()
    .slice(-NAMED_SUBSCRIPTION_MONTHS);
  const seen = new Set(
    alreadyProjected.map((p) => normalizeDescription(p.description)),
  );

  return transactions
    .filter(
      (tx) =>
        recentMonths.includes(tx.monthRef) &&
        !isInstallment(tx) &&
        Number(tx.amount) > 0 &&
        SUBSCRIPTION_NAME.test(tx.description),
    )
    .sort((a, b) => b.monthRef.localeCompare(a.monthRef))
    .flatMap((tx) => {
      const key = normalizeDescription(tx.description);
      if (seen.has(key)) return [];
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

  const bill = cardBills
    .filter((b) => b.monthRef === monthRef)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const monthPurchases = cardTransactions
    .filter((tx) => tx.monthRef === monthRef)
    .map((tx) => toPurchase(tx, false))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const sum = (purchases: CardPurchaseView[]) =>
    purchases.reduce((total, p) => total + p.amount, 0);

  if (bill) {
    return {
      ...empty,
      status: billStatus(bill, today),
      amount: Number(bill.totalAmount),
      dueDate: bill.dueDate,
      purchases: monthPurchases,
      categories: summarizeCategories(monthPurchases),
    };
  }

  // The open bill is the one right after the latest closed bill. Later months
  // are forecasts, even when Pluggy already lists future installments there.
  const latestBillMonth = cardBills
    .map((b) => b.monthRef)
    .sort()
    .at(-1);
  const latestTransactionMonth = cardTransactions
    .map((tx) => tx.monthRef)
    .sort()
    .at(-1);
  const openMonth = latestBillMonth
    ? format(addMonths(parseMonth(latestBillMonth), 1), "yyyy-MM")
    : null;
  const isForecastMonth = openMonth
    ? monthRef > openMonth
    : !!latestTransactionMonth && monthRef > latestTransactionMonth;

  if (!isForecastMonth) {
    if (monthPurchases.length === 0 && monthRef !== openMonth) return empty;
    const purchasesTotal = sum(monthPurchases);
    const useBalance =
      monthRef === openMonth &&
      card.openBillSource === "balance" &&
      card.balance !== null;
    const amount = useBalance
      ? Number(card.balance) -
        cardTransactions
          .filter((tx) => tx.monthRef > monthRef)
          .reduce((total, tx) => total + Number(tx.amount), 0)
      : purchasesTotal;
    const adjustment = amount - purchasesTotal;
    const purchases =
      Math.abs(adjustment) > MONEY_TOLERANCE
        ? [
            ...monthPurchases,
            {
              id: `${card.id}-adjustment-${monthRef}`,
              description: ADJUSTMENT_DESCRIPTION,
              date: null,
              amount: adjustment,
              category: ADJUSTMENT_CATEGORY,
              isForecast: false,
            },
          ]
        : monthPurchases;
    return {
      ...empty,
      status: "open",
      amount,
      dueDate: dueDateFor(monthRef, card.dueDay),
      purchases,
      categories: summarizeCategories(monthPurchases),
    };
  }

  const recurring = projectRecurring(cardBills, cardTransactions, monthRef);
  const purchases = [
    ...monthPurchases,
    ...projectInstallments(cardTransactions, monthRef),
    ...recurring,
    ...projectNamedSubscriptions(cardTransactions, monthRef, recurring),
  ];
  return {
    ...empty,
    status: "forecast",
    amount: sum(purchases),
    dueDate: dueDateFor(monthRef, card.dueDay),
    purchases,
    categories: summarizeCategories(purchases),
  };
}
