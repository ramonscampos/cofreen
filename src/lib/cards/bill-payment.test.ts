import { describe, expect, it } from "vitest";
import {
  formatPaidOn,
  maskDate,
  parsePaidOn,
  validateBillPayment,
} from "./bill-payment";

const valid = {
  cardId: "c1",
  monthRef: "2026-11",
  amount: 100,
  paidOn: "2026-11-14",
};

describe("maskDate", () => {
  it("adds slashes while typing and drops non-digits", () => {
    expect(maskDate("1")).toBe("1");
    expect(maskDate("141")).toBe("14/1");
    expect(maskDate("14112026")).toBe("14/11/2026");
    expect(maskDate("14/11/2026999")).toBe("14/11/2026");
    expect(maskDate("ab")).toBe("");
  });
});

describe("parsePaidOn", () => {
  it("converts to ISO", () => {
    expect(parsePaidOn("14/11/2026")).toBe("2026-11-14");
  });

  it("rejects impossible and incomplete dates", () => {
    expect(parsePaidOn("31/02/2026")).toBeNull();
    expect(parsePaidOn("14/11/26")).toBeNull();
    expect(parsePaidOn("")).toBeNull();
  });
});

describe("formatPaidOn", () => {
  it("shows day first", () => {
    expect(formatPaidOn("2026-11-14")).toBe("14/11/2026");
  });
});

describe("validateBillPayment", () => {
  it("accepts a valid payment", () => {
    expect(validateBillPayment(valid)).toBeNull();
  });

  it("rejects a non-positive or invalid amount", () => {
    expect(validateBillPayment({ ...valid, amount: 0 })).not.toBeNull();
    expect(validateBillPayment({ ...valid, amount: -5 })).not.toBeNull();
    expect(
      validateBillPayment({ ...valid, amount: Number.NaN }),
    ).not.toBeNull();
  });

  it("rejects a bad month or date", () => {
    expect(
      validateBillPayment({ ...valid, monthRef: "2026-13" }),
    ).not.toBeNull();
    expect(
      validateBillPayment({ ...valid, paidOn: "2026-02-30" }),
    ).not.toBeNull();
  });
});
