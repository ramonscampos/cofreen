import { describe, expect, it } from "vitest";
import type { Card, CardBill, CardTransaction } from "@/types";
import { buildCardBillView } from "./bill-view";

const card: Card = {
  id: "card-nu",
  userId: "u",
  bankName: "Nubank",
  description: null,
  dueDay: 23,
  closingDay: 16,
  color: "#8257e5",
  pluggyAccountId: "acc-1",
  pluggyItemId: "item-1",
  createdAt: "2026-01-01T00:00:00Z",
};

const bill = (overrides: Partial<CardBill>): CardBill => ({
  id: `bill-${overrides.monthRef}`,
  userId: "u",
  cardId: card.id,
  externalId: `ext-${overrides.monthRef}`,
  monthRef: "2026-10",
  dueDate: `${overrides.monthRef ?? "2026-10"}-23`,
  closingDate: null,
  totalAmount: "1000",
  paidAmount: "0",
  hasPaymentInfo: false,
  updatedAt: "2026-10-01T00:00:00Z",
  ...overrides,
});

let seq = 0;
const tx = (overrides: Partial<CardTransaction>): CardTransaction => {
  seq += 1;
  return {
    id: `tx-${seq}`,
    userId: "u",
    cardId: card.id,
    monthRef: "2026-11",
    description: "Compra",
    amount: "100",
    installmentCurrent: null,
    installmentTotal: null,
    externalId: `ext-tx-${seq}`,
    billExternalId: null,
    purchaseDate: "2026-11-01",
    category: "Compras",
    createdAt: "2026-11-01T00:00:00Z",
    ...overrides,
  };
};

const today = new Date(2026, 9, 25); // 2026-10-25

describe("real bills", () => {
  it("closed bill with payments is paid", () => {
    const view = buildCardBillView({
      card,
      bills: [
        bill({ monthRef: "2026-10", paidAmount: "1000", hasPaymentInfo: true }),
      ],
      transactions: [],
      monthRef: "2026-10",
      today,
    });
    expect(view.status).toBe("paid");
    expect(view.amount).toBe(1000);
    expect(view.dueDate).toBe("2026-10-23");
  });

  it("closed bill without payment info past due is paid_inferred", () => {
    const view = buildCardBillView({
      card,
      bills: [bill({ monthRef: "2026-09" })],
      transactions: [],
      monthRef: "2026-09",
      today,
    });
    expect(view.status).toBe("paid_inferred");
  });

  it("closed bill without payment info not yet due is closed", () => {
    const view = buildCardBillView({
      card,
      bills: [bill({ monthRef: "2026-11" })],
      transactions: [],
      monthRef: "2026-11",
      today,
    });
    expect(view.status).toBe("closed");
  });

  it("partial payment", () => {
    const view = buildCardBillView({
      card,
      bills: [
        bill({ monthRef: "2026-10", paidAmount: "300", hasPaymentInfo: true }),
      ],
      transactions: [],
      monthRef: "2026-10",
      today,
    });
    expect(view.status).toBe("partial");
  });

  it("open month sums transactions including refunds", () => {
    const view = buildCardBillView({
      card,
      bills: [],
      transactions: [
        tx({ amount: "280" }),
        tx({ amount: "120" }),
        tx({ amount: "-50" }),
      ],
      monthRef: "2026-11",
      today,
    });
    expect(view.status).toBe("open");
    expect(view.amount).toBe(350);
    expect(view.purchases).toHaveLength(3);
    expect(view.purchases.every((p) => !p.isForecast)).toBe(true);
  });
});

describe("forecast", () => {
  const history = [
    bill({ monthRef: "2026-09" }),
    bill({ monthRef: "2026-10" }),
  ];
  const tv = (monthRef: string, current: number) =>
    tx({
      monthRef,
      description: "TV Samsung",
      amount: "280",
      installmentCurrent: current,
      installmentTotal: 10,
      purchaseDate: "2026-09-02",
    });

  it("projects installments from latest real month only", () => {
    const transactions = [tv("2026-10", 2), tv("2026-11", 3)];
    const dec = buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2026-12",
      today,
    });
    expect(dec.status).toBe("forecast");
    expect(dec.purchases).toHaveLength(1);
    expect(dec.purchases[0]).toMatchObject({
      installmentCurrent: 4,
      installmentTotal: 10,
      amount: 280,
      isForecast: true,
    });
    expect(dec.amount).toBe(280);
    expect(dec.dueDate).toBe("2026-12-23");

    const feb = buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2027-02",
      today,
    });
    expect(feb.purchases[0].installmentCurrent).toBe(6);

    const sep = buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2027-09",
      today,
    });
    expect(sep.purchases).toHaveLength(0);
    expect(sep.amount).toBe(0);
  });

  it("includes recurring seen in last 2 closed bills within 10%", () => {
    const transactions = [
      tx({
        monthRef: "2026-09",
        description: "Netflix.com 1234",
        amount: "55.90",
      }),
      tx({
        monthRef: "2026-10",
        description: "NETFLIX.COM 9876",
        amount: "59.90",
      }),
      tx({ monthRef: "2026-10", description: "Uber *Trip", amount: "30" }),
      tx({ monthRef: "2026-09", description: "Adobe", amount: "80" }),
      tx({ monthRef: "2026-10", description: "Adobe", amount: "120" }),
      tx({ monthRef: "2026-11", description: "Mercado", amount: "200" }),
    ];
    const dec = buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2026-12",
      today,
    });
    expect(dec.purchases.map((p) => [p.description, p.amount])).toEqual([
      ["NETFLIX.COM 9876", 59.9],
    ]);
  });
});

describe("empty", () => {
  it("past month without data", () => {
    const view = buildCardBillView({
      card,
      bills: [bill({ monthRef: "2026-10" })],
      transactions: [],
      monthRef: "2025-01",
      today,
    });
    expect(view).toMatchObject({ status: "empty", amount: 0, purchases: [] });
  });

  it("card with no bills or transactions", () => {
    const view = buildCardBillView({
      card,
      bills: [],
      transactions: [],
      monthRef: "2026-10",
      today,
    });
    expect(view.status).toBe("empty");
    expect(view.categories).toEqual([]);
  });
});

describe("categories", () => {
  it("aggregates and sorts, dropping non-positive totals", () => {
    const view = buildCardBillView({
      card,
      bills: [],
      transactions: [
        tx({ category: "Transporte", amount: "100" }),
        tx({ category: "Alimentação", amount: "200" }),
        tx({ category: "Alimentação", amount: "100" }),
        tx({ category: "Estorno", amount: "-40" }),
        tx({ category: null, amount: "10" }),
      ],
      monthRef: "2026-11",
      today,
    });
    expect(view.categories).toEqual([
      { category: "Alimentação", amount: 300 },
      { category: "Transporte", amount: 100 },
      { category: "Outros", amount: 10 },
    ]);
  });
});
