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
  balance: null,
  openBillSource: "transactions",
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

  it("picks the most recently updated bill when two share a due month", () => {
    const view = buildCardBillView({
      card,
      bills: [
        bill({
          monthRef: "2026-10",
          externalId: "old",
          totalAmount: "900",
          updatedAt: "2026-10-01T00:00:00Z",
        }),
        bill({
          monthRef: "2026-10",
          externalId: "new",
          totalAmount: "1000",
          updatedAt: "2026-10-20T00:00:00Z",
        }),
      ],
      transactions: [],
      monthRef: "2026-10",
      today,
    });
    expect(view.amount).toBe(1000);
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

describe("open bill from card balance", () => {
  const nubank: Card = {
    ...card,
    balance: "5556.81",
    openBillSource: "balance",
  };
  const transactions = [
    tx({
      monthRef: "2026-11",
      description: "Renegociação 1/2",
      amount: "1950.81",
      installmentCurrent: 1,
      installmentTotal: 2,
    }),
    tx({
      monthRef: "2026-11",
      description: "Crédito de parcelamento",
      amount: "-3418.96",
    }),
    tx({
      monthRef: "2026-11",
      description: "Pix no Crédito",
      amount: "2770.52",
    }),
    tx({
      monthRef: "2026-12",
      description: "Renegociação 2/2",
      amount: "1950.81",
      installmentCurrent: 2,
      installmentTotal: 2,
    }),
    tx({
      monthRef: "2027-01",
      description: "Curso 3/12",
      amount: "9.70",
      installmentCurrent: 3,
      installmentTotal: 12,
    }),
  ];

  it("is the balance minus installments listed for later bills", () => {
    const view = buildCardBillView({
      card: nubank,
      bills: [bill({ monthRef: "2026-10" })],
      transactions,
      monthRef: "2026-11",
      today,
    });
    expect(view.status).toBe("open");
    expect(view.amount).toBeCloseTo(3596.3);
  });

  it("adds an adjustment row so the list adds up to the bill", () => {
    const view = buildCardBillView({
      card: nubank,
      bills: [bill({ monthRef: "2026-10" })],
      transactions,
      monthRef: "2026-11",
      today,
    });
    const adjustment = view.purchases.find(
      (p) => p.description === "Saldo anterior e ajustes",
    );
    expect(adjustment?.amount).toBeCloseTo(3596.3 - 1302.37);
    expect(view.purchases.reduce((sum, p) => sum + p.amount, 0)).toBeCloseTo(
      view.amount,
    );
    expect(view.categories.some((c) => c.category === "Ajustes")).toBe(false);
  });

  it("falls back to summing purchases without a balance", () => {
    const view = buildCardBillView({
      card: { ...nubank, balance: null },
      bills: [bill({ monthRef: "2026-10" })],
      transactions,
      monthRef: "2026-11",
      today,
    });
    expect(view.amount).toBeCloseTo(1302.37);
  });
});

describe("forecast", () => {
  const history = [
    bill({ monthRef: "2026-08" }),
    bill({ monthRef: "2026-09" }),
    bill({ monthRef: "2026-10" }),
  ];
  const monthly = (description: string, amounts: string[], day = "18") =>
    ["2026-08", "2026-09", "2026-10"].map((monthRef, index) =>
      tx({
        monthRef,
        description,
        amount: amounts[index],
        purchaseDate: `${monthRef}-${day}`,
      }),
    );
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

  it("projects series that have not posted to the open bill yet", () => {
    const transactions = [
      tv("2026-10", 2),
      tx({ monthRef: "2026-11", description: "Mercado", amount: "200" }),
    ];
    const dec = buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2026-12",
      today,
    });
    expect(
      dec.purchases.filter((p) => p.installmentTotal === 10),
    ).toMatchObject([{ installmentCurrent: 4, amount: 280 }]);
  });

  it("keeps months after the open bill as forecast even with future rows", () => {
    const htm = (monthRef: string, current: number) =>
      tx({
        monthRef,
        description: `Htm *Curso ${current}/12`,
        amount: "9.70",
        installmentCurrent: current,
        installmentTotal: 12,
        purchaseDate: "2026-10-09",
      });
    const transactions = [
      ...monthly("Netflix", ["55.90", "55.90", "55.90"]),
      htm("2026-11", 1),
      htm("2026-12", 2),
    ];

    const nov = buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2026-11",
      today,
    });
    expect(nov.status).toBe("open");
    expect(nov.amount).toBeCloseTo(9.7);

    const dec = buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2026-12",
      today,
    });
    expect(dec.status).toBe("forecast");
    expect(
      dec.purchases.map((p) => [p.installmentCurrent ?? null, p.isForecast]),
    ).toEqual([
      [2, false],
      [null, true],
    ]);
    expect(dec.amount).toBeCloseTo(65.6);

    const jan = buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2027-01",
      today,
    });
    expect(
      jan.purchases.filter((p) => p.installmentTotal === 12),
    ).toMatchObject([{ installmentCurrent: 3, isForecast: true }]);
  });

  const forecastFor = (transactions: CardTransaction[]) =>
    buildCardBillView({
      card,
      bills: history,
      transactions,
      monthRef: "2026-12",
      today,
    }).purchases.map((p) => [p.description, p.amount]);

  it("includes a charge on the same day in each of the last 3 bills", () => {
    expect(
      forecastFor([
        ...monthly("Netflix.com 1234", ["55.90", "55.90", "59.90"]),
        tx({ monthRef: "2026-11", description: "Mercado", amount: "200" }),
      ]),
    ).toEqual([["Netflix.com 1234", 59.9]]);
  });

  it("keeps several subscriptions from the same merchant apart", () => {
    expect(
      forecastFor([
        ...monthly("Apple.Com/Bill", ["19.90", "19.90", "19.90"], "08"),
        ...monthly("Apple.Com/Bill", ["53.90", "53.90", "53.90"], "06"),
      ]),
    ).toEqual([
      ["Apple.Com/Bill", 19.9],
      ["Apple.Com/Bill", 53.9],
    ]);
  });

  it("projects a charge named as a subscription after its first bill", () => {
    expect(
      forecastFor([
        tx({
          monthRef: "2026-11",
          description: "ANTHROPIC* CLAUDE SUB",
          amount: "556.30",
          purchaseDate: "2026-10-07",
        }),
        tx({
          monthRef: "2026-11",
          description: "Loja Qualquer",
          amount: "80",
          purchaseDate: "2026-10-07",
        }),
      ]),
    ).toEqual([["ANTHROPIC* CLAUDE SUB", 556.3]]);
  });

  it("does not project a named subscription twice", () => {
    expect(
      forecastFor([
        ...monthly("Openai *Chatgpt Subscr", ["20", "20", "20"]),
        tx({
          monthRef: "2026-11",
          description: "Openai *Chatgpt Subscr",
          amount: "20",
          purchaseDate: "2026-11-18",
        }),
      ]),
    ).toEqual([["Openai *Chatgpt Subscr", 20]]);
  });

  it("ignores frequent purchases at the same store", () => {
    const store = (monthRef: string, day: string, amount: string) =>
      tx({
        monthRef,
        description: "SUPERMERCADOS BH",
        amount,
        purchaseDate: `${monthRef}-${day}`,
      });
    expect(
      forecastFor([
        store("2026-08", "03", "120.00"),
        store("2026-08", "21", "300.00"),
        store("2026-09", "12", "125.00"),
        store("2026-09", "25", "36.95"),
        store("2026-10", "27", "118.00"),
        store("2026-10", "06", "140.78"),
      ]),
    ).toEqual([]);
  });

  it("ignores charges missing from one of the last 3 bills or off in value", () => {
    expect(
      forecastFor([
        ...monthly("Adobe", ["80", "80", "120"]),
        tx({
          monthRef: "2026-09",
          description: "Uber",
          amount: "30",
          purchaseDate: "2026-09-18",
        }),
        tx({
          monthRef: "2026-10",
          description: "Uber",
          amount: "30",
          purchaseDate: "2026-10-18",
        }),
      ]),
    ).toEqual([]);
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

describe("purchase descriptions", () => {
  it("drops the installment suffix the bank adds to the name", () => {
    const view = buildCardBillView({
      card,
      bills: [],
      transactions: [
        tx({
          description: "Htm *Tiagolemosia 3/12",
          installmentCurrent: 3,
          installmentTotal: 12,
        }),
        tx({
          description: "Bahamas 0000 M - Parcela 3/3",
          installmentCurrent: 3,
          installmentTotal: 3,
        }),
        tx({ description: "Loja 24/7" }),
      ],
      monthRef: "2026-11",
      today,
    });
    expect(view.purchases.map((p) => p.description).sort()).toEqual([
      "Bahamas 0000 M",
      "Htm *Tiagolemosia",
      "Loja 24/7",
    ]);
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
