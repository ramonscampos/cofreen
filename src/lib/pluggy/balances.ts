import type { PluggyAccount, PluggyInvestment } from "./types";

export type BalanceKind = "account" | "investment";

export interface MappedBalance {
  externalId: string;
  kind: BalanceKind;
  institution: string;
  name: string;
  amount: string;
}

const ACCOUNT_SUBTYPE_NAME: Record<string, string> = {
  CHECKING_ACCOUNT: "Conta corrente",
  SAVINGS_ACCOUNT: "Poupança",
};

// Meu Pluggy items don't name the bank, so read it off the bank account name
export function detectBank(bankAccountNames: string[]): string {
  const names = bankAccountNames.join(" ");
  if (/nu pagamentos|nubank/i.test(names)) return "Nubank";
  if (/bradesco/i.test(names)) return "Bradesco";
  return bankAccountNames[0] ?? "Banco";
}

export function institutionLabel(
  bankAccountNames: string[],
  taxNumber: string | null | undefined,
): string {
  const digits = (taxNumber ?? "").replace(/\D/g, "");
  const holder =
    digits.length === 14 ? " PJ" : digits.length === 11 ? " PF" : "";
  return `${detectBank(bankAccountNames)}${holder}`;
}

export function mapBankAccounts(
  accounts: PluggyAccount[],
  institution: string,
): MappedBalance[] {
  return accounts
    .filter((account) => account.type === "BANK")
    .map((account) => ({
      externalId: account.id,
      kind: "account",
      institution,
      name: ACCOUNT_SUBTYPE_NAME[account.subtype ?? ""] ?? account.name,
      amount: String(account.balance),
    }));
}

export function mapInvestments(
  investments: PluggyInvestment[],
  institution: string,
): MappedBalance[] {
  return investments
    .filter(
      (investment) =>
        investment.status !== "TOTAL_WITHDRAWAL" && investment.balance > 0,
    )
    .map((investment) => ({
      externalId: investment.id,
      kind: "investment",
      institution,
      name: investment.name,
      amount: String(investment.balance),
    }));
}

interface BalanceGroup {
  total: number;
  byInstitution: { institution: string; amount: number }[];
}

function group(rows: { institution: string; amount: string }[]): BalanceGroup {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(
      row.institution,
      (totals.get(row.institution) ?? 0) + Number(row.amount),
    );
  }
  const byInstitution = [...totals.entries()]
    .map(([institution, amount]) => ({ institution, amount }))
    .sort((a, b) => b.amount - a.amount);
  return {
    total: byInstitution.reduce((sum, row) => sum + row.amount, 0),
    byInstitution,
  };
}

export function summarizeBalances(
  rows: { kind: string; institution: string; amount: string }[],
): { accounts: BalanceGroup; investments: BalanceGroup } {
  return {
    accounts: group(rows.filter((row) => row.kind === "account")),
    investments: group(rows.filter((row) => row.kind === "investment")),
  };
}
