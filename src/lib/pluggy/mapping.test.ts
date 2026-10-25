import { describe, expect, it } from "vitest";
import {
  deriveCardDays,
  isBillPayment,
  mapBill,
  mapTransaction,
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
  const ctx = { billsById: new Map([["b1", bill]]), ...nubank };

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

  it("makes credits negative", () => {
    expect(
      mapTransaction(
        tx({ type: "CREDIT", amount: 50, description: "Estorno" }),
        ctx,
      ),
    ).toMatchObject({ amount: "-50" });
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
});

describe("summarizeSync", () => {
  it("keeps going on partial failure", () => {
    const result = summarizeSync([
      { itemId: "a", ok: true, consentExpiresAt: "2027-09-01T00:00:00Z" },
      {
        itemId: "b",
        ok: false,
        error: "USER_AUTHORIZATION_EXPIRED",
        consentExpiresAt: "2027-03-01T00:00:00Z",
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("USER_AUTHORIZATION_EXPIRED");
    expect(result.consentExpiresAt).toBe("2027-03-01T00:00:00Z");
  });

  it("is ok when every item is ok", () => {
    expect(
      summarizeSync([{ itemId: "a", ok: true, consentExpiresAt: null }]),
    ).toEqual({ ok: true, error: null, consentExpiresAt: null });
  });
});
