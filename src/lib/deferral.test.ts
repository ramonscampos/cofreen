import { describe, expect, it } from "vitest";
import type { RecurringTemplate, Transaction } from "@/types";
import { buildDeferral } from "./deferral";
import {
  calculateTotals,
  mergeTransactionsAndTemplates,
} from "./finance-logic";

const internet: RecurringTemplate = {
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
};

const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: "tx",
  userId: "u",
  kind: "expense",
  monthRef: "2026-10",
  description: "Internet",
  amount: "210",
  paid: false,
  isRecurring: true,
  templateId: null,
  cardId: null,
  installmentCurrent: null,
  installmentTotal: null,
  transactionDate: null,
  deferredToMonth: null,
  deferredFromId: null,
  createdAt: "2026-10-01 00:00:00+00",
  ...overrides,
});

describe("buildDeferral", () => {
  it("records a projected bill as deferred and copies it to next month", () => {
    const [item] = mergeTransactionsAndTemplates([], [internet], "2026-10");
    const deferral = buildDeferral(item, "2026-10");
    expect(deferral.original).toEqual({
      kind: "create",
      values: expect.objectContaining({
        templateId: "tpl-internet",
        monthRef: "2026-10",
        paid: false,
        deferredToMonth: "2026-11",
      }),
    });
    expect(deferral.copy).toMatchObject({
      description: "Internet",
      amount: "210",
      kind: "expense",
      monthRef: "2026-11",
      paid: false,
      isRecurring: false,
      transactionDate: "2026-11-15",
    });
    expect(deferral.copy).not.toHaveProperty("templateId");
  });

  it("keeps the due day on the deferred original", () => {
    const [item] = mergeTransactionsAndTemplates([], [internet], "2026-10");
    const { original } = buildDeferral(item, "2026-10");
    expect(original.kind === "create" && original.values.transactionDate).toBe(
      "2026-10-15",
    );
  });

  it("moves a bill due on the 31st to the last day of next month", () => {
    const [item] = mergeTransactionsAndTemplates(
      [],
      [{ ...internet, dayOfMonth: 31 }],
      "2026-10",
    );
    expect(buildDeferral(item, "2026-10").copy.transactionDate).toBe(
      "2026-11-30",
    );
    const [jan] = mergeTransactionsAndTemplates(
      [],
      [{ ...internet, dayOfMonth: 30 }],
      "2027-01",
    );
    expect(buildDeferral(jan, "2027-01").copy.transactionDate).toBe(
      "2027-02-28",
    );
  });

  it("marks an existing row instead of creating one", () => {
    const [item] = mergeTransactionsAndTemplates(
      [tx({ id: "tx-dentista", description: "Dentista", isRecurring: false })],
      [],
      "2026-10",
    );
    expect(buildDeferral(item, "2026-10").original).toEqual({
      kind: "update",
      id: "tx-dentista",
    });
  });

  it("carries the installment so next month counts one installment", () => {
    const fastback: RecurringTemplate = {
      ...internet,
      id: "fastback",
      defaultAmount: "50400",
      installmentCurrent: 1,
      installmentTotal: 18,
    };
    const [item] = mergeTransactionsAndTemplates([], [fastback], "2026-10");
    expect(buildDeferral(item, "2026-10").copy).toMatchObject({
      amount: "50400",
      installmentCurrent: 9,
      installmentTotal: 18,
    });
  });
});

describe("deferred rows in the month view", () => {
  const original = tx({
    id: "orig",
    templateId: "tpl-internet",
    deferredToMonth: "2026-11",
  });
  const copy = tx({
    id: "copy",
    monthRef: "2026-11",
    isRecurring: false,
    deferredFromId: "orig",
    transactionDate: "2026-11-15 00:00:00+00",
  });

  it("stops counting the bill in the month it left", () => {
    const items = mergeTransactionsAndTemplates(
      [original],
      [internet],
      "2026-10",
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      deferredToMonthRef: "2026-11",
      deferLabel: "Adiada → nov",
    });
    expect(calculateTotals(items).expense).toBe(0);
  });

  it("counts the copy next to next month's own bill", () => {
    const items = mergeTransactionsAndTemplates([copy], [internet], "2026-11");
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.id === "copy")).toMatchObject({
      isDeferredCopy: true,
      deferLabel: "Adiada de out",
    });
    expect(calculateTotals(items).expense).toBe(420);
  });
});
