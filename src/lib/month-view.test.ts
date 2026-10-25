import { describe, expect, it } from "vitest";
import type { MonthData } from "./month-data";
import { buildMonthView } from "./month-view";

const data: MonthData = {
  transactions: [],
  templates: [
    {
      id: "salary",
      userId: "u",
      kind: "incoming",
      description: "Dasa",
      defaultAmount: "22500",
      dayOfMonth: 15,
      isActive: true,
      monthRef: "2026-02",
      installmentCurrent: null,
      installmentTotal: null,
      planId: null,
      cardId: null,
      createdAt: "2026-02-01T00:00:00Z",
    },
    {
      id: "light",
      userId: "u",
      kind: "expense",
      description: "Água e luz",
      defaultAmount: "600",
      dayOfMonth: 20,
      isActive: true,
      monthRef: "2026-02",
      installmentCurrent: null,
      installmentTotal: null,
      planId: null,
      cardId: null,
      createdAt: "2026-02-01T00:00:00Z",
    },
  ],
  cards: [
    {
      id: "card-nu",
      userId: "u",
      bankName: "Nubank",
      description: null,
      dueDay: 23,
      closingDay: 16,
      color: "#8257e5",
      pluggyAccountId: "acc-1",
      pluggyItemId: "item-1",
      balance: null,
      openBillSource: "transactions",
      createdAt: "2026-01-01T00:00:00Z",
    },
  ],
  cardBills: [
    {
      id: "b1",
      userId: "u",
      cardId: "card-nu",
      externalId: "ext-b1",
      monthRef: "2026-11",
      dueDate: "2026-11-23",
      closingDate: "2026-11-16",
      totalAmount: "1000",
      paidAmount: "0",
      hasPaymentInfo: false,
      updatedAt: "2026-11-01T00:00:00Z",
    },
  ],
  cardTransactions: [],
  syncStatus: null,
};

describe("buildMonthView", () => {
  const view = buildMonthView(data, "2026-11", new Date(2026, 10, 1));

  it("totals include card bills", () => {
    expect(view.totals).toEqual({
      incoming: 22500,
      expense: 1600,
      total: 20900,
    });
  });

  it("main items never contain cards", () => {
    expect(view.items).toHaveLength(2);
    expect(view.items.some((item) => item.id.startsWith("virtual-card-"))).toBe(
      false,
    );
    expect(view.cardBills).toHaveLength(1);
    expect(view.cardBills[0].amount).toBe(1000);
  });
});
