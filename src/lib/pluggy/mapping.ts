import { addMonths, format, parse } from "date-fns";
import type { PluggyBill, PluggyTransaction } from "./types";

const toDate = (value: string) => value.slice(0, 10);
const toMonth = (value: string) => value.slice(0, 7);

interface BillMonthInput {
  billDueDate?: string | null;
  billForecastDate?: string | null;
  purchaseDate: string;
  closingDay: number | null;
  dueDay: number;
}

// Month (yyyy-MM) of the due date of the bill a purchase belongs to
export function resolveBillMonth(input: BillMonthInput): string {
  if (input.billDueDate) return toMonth(input.billDueDate);
  if (input.billForecastDate) return toMonth(input.billForecastDate);

  const purchase = parse(toDate(input.purchaseDate), "yyyy-MM-dd", new Date());
  if (input.closingDay === null) return format(purchase, "yyyy-MM");

  const closesThisMonth = purchase.getDate() < input.closingDay;
  const closingMonth = addMonths(purchase, closesThisMonth ? 0 : 1);
  const dueMonth = addMonths(
    closingMonth,
    input.dueDay <= input.closingDay ? 1 : 0,
  );
  return format(dueMonth, "yyyy-MM");
}

const BILL_PAYMENT_DESCRIPTION = /pagamento (de fatura|recebido)|pgto fatura/i;
const BILL_PAYMENT_CATEGORY = /credit card payment/i;

export function isBillPayment(tx: PluggyTransaction): boolean {
  if (tx.type !== "CREDIT") return false;
  return (
    BILL_PAYMENT_CATEGORY.test(tx.category ?? "") ||
    BILL_PAYMENT_DESCRIPTION.test(tx.description)
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
  closingDay: number | null;
  dueDay: number;
}

export function mapTransaction(
  tx: PluggyTransaction,
  ctx: MapTransactionContext,
): MappedTransaction | null {
  if (isBillPayment(tx)) return null;

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
    category: tx.category ?? null,
  };
}

export function deriveCardDays(
  bills: PluggyBill[],
): { dueDay: number; closingDay: number | null } | null {
  if (bills.length === 0) return null;
  const latest = [...bills].sort((a, b) =>
    b.dueDate.localeCompare(a.dueDate),
  )[0];
  return {
    dueDay: Number(toDate(latest.dueDate).slice(8, 10)),
    closingDay: latest.billClosingDate
      ? Number(toDate(latest.billClosingDate).slice(8, 10))
      : null,
  };
}

export interface ItemSyncResult {
  itemId: string;
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
        ? failures.map((f) => `${f.itemId}: ${f.error ?? "erro"}`).join("; ")
        : null,
    consentExpiresAt: expirations[0] ?? null,
  };
}
