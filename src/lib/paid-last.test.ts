import { describe, expect, it } from "vitest";
import type { DashboardItem } from "@/types";
import { isPaidItem, splitPaidLast } from "./paid-last";

function item(
  id: string,
  overrides: Partial<DashboardItem> = {},
): DashboardItem {
  return {
    id,
    kind: "expense",
    description: id,
    amount: 10,
    paid: false,
    isRecurring: false,
    ...overrides,
  };
}

const ids = (items: DashboardItem[]) => items.map((i) => i.id);

describe("isPaidItem", () => {
  it("is true only for paid expenses", () => {
    expect(isPaidItem(item("a", { paid: true }))).toBe(true);
    expect(isPaidItem(item("a", { paid: false }))).toBe(false);
  });

  it("ignores the paid flag of incomes, which have no paid state", () => {
    expect(isPaidItem(item("a", { kind: "incoming", paid: true }))).toBe(false);
  });
});

describe("splitPaidLast", () => {
  it("puts paid items after all pending ones, keeping the order inside each group", () => {
    const result = splitPaidLast([
      item("a", { paid: true }),
      item("b"),
      item("c", { paid: true }),
      item("d"),
      item("e"),
    ]);

    expect(ids(result.pending)).toEqual(["b", "d", "e"]);
    expect(ids(result.paid)).toEqual(["a", "c"]);
  });

  it("returns an empty paid group when nothing is paid", () => {
    const result = splitPaidLast([item("a"), item("b")]);

    expect(ids(result.pending)).toEqual(["a", "b"]);
    expect(result.paid).toEqual([]);
  });

  it("keeps incomes in the pending group", () => {
    const result = splitPaidLast([
      item("salary", { kind: "incoming", paid: true }),
      item("rent", { paid: true }),
    ]);

    expect(ids(result.pending)).toEqual(["salary"]);
    expect(ids(result.paid)).toEqual(["rent"]);
  });

  it("moves an item between groups when its paid state flips", () => {
    const before = [item("a"), item("b"), item("c")];
    const after = before.map((i) => (i.id === "a" ? { ...i, paid: true } : i));

    expect(ids(splitPaidLast(before).pending)).toEqual(["a", "b", "c"]);
    expect(ids(splitPaidLast(after).pending)).toEqual(["b", "c"]);
    expect(ids(splitPaidLast(after).paid)).toEqual(["a"]);
  });

  it("does not mutate the input", () => {
    const input = [item("a", { paid: true }), item("b")];
    splitPaidLast(input);

    expect(ids(input)).toEqual(["a", "b"]);
  });
});
