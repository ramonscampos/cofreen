import { describe, expect, it } from "vitest";
import type { RecurringTemplate, Transaction } from "@/types";
import { buildPaidTemplateTransaction, calculateTotals } from "./finance-logic";
import { buildOverdueItems } from "./overdue";

const template = (
  overrides: Partial<RecurringTemplate>,
): RecurringTemplate => ({
  id: "tpl-internet",
  userId: "u",
  kind: "expense",
  description: "Internet",
  defaultAmount: "210",
  dayOfMonth: 15,
  monthRef: "2026-02",
  isActive: true,
  installmentCurrent: null,
  installmentTotal: null,
  planId: null,
  cardId: null,
  createdAt: "2026-02-01T00:00:00Z",
  ...overrides,
});

const paidTx = (templateId: string, monthRef: string): Transaction => ({
  id: `tx-${templateId}`,
  userId: "u",
  kind: "expense",
  monthRef,
  description: "pago",
  amount: "210",
  paid: true,
  isRecurring: true,
  templateId,
  cardId: null,
  installmentCurrent: null,
  installmentTotal: null,
  transactionDate: null,
  createdAt: "2026-11-15T00:00:00Z",
});

const today = new Date(2026, 11, 10); // 2026-12-10

describe("buildOverdueItems", () => {
  it("repeats an unpaid bill from last month as overdue", () => {
    const [item] = buildOverdueItems([], [template({})], "2026-12", today);
    expect(item).toMatchObject({
      id: "overdue-2026-11-tpl-internet",
      description: "Internet",
      amount: 210,
      paid: false,
      overdueFromMonthRef: "2026-11",
      overdueLabel: "Atrasada · nov",
      originalTemplateId: "tpl-internet",
    });
  });

  it("skips bills paid last month and incomes", () => {
    expect(
      buildOverdueItems(
        [paidTx("tpl-internet", "2026-11")],
        [template({}), template({ id: "salary", kind: "incoming" })],
        "2026-12",
        today,
      ),
    ).toEqual([]);
  });

  it("repeats an unpaid one-off expense from last month", () => {
    const tx: Transaction = {
      ...paidTx("x", "2026-11"),
      id: "tx-dentista",
      description: "Dentista",
      templateId: null,
      isRecurring: false,
      paid: false,
      amount: "300",
    };
    const [item] = buildOverdueItems([tx], [], "2026-12", today);
    expect(item).toMatchObject({
      description: "Dentista",
      transactionId: "tx-dentista",
      overdueFromMonthRef: "2026-11",
    });
  });

  it("counts the installment, not the contract, for overdue installments", () => {
    const items = buildOverdueItems(
      [],
      [
        template({
          id: "fastback",
          defaultAmount: "50400",
          installmentCurrent: 1,
          installmentTotal: 18,
        }),
      ],
      "2026-12",
      today,
    );
    expect(items[0].installmentCurrent).toBe(10);
    expect(calculateTotals(items).expense).toBe(2800);
  });

  it("starts with November, after the data cleanup", () => {
    expect(
      buildOverdueItems([], [template({})], "2026-11", new Date(2026, 10, 5)),
    ).toEqual([]);
  });

  it("never shows in future months", () => {
    expect(buildOverdueItems([], [template({})], "2027-01", today)).toEqual([]);
  });

  it("marks the bill paid in the month it belongs to", () => {
    const [item] = buildOverdueItems([], [template({})], "2026-12", today);
    expect(buildPaidTemplateTransaction(item, "2026-12")).toMatchObject({
      monthRef: "2026-11",
      templateId: "tpl-internet",
    });
  });
});
