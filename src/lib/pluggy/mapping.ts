import { addMonths, format, parse } from "date-fns";
import { billMonthForDate } from "@/lib/cards/bill-cycle";
import { detectBank } from "./balances";
import type { PluggyBill, PluggyItem, PluggyTransaction } from "./types";

const toDate = (value: string) => value.slice(0, 10);
const toMonth = (value: string) => value.slice(0, 7);

interface BillMonthInput {
  billDueDate?: string | null;
  billForecastDate?: string | null;
  purchaseDate: string;
  closingDay: number | null;
  dueDay: number;
}

// Month (yyyy-MM) of the due date of the bill a purchase belongs to. Pluggy's
// bill is trusted unless it already closed before the purchase, which the
// known closing day proves wrong.
export function resolveBillMonth(input: BillMonthInput): string {
  const pluggyMonth = input.billDueDate
    ? toMonth(input.billDueDate)
    : input.billForecastDate
      ? toMonth(input.billForecastDate)
      : null;

  const purchase = parse(toDate(input.purchaseDate), "yyyy-MM-dd", new Date());
  if (input.closingDay === null) {
    return pluggyMonth ?? format(purchase, "yyyy-MM");
  }

  const computed = billMonthForDate(purchase, input.closingDay, input.dueDay);
  return pluggyMonth && pluggyMonth >= computed ? pluggyMonth : computed;
}

const BILL_PAYMENT_DESCRIPTION =
  /pagamento (de fatura|recebido|efetuado)|pgto|pagto|obrigad[oa]/i;
const BILL_PAYMENT_CATEGORY = /credit card payment/i;
const MONEY_TOLERANCE = 0.01;

// The card account lists last bill's payment as a credit; it is not a refund
export function isBillPayment(
  tx: PluggyTransaction,
  billTotals: number[] = [],
): boolean {
  if (tx.type !== "CREDIT") return false;
  return (
    BILL_PAYMENT_CATEGORY.test(tx.category ?? "") ||
    BILL_PAYMENT_DESCRIPTION.test(tx.description) ||
    billTotals.some(
      (total) => Math.abs(Math.abs(tx.amount) - total) <= MONEY_TOLERANCE,
    )
  );
}

export interface MappedBill {
  externalId: string;
  monthRef: string;
  dueDate: string;
  closingDate: string | null;
  totalAmount: string;
  paidAmount: string;
  hasPaymentInfo: boolean;
}

export function mapBill(bill: PluggyBill): MappedBill {
  const payments = bill.payments ?? [];
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return {
    externalId: bill.id,
    monthRef: toMonth(bill.dueDate),
    dueDate: toDate(bill.dueDate),
    closingDate: bill.billClosingDate ? toDate(bill.billClosingDate) : null,
    totalAmount: String(bill.totalAmount),
    paidAmount: String(paid),
    hasPaymentInfo: payments.length > 0,
  };
}

export interface MappedTransaction {
  externalId: string;
  description: string;
  amount: string;
  monthRef: string;
  installmentCurrent: number | null;
  installmentTotal: number | null;
  billExternalId: string | null;
  purchaseDate: string;
  category: string | null;
}

interface MapTransactionContext {
  billsById: Map<string, PluggyBill>;
  // Pluggy category id -> Portuguese name
  categoryNames?: Map<string, string>;
  closingDay: number | null;
  dueDay: number;
}

export function mapTransaction(
  tx: PluggyTransaction,
  ctx: MapTransactionContext,
): MappedTransaction | null {
  const billTotals = [...ctx.billsById.values()].map((b) => b.totalAmount);
  if (isBillPayment(tx, billTotals)) return null;

  const meta = tx.creditCardMetadata ?? {};
  const billId = meta.billId ?? null;
  const bill = billId ? ctx.billsById.get(billId) : undefined;
  const signed =
    tx.type === "CREDIT" ? -Math.abs(tx.amount) : Math.abs(tx.amount);

  return {
    externalId: tx.id,
    description: tx.description,
    amount: String(signed),
    monthRef: resolveBillMonth({
      billDueDate: bill?.dueDate,
      billForecastDate: meta.billForecastDate,
      purchaseDate: tx.date,
      closingDay: ctx.closingDay,
      dueDay: ctx.dueDay,
    }),
    installmentCurrent: meta.installmentNumber ?? null,
    installmentTotal: meta.totalInstallments ?? null,
    billExternalId: billId,
    purchaseDate: toDate(meta.purchaseDate ?? tx.date),
    category:
      (tx.categoryId && ctx.categoryNames?.get(tx.categoryId)) ??
      tx.category ??
      null,
  };
}

// Pluggy lists placeholder bills with a zero total, many of them in the future
const isRealBill = (bill: PluggyBill) =>
  bill.totalAmount !== 0 || (bill.payments ?? []).length > 0;

const CLOSING_HISTORY_BILLS = 6;

// The due day comes from the latest real bill due within a month; later ones
// are placeholders that carry made-up dates. Closing days drift between bills,
// so the latest one seen among recent bills is used: Pluggy's own bill is then
// only overridden for purchases made on or after the latest closing.
export function deriveCardDays(
  bills: PluggyBill[],
  fallbackDueDate?: string | null,
  now: Date = new Date(),
): { dueDay: number; closingDay: number | null } | null {
  const horizon = format(addMonths(now, 1), "yyyy-MM-dd");
  const recent = bills
    .filter((bill) => isRealBill(bill) && toDate(bill.dueDate) <= horizon)
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, CLOSING_HISTORY_BILLS);
  const latest = recent[0];
  if (!latest) {
    return fallbackDueDate
      ? {
          dueDay: Number(toDate(fallbackDueDate).slice(8, 10)),
          closingDay: null,
        }
      : null;
  }
  const closingDays = recent
    .filter((bill) => bill.billClosingDate)
    .map((bill) => Number(toDate(bill.billClosingDate ?? "").slice(8, 10)));
  return {
    dueDay: Number(toDate(latest.dueDate).slice(8, 10)),
    closingDay: closingDays.length > 0 ? Math.max(...closingDays) : null,
  };
}

export function evaluateItem(
  item: PluggyItem,
  now: Date,
): { ok: true } | { ok: false; error: string } {
  if (item.error || item.status === "LOGIN_ERROR") {
    return { ok: false, error: item.error?.code ?? item.status };
  }
  // Reads come back empty after consent expires, which would look like success
  if (item.consentExpiresAt && new Date(item.consentExpiresAt) <= now) {
    return { ok: false, error: "USER_AUTHORIZATION_EXPIRED" };
  }
  return { ok: true };
}

// External ids to keep when pruning vanished purchases; null means skip the
// prune, since an empty fetch is far likelier a failed read than no purchases
export function planStalePrune(fetchedIds: string[]): string[] | null {
  return fetchedIds.length > 0 ? fetchedIds : null;
}

export type OpenBillSource = "balance" | "transactions";

// Nubank reports the open bill (including carried balance and renegotiations)
// inside the card balance; Bradesco's balance also holds unlisted installments
export function detectOpenBillSource(
  bankAccountNames: string[],
): OpenBillSource {
  return detectBank(bankAccountNames) === "Nubank" ? "balance" : "transactions";
}

export interface ItemSyncResult {
  itemId: string;
  // Shown to the user instead of the item id
  label: string;
  ok: boolean;
  error?: string;
  consentExpiresAt?: string | null;
}

export function summarizeSync(results: ItemSyncResult[]): {
  ok: boolean;
  error: string | null;
  consentExpiresAt: string | null;
} {
  const failures = results.filter((result) => !result.ok);
  const expirations = results
    .map((result) => result.consentExpiresAt)
    .filter((value): value is string => !!value)
    .sort();
  return {
    ok: failures.length === 0,
    error:
      failures.length > 0
        ? failures.map((f) => `${f.label}: ${f.error ?? "erro"}`).join("; ")
        : null,
    consentExpiresAt: expirations[0] ?? null,
  };
}
