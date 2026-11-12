import { describe, expect, it } from "vitest";
import type { DashboardItem } from "@/types";
import type { MonthData } from "./month-data";
import {
  applyOptimisticPaid,
  isOptimisticId,
  isTemplateProjection,
  revertOptimisticPaid,
} from "./optimistic-paid";

type Tx = MonthData["transactions"][number];
type Template = MonthData["templates"][number];

const tx = (id: string, paid: boolean): Tx =>
  ({
    id,
    userId: "u",
    kind: "expense",
    monthRef: "2026-11",
    description: id,
    amount: "10",
    paid,
    isRecurring: false,
    templateId: null,
    cardId: null,
    installmentCurrent: null,
    installmentTotal: null,
    transactionDate: null,
    deferredToMonth: null,
    deferredFromId: null,
    createdAt: "2026-11-01 00:00:00+00",
  }) as Tx;

const template = {
  id: "rent",
  userId: "u",
  kind: "expense",
  description: "Aluguel",
  defaultAmount: "1500",
  dayOfMonth: 5,
  isActive: true,
} as Template;

const data = (transactions: Tx[]): MonthData =>
  ({ transactions, templates: [template] }) as unknown as MonthData;

const projection: DashboardItem = {
  id: "rent",
  kind: "expense",
  description: "Aluguel",
  amount: 1500,
  day: 5,
  paid: false,
  isRecurring: true,
  originalTemplateId: "rent",
};

const realItem = (id: string, paid: boolean): DashboardItem => ({
  id,
  kind: "expense",
  description: id,
  amount: 10,
  paid,
  isRecurring: false,
  transactionId: id,
});

describe("isTemplateProjection", () => {
  it("is true only for an unpaid template without a transaction", () => {
    expect(isTemplateProjection(projection)).toBe(true);
    expect(isTemplateProjection(realItem("a", false))).toBe(false);
  });
});

describe("applyOptimisticPaid", () => {
  it("flips the paid flag of an existing transaction", () => {
    const result = applyOptimisticPaid(
      data([tx("a", false), tx("b", false)]),
      realItem("a", false),
      "2026-11",
    );

    expect(result.transactions.map((t) => t.paid)).toEqual([true, false]);
  });

  it("adds a paid transaction for a template not materialized yet", () => {
    const result = applyOptimisticPaid(data([]), projection, "2026-11");

    expect(result.transactions).toHaveLength(1);
    const [added] = result.transactions;
    expect(isOptimisticId(added.id)).toBe(true);
    expect(added).toMatchObject({
      paid: true,
      templateId: "rent",
      monthRef: "2026-11",
      description: "Aluguel",
      amount: "1500",
    });
    expect(added.transactionDate?.slice(0, 10)).toBe("2026-11-05");
  });

  it("leaves the data alone when the template is unknown", () => {
    const input = data([]);
    const orphan = { ...projection, originalTemplateId: "gone", id: "gone" };

    expect(applyOptimisticPaid(input, orphan, "2026-11")).toBe(input);
  });
});

describe("revertOptimisticPaid", () => {
  it("restores only the changed item, keeping other updates in the cache", () => {
    const item = realItem("a", false);
    const applied = applyOptimisticPaid(
      data([tx("a", false), tx("b", false)]),
      item,
      "2026-11",
    );
    // Another item changed in the meantime
    const withOther = {
      ...applied,
      transactions: applied.transactions.map((t) =>
        t.id === "b" ? { ...t, paid: true } : t,
      ),
    };

    const result = revertOptimisticPaid(withOther, item);

    expect(result.transactions.map((t) => t.paid)).toEqual([false, true]);
  });

  it("removes the transaction added for a template", () => {
    const applied = applyOptimisticPaid(
      data([tx("a", false)]),
      projection,
      "2026-11",
    );

    const result = revertOptimisticPaid(applied, projection);

    expect(result.transactions.map((t) => t.id)).toEqual(["a"]);
  });
});
