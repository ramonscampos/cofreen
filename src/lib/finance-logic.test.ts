import { describe, expect, it } from "vitest";
import type { RecurringTemplate, Transaction } from "@/types";
import {
  buildPaidTemplateTransaction,
  calculateTotals,
  mergeTransactionsAndTemplates,
  normalizeMonthRef,
} from "./finance-logic";

const fastback: RecurringTemplate = {
  id: "tpl-fastback",
  userId: "u",
  kind: "expense",
  description: "Fastback",
  defaultAmount: "50400",
  dayOfMonth: 1,
  monthRef: "2026-02",
  isActive: true,
  installmentCurrent: 1,
  installmentTotal: 18,
  createdAt: "2026-02-01T00:00:00Z",
};

describe("installment templates", () => {
  it("projects installment 10/18 at 2800 in 2026-11", () => {
    const items = mergeTransactionsAndTemplates([], [fastback], "2026-11");
    expect(calculateTotals(items).expense).toBe(2800);
    expect(items[0].installmentCurrent).toBe(10);
  });

  it("stops after last installment", () => {
    expect(mergeTransactionsAndTemplates([], [fastback], "2027-08")).toEqual(
      [],
    );
  });

  it("paid installment transaction counts the installment, not the contract", () => {
    const [projected] = mergeTransactionsAndTemplates(
      [],
      [fastback],
      "2026-11",
    );
    const payload = buildPaidTemplateTransaction(projected, "2026-11");
    const paid: Transaction = {
      id: "tx-1",
      userId: "u",
      kind: payload.kind,
      monthRef: payload.monthRef,
      description: payload.description,
      amount: String(payload.amount),
      paid: true,
      isRecurring: payload.isRecurring ?? false,
      templateId: payload.templateId,
      installmentCurrent: payload.installmentCurrent,
      installmentTotal: payload.installmentTotal,
      createdAt: "2026-11-01T00:00:00Z",
    };

    const items = mergeTransactionsAndTemplates([paid], [fastback], "2026-11");
    expect(items).toHaveLength(1);
    expect(calculateTotals(items).expense).toBe(2800);
  });
});

describe("normalizeMonthRef", () => {
  it("keeps a valid month", () => {
    expect(normalizeMonthRef("2026-12", "2026-10")).toBe("2026-12");
  });

  it("falls back for malformed months", () => {
    for (const value of ["foo", "2026-13", "2026-1", "", undefined]) {
      expect(normalizeMonthRef(value, "2026-10")).toBe("2026-10");
    }
  });
});

describe("transaction day", () => {
  it("reads the day from a database timestamp", () => {
    const income: Transaction = {
      id: "trs",
      userId: "u",
      kind: "incoming",
      monthRef: "2026-11",
      description: "TRS",
      amount: "12000",
      paid: true,
      isRecurring: false,
      templateId: null,
      installmentCurrent: null,
      installmentTotal: null,
      transactionDate: "2026-10-25 00:00:00+00",
      createdAt: "2026-10-25 22:59:13.958+00",
    };
    const [item] = mergeTransactionsAndTemplates([income], [], "2026-11");
    expect(item.day).toBe(25);
  });
});
