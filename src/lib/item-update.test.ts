import { describe, expect, it } from "vitest";
import type { RecurringTemplate, Transaction } from "@/types";
import { mergeTransactionsAndTemplates } from "./finance-logic";
import { buildItemUpdate } from "./item-update";

const fastback: RecurringTemplate = {
  id: "fastback",
  userId: "u",
  kind: "expense",
  description: "Fastback",
  defaultAmount: "50400",
  dayOfMonth: 1,
  monthRef: "2026-02",
  isActive: true,
  installmentCurrent: 1,
  installmentTotal: 18,
  planId: null,
  cardId: null,
  createdAt: "2026-02-01T00:00:00Z",
};

describe("buildItemUpdate", () => {
  it("updates the installment plan itself, keeping its start month", () => {
    const [item] = mergeTransactionsAndTemplates([], [fastback], "2026-10");
    expect(
      buildItemUpdate(item, {
        description: "Fastback",
        amount: 50400,
        day: 10,
        monthRef: "2026-10",
      }),
    ).toEqual({
      target: "template",
      id: "fastback",
      payload: {
        description: "Fastback",
        defaultAmount: "50400",
        dayOfMonth: 10,
      },
    });
  });

  it("updates a recurring bill without moving its start month", () => {
    const [item] = mergeTransactionsAndTemplates(
      [],
      [
        {
          ...fastback,
          id: "internet",
          installmentCurrent: null,
          installmentTotal: null,
        },
      ],
      "2026-10",
    );
    const update = buildItemUpdate(item, {
      description: "Internet",
      amount: 230,
      day: 20,
      monthRef: "2026-10",
    });
    expect(update.target).toBe("template");
    expect(update.payload).not.toHaveProperty("monthRef");
  });

  it("updates a real row, capping the day", () => {
    const tx: Transaction = {
      id: "tx-dentista",
      userId: "u",
      kind: "expense",
      monthRef: "2026-11",
      description: "Dentista",
      amount: "300",
      paid: false,
      isRecurring: false,
      templateId: null,
      installmentCurrent: null,
      installmentTotal: null,
      transactionDate: "2026-11-05 00:00:00+00",
      createdAt: "2026-11-01 00:00:00+00",
    };
    const [item] = mergeTransactionsAndTemplates([tx], [], "2026-11");
    expect(
      buildItemUpdate(item, {
        description: "Dentista",
        amount: 350,
        day: 31,
        monthRef: "2026-11",
      }),
    ).toEqual({
      target: "transaction",
      id: "tx-dentista",
      payload: {
        description: "Dentista",
        amount: "350",
        monthRef: "2026-11",
        transactionDate: "2026-11-30",
      },
    });
  });

  it("keeps a paid template row in its month so the link holds", () => {
    const paid: Transaction = {
      id: "tx-internet-oct",
      userId: "u",
      kind: "expense",
      monthRef: "2026-10",
      description: "Internet",
      amount: "210",
      paid: true,
      isRecurring: true,
      templateId: "internet",
      installmentCurrent: null,
      installmentTotal: null,
      transactionDate: "2026-10-15 00:00:00+00",
      createdAt: "2026-10-15 00:00:00+00",
    };
    const [item] = mergeTransactionsAndTemplates([paid], [], "2026-10");
    const update = buildItemUpdate(item, {
      description: "Internet",
      amount: 220,
      day: 16,
      monthRef: "2026-11",
    });
    expect(update).toEqual({
      target: "transaction",
      id: "tx-internet-oct",
      payload: {
        description: "Internet",
        amount: "220",
        transactionDate: "2026-10-16",
      },
    });
  });
});
