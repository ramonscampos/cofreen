import { describe, expect, it } from "vitest";
import {
  deriveCardDays,
  detectOpenBillSource,
  evaluateItem,
  isBillPayment,
  mapBill,
  mapTransaction,
  planStalePrune,
  resolveBillMonth,
  summarizeSync,
} from "./mapping";
import type { PluggyBill, PluggyTransaction } from "./types";

const nubank = { closingDay: 16, dueDay: 23 };

describe("resolveBillMonth", () => {
  it("prefers bill due date", () => {
    expect(
      resolveBillMonth({
        billDueDate: "2026-11-23T00:00:00",
        billForecastDate: "2026-10",
        purchaseDate: "2026-10-01",
        ...nubank,
      }),
    ).toBe("2026-11");
  });

  it("uses forecast when no bill", () => {
    expect(
      resolveBillMonth({
        billForecastDate: "2026-12",
        purchaseDate: "2026-11-20",
        ...nubank,
      }),
    ).toBe("2026-12");
  });

  it("derives from closing day", () => {
    expect(resolveBillMonth({ purchaseDate: "2026-11-10", ...nubank })).toBe(
      "2026-11",
    );
    expect(resolveBillMonth({ purchaseDate: "2026-11-20", ...nubank })).toBe(
      "2026-12",
    );
    expect(
      resolveBillMonth({
        purchaseDate: "2026-11-06",
        closingDay: 5,
        dueDay: 15,
      }),
    ).toBe("2026-12");
    expect(
      resolveBillMonth({
        purchaseDate: "2026-11-10",
        closingDay: 28,
        dueDay: 5,
      }),
    ).toBe("2026-12");
  });

  it("falls back to purchase month without closing day", () => {
    expect(
      resolveBillMonth({
        purchaseDate: "2026-11-20",
        closingDay: null,
        dueDay: 23,
      }),
    ).toBe("2026-11");
  });
});

const tx = (overrides: Partial<PluggyTransaction>): PluggyTransaction => ({
  id: "t1",
  description: "Compra",
  amount: 100,
  date: "2026-11-10T00:00:00.000Z",
  type: "DEBIT",
  category: "Shopping",
  ...overrides,
});

describe("isBillPayment", () => {
  it("excludes payment credits", () => {
    expect(
      isBillPayment(tx({ type: "CREDIT", description: "Pagamento recebido" })),
    ).toBe(true);
    expect(
      isBillPayment(
        tx({
          type: "CREDIT",
          description: "X",
          category: "Credit card payment",
        }),
      ),
    ).toBe(true);
  });

  it("catches common payment wordings", () => {
    for (const description of [
      "PAGTO. POR DEB EM C/C",
      "Pagamento efetuado",
      "PAGAMENTO - OBRIGADO",
    ]) {
      expect(isBillPayment(tx({ type: "CREDIT", description }))).toBe(true);
    }
  });

  it("treats a credit matching a bill total as a payment", () => {
    expect(
      isBillPayment(
        tx({ type: "CREDIT", description: "Crédito", amount: 4000 }),
        [1200, 4000],
      ),
    ).toBe(true);
  });

  it("keeps refunds", () => {
    expect(
      isBillPayment(tx({ type: "CREDIT", description: "Estorno Amazon" })),
    ).toBe(false);
  });
});

describe("mapTransaction", () => {
  const bill: PluggyBill = {
    id: "b1",
    dueDate: "2026-11-23T00:00:00",
    totalAmount: 1000,
  };
  const ctx = {
    billsById: new Map([["b1", bill]]),
    categoryNames: new Map([["08000000", "Compras"]]),
    ...nubank,
  };

  it("signs and keeps installments", () => {
    expect(
      mapTransaction(
        tx({
          amount: 280,
          creditCardMetadata: {
            installmentNumber: 3,
            totalInstallments: 10,
            billId: "b1",
            purchaseDate: "2026-09-02T00:00:00.000Z",
          },
        }),
        ctx,
      ),
    ).toMatchObject({
      externalId: "t1",
      amount: "280",
      installmentCurrent: 3,
      installmentTotal: 10,
      monthRef: "2026-11",
      billExternalId: "b1",
      purchaseDate: "2026-09-02",
      category: "Shopping",
    });
  });

  it("translates the category when Pluggy has a translation", () => {
    expect(
      mapTransaction(tx({ category: "Shopping", categoryId: "08000000" }), ctx),
    ).toMatchObject({ category: "Compras" });
    expect(
      mapTransaction(tx({ category: "Travel", categoryId: "99999999" }), ctx),
    ).toMatchObject({ category: "Travel" });
  });

  it("makes credits negative", () => {
    expect(
      mapTransaction(
        tx({ type: "CREDIT", amount: 50, description: "Estorno" }),
        ctx,
      ),
    ).toMatchObject({ amount: "-50" });
  });

  it("drops a credit equal to a synced bill total", () => {
    expect(
      mapTransaction(
        tx({ type: "CREDIT", amount: 1000, description: "Crédito em conta" }),
        ctx,
      ),
    ).toBeNull();
  });

  it("drops bill payments", () => {
    expect(
      mapTransaction(
        tx({ type: "CREDIT", amount: 900, description: "Pagamento recebido" }),
        ctx,
      ),
    ).toBeNull();
  });
});

describe("mapBill", () => {
  it("reads payments", () => {
    expect(
      mapBill({
        id: "b1",
        dueDate: "2026-11-23T00:00:00",
        billClosingDate: "2026-11-16T00:00:00",
        totalAmount: 1000,
        payments: [{ amount: 1000 }],
      }),
    ).toEqual({
      externalId: "b1",
      monthRef: "2026-11",
      dueDate: "2026-11-23",
      closingDate: "2026-11-16",
      totalAmount: "1000",
      paidAmount: "1000",
      hasPaymentInfo: true,
    });
  });

  it("handles missing payments", () => {
    expect(
      mapBill({ id: "b2", dueDate: "2026-12-23T00:00:00", totalAmount: 500 }),
    ).toMatchObject({
      paidAmount: "0",
      hasPaymentInfo: false,
      closingDate: null,
    });
  });
});

describe("deriveCardDays", () => {
  it("uses the most recent bill", () => {
    expect(
      deriveCardDays([
        { id: "a", dueDate: "2026-10-15T00:00:00", totalAmount: 1 },
        {
          id: "b",
          dueDate: "2026-11-23T00:00:00",
          billClosingDate: "2026-11-16T00:00:00",
          totalAmount: 1,
        },
      ]),
    ).toEqual({ dueDay: 23, closingDay: 16 });
  });

  it("returns null without bills", () => {
    expect(deriveCardDays([])).toBeNull();
  });

  it("falls back to the account due date without bills", () => {
    expect(deriveCardDays([], "2026-10-23")).toEqual({
      dueDay: 23,
      closingDay: null,
    });
  });
});

describe("summarizeSync", () => {
  it("keeps going on partial failure", () => {
    const result = summarizeSync([
      {
        itemId: "a",
        label: "Conexão 1",
        ok: true,
        consentExpiresAt: "2027-09-01T00:00:00Z",
      },
      {
        itemId: "b-secret-id",
        label: "Conexão 2",
        ok: false,
        error: "USER_AUTHORIZATION_EXPIRED",
        consentExpiresAt: "2027-03-01T00:00:00Z",
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("USER_AUTHORIZATION_EXPIRED");
    expect(result.error).toContain("Conexão 2");
    expect(result.error).not.toContain("b-secret-id");
    expect(result.consentExpiresAt).toBe("2027-03-01T00:00:00Z");
  });

  it("is ok when every item is ok", () => {
    expect(
      summarizeSync([
        { itemId: "a", label: "Conexão 1", ok: true, consentExpiresAt: null },
      ]),
    ).toEqual({ ok: true, error: null, consentExpiresAt: null });
  });
});

describe("evaluateItem", () => {
  const now = new Date("2026-11-01T00:00:00Z");

  it("fails when consent already expired", () => {
    expect(
      evaluateItem(
        {
          id: "i",
          status: "UPDATED",
          consentExpiresAt: "2026-10-01T00:00:00Z",
        },
        now,
      ),
    ).toEqual({ ok: false, error: "USER_AUTHORIZATION_EXPIRED" });
  });

  it("fails on login error", () => {
    expect(
      evaluateItem(
        {
          id: "i",
          status: "LOGIN_ERROR",
          error: { code: "INVALID_CREDENTIALS" },
        },
        now,
      ),
    ).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
  });

  it("passes an updated item with valid consent", () => {
    expect(
      evaluateItem(
        {
          id: "i",
          status: "UPDATED",
          consentExpiresAt: "2027-10-01T00:00:00Z",
        },
        now,
      ),
    ).toEqual({ ok: true });
  });
});

describe("planStalePrune", () => {
  it("never prunes when Pluggy returned nothing", () => {
    expect(planStalePrune([])).toBeNull();
  });

  it("keeps the fetched ids", () => {
    expect(planStalePrune(["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("detectOpenBillSource", () => {
  it("uses the card balance for Nubank", () => {
    expect(
      detectOpenBillSource(["Nu Pagamentos S.A. - Instituição de Pagamento"]),
    ).toBe("balance");
  });

  it("sums purchases for other banks", () => {
    expect(detectOpenBillSource(["Banco Bradesco", "Banco Bradesco"])).toBe(
      "transactions",
    );
    expect(detectOpenBillSource([])).toBe("transactions");
  });
});
