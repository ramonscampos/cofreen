import {
  addMonths,
  format,
  getDaysInMonth,
  isBefore,
  parse,
  parseISO,
  startOfDay,
} from "date-fns";
import type { Card, CardBill, CardBillPayment, CardTransaction } from "@/types";
import { billMonthForDate } from "./bill-cycle";

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
  // Paid so far (Pluggy plus the manual payment); never reduces `amount`
  paidAmount: number;
  manualPayment: { amount: number; paidOn: string } | null;
  purchases: CardPurchaseView[];
  categories: { category: string; amount: number }[];
}

interface BuildCardBillViewInput {
  card: Card;
  bills: CardBill[];
  transactions: CardTransaction[];
  payments?: CardBillPayment[];
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

// Pluggy lists placeholder bills with a zero total; they say nothing about the month
const isRealBill = (bill: CardBill) =>
  Number(bill.totalAmount) !== 0 || bill.hasPaymentInfo;

function paymentStatus(total: number, paid: number): CardBillStatus | null {
  if (paid >= total - MONEY_TOLERANCE) return "paid";
  if (paid > 0) return "partial";
  return null;
}

function billStatus(
  bill: CardBill,
  today: Date,
  manualPaid: number,
): CardBillStatus {
  const total = Number(bill.totalAmount);
  if (bill.hasPaymentInfo || manualPaid > 0) {
    return (
      paymentStatus(total, Number(bill.paidAmount) + manualPaid) ?? "closed"
    );
  }
  const due = parse(bill.dueDate, "yyyy-MM-dd", new Date());
  return isBefore(due, startOfDay(today)) ? "paid_inferred" : "closed";
}

interface PendingInstallment {
  tx: CardTransaction;
  current: number;
  monthRef: string;
  // Expected posting date: the purchase day, one month per installment
  postsOn: string | null;
}

// Installments of each series after its most advanced synced row. Banks that
// list no future rows (Bradesco) only show each one when it posts.
function remainingInstallments(
  transactions: CardTransaction[],
): PendingInstallment[] {
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
    const latest = tx.installmentCurrent ?? 1;
    const total = tx.installmentTotal ?? 0;
    return Array.from({ length: Math.max(0, total - latest) }, (_, i) => {
      const current = latest + 1 + i;
      return {
        tx,
        current,
        monthRef: format(
          addMonths(parseMonth(tx.monthRef), current - latest),
          "yyyy-MM",
        ),
        postsOn: tx.purchaseDate
          ? format(
              addMonths(parseISO(tx.purchaseDate), current - 1),
              "yyyy-MM-dd",
            )
          : null,
      };
    });
  });
}

const toProjectedPurchase = (item: PendingInstallment): CardPurchaseView => ({
  ...toPurchase(item.tx, true),
  id: `${item.tx.id}-forecast-${item.monthRef}`,
  installmentCurrent: item.current,
});

// Each installment series is projected from its most advanced synced row, so
// a series not yet posted to the open bill still shows up in later months
function projectInstallments(
  transactions: CardTransaction[],
  monthRef: string,
): CardPurchaseView[] {
  return remainingInstallments(transactions)
    .filter((item) => item.monthRef === monthRef)
    .map(toProjectedPurchase);
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

const previousMonth = (monthRef: string) =>
  format(addMonths(parseMonth(monthRef), -1), "yyyy-MM");

const roundCents = (value: number) => Math.round(value * 100) / 100;

// Pluggy attaches a payment to the latest bill it knows, so a payment beyond
// that bill's total is the early payment of the bill after it. Totals carry
// rounding noise (-0.0046), which is no payment.
function advancePayment(bills: CardBill[], monthRef: string): number {
  const bill = bills.find((b) => b.monthRef === previousMonth(monthRef));
  if (!bill) return 0;
  const excess = Number(bill.paidAmount) - Number(bill.totalAmount);
  return excess > MONEY_TOLERANCE ? roundCents(excess) : 0;
}

interface OpenBillFromBalanceInput {
  card: Card;
  bills: CardBill[];
  transactions: CardTransaction[];
  installments: PendingInstallment[];
  openMonth: string;
  today: string;
}

// The card balance is all the credit in use: what is left of last month's
// bill, the open bill and installments still to post. Pluggy does not itemize
// every charge of the open bill (Nubank renegotiations, Bradesco installments
// and its latest purchases), so the balance gives the bill the bank shows.
// Only trusted once last month's bill is in, and when it adds up.
function openBillFromBalance({
  card,
  bills,
  transactions,
  installments,
  openMonth,
  today,
}: OpenBillFromBalanceInput): number | null {
  if (card.balance === null) return null;
  const lastBill = bills
    .filter((b) => b.monthRef === previousMonth(openMonth))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!lastBill) return null;

  const listedLater = transactions
    .filter((tx) => tx.monthRef > openMonth)
    .reduce((total, tx) => total + Number(tx.amount), 0);
  const toPost = installments
    .filter(
      (item) =>
        item.monthRef > openMonth ||
        (item.monthRef === openMonth && !!item.postsOn && item.postsOn > today),
    )
    .reduce((total, item) => total + Number(item.tx.amount), 0);
  // Negative when last month was overpaid: the excess went to this bill
  const lastBillLeft =
    Number(lastBill.totalAmount) - Number(lastBill.paidAmount);

  const amount = roundCents(
    Number(card.balance) - listedLater - toPost - lastBillLeft,
  );
  return amount >= 0 ? amount : null;
}

function unlistedCharges(
  card: Card,
  monthRef: string,
  amount: number,
): CardPurchaseView {
  return {
    id: `${card.id}-${monthRef}-unlisted`,
    description: "Lançamentos ainda sem detalhe no banco",
    date: null,
    amount,
    category: FALLBACK_CATEGORY,
    isForecast: false,
  };
}

export function buildCardBillView({
  card,
  bills,
  transactions,
  payments = [],
  monthRef,
  today,
}: BuildCardBillViewInput): CardBillView {
  const cardBills = bills.filter(
    (bill) => bill.cardId === card.id && isRealBill(bill),
  );
  const cardTransactions = transactions.filter((tx) => tx.cardId === card.id);
  const manual = payments.find(
    (p) => p.cardId === card.id && p.monthRef === monthRef,
  );
  const manualPayment = manual
    ? { amount: Number(manual.amount), paidOn: manual.paidOn }
    : null;
  const manualPaid = manualPayment?.amount ?? 0;
  const empty: CardBillView = {
    card,
    monthRef,
    status: "empty",
    amount: 0,
    dueDate: null,
    paidAmount: 0,
    manualPayment,
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
      status: billStatus(bill, today, manualPaid),
      amount: Number(bill.totalAmount),
      dueDate: bill.dueDate,
      paidAmount: Number(bill.paidAmount) + manualPaid,
      purchases: monthPurchases,
      categories: summarizeCategories(monthPurchases),
    };
  }

  // The open bill is the one that closes next, by the card's closing day.
  // Without it, it is the month after the latest bill. Later months are
  // forecasts, even when Pluggy already lists future installments there.
  const latestBillMonth = cardBills
    .map((b) => b.monthRef)
    .sort()
    .at(-1);
  const latestTransactionMonth = cardTransactions
    .map((tx) => tx.monthRef)
    .sort()
    .at(-1);
  const openMonth =
    card.closingDay !== null
      ? billMonthForDate(today, card.closingDay, card.dueDay)
      : latestBillMonth
        ? format(addMonths(parseMonth(latestBillMonth), 1), "yyyy-MM")
        : null;
  const isForecastMonth = openMonth
    ? monthRef > openMonth
    : !!latestTransactionMonth && monthRef > latestTransactionMonth;

  if (!isForecastMonth) {
    if (monthPurchases.length === 0 && monthRef !== openMonth) return empty;
    let purchases = monthPurchases;
    let amount = sum(monthPurchases);

    if (monthRef === openMonth) {
      const todayDate = format(today, "yyyy-MM-dd");
      const installments = remainingInstallments(cardTransactions);
      // Installments that should have posted by now but Pluggy did not list
      const posted = installments
        .filter(
          (item) =>
            item.monthRef === monthRef &&
            (!item.postsOn || item.postsOn <= todayDate),
        )
        .map(toProjectedPurchase);
      purchases = [...monthPurchases, ...posted];
      amount = sum(purchases);

      const fromBalance = openBillFromBalance({
        card,
        bills: cardBills,
        transactions: cardTransactions,
        installments,
        openMonth,
        today: todayDate,
      });
      // A balance below the listed purchases is stale: keep the purchases
      if (fromBalance !== null && fromBalance >= amount - MONEY_TOLERANCE) {
        const rest = roundCents(fromBalance - amount);
        if (rest > MONEY_TOLERANCE) {
          purchases = [...purchases, unlistedCharges(card, monthRef, rest)];
        }
        amount = fromBalance;
      }
    }

    const dueDate = dueDateFor(monthRef, card.dueDay);
    const paidAmount = manualPaid + advancePayment(cardBills, monthRef);

    // Closed by the calendar, but Pluggy has not delivered its bill yet
    const isClosed = !!openMonth && monthRef < openMonth;
    const pastDue = isBefore(
      parse(dueDate, "yyyy-MM-dd", new Date()),
      startOfDay(today),
    );
    const baseStatus: CardBillStatus = !isClosed
      ? "open"
      : pastDue
        ? "paid_inferred"
        : "closed";
    const status =
      amount > MONEY_TOLERANCE && paidAmount > MONEY_TOLERANCE
        ? (paymentStatus(amount, paidAmount) ?? baseStatus)
        : baseStatus;

    return {
      ...empty,
      status,
      amount,
      dueDate,
      paidAmount,
      purchases,
      categories: summarizeCategories(purchases),
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
