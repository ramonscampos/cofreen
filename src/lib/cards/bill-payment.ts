import { format, isValid, parse } from "date-fns";

export interface BillPaymentInput {
  cardId: string;
  monthRef: string;
  amount: number;
  paidOn: string; // yyyy-MM-dd
}

// Keeps digits only and adds the slashes as the user types: 14112026 -> 14/11/2026
export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// "14/11/2026" -> "2026-11-14"; null when it is not a real calendar date
export function parsePaidOn(text: string): string | null {
  const date = parse(text, "dd/MM/yyyy", new Date());
  if (!isValid(date) || format(date, "dd/MM/yyyy") !== text) return null;
  return format(date, "yyyy-MM-dd");
}

export function formatPaidOn(paidOn: string): string {
  return format(parse(paidOn, "yyyy-MM-dd", new Date()), "dd/MM/yyyy");
}

// Error message in Portuguese, or null when the payment is valid
export function validateBillPayment(input: BillPaymentInput): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.monthRef)) {
    return "Mês da fatura inválido";
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return "Informe um valor maior que zero";
  }
  const date = parse(input.paidOn, "yyyy-MM-dd", new Date());
  if (!isValid(date) || format(date, "yyyy-MM-dd") !== input.paidOn) {
    return "Data do pagamento inválida";
  }
  return null;
}
