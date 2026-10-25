import { describe, expect, it } from "vitest";
import { groupCategories } from "./category-groups";

describe("groupCategories", () => {
  it("keeps the top categories and folds the rest into Outros", () => {
    const rows = groupCategories(
      [
        { category: "Supermercado", amount: 300 },
        { category: "Compras", amount: 200 },
        { category: "Saúde", amount: 50 },
        { category: "Moradia", amount: 25 },
      ],
      2,
    );
    expect(rows).toEqual([
      { label: "Supermercado", amount: 300, members: ["Supermercado"] },
      { label: "Compras", amount: 200, members: ["Compras"] },
      { label: "Outros", amount: 75, members: ["Saúde", "Moradia"] },
    ]);
  });

  it("merges a real Outros category into the folded row", () => {
    const rows = groupCategories(
      [
        { category: "Supermercado", amount: 300 },
        { category: "Outros", amount: 40 },
        { category: "Saúde", amount: 10 },
      ],
      1,
    );
    expect(rows.at(-1)).toEqual({
      label: "Outros",
      amount: 50,
      members: ["Outros", "Saúde"],
    });
  });

  it("does not add Outros when everything fits", () => {
    expect(groupCategories([{ category: "Compras", amount: 10 }], 6)).toEqual([
      { label: "Compras", amount: 10, members: ["Compras"] },
    ]);
  });
});
