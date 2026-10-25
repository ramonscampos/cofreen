import { describe, expect, it } from "vitest";
import { getTodayInSaoPaulo } from "./dates";

describe("getTodayInSaoPaulo", () => {
  it("uses the Brazilian date late at night UTC", () => {
    expect(getTodayInSaoPaulo(new Date("2026-11-20T02:00:00Z"))).toBe(
      "2026-11-19",
    );
  });

  it("matches UTC during the day", () => {
    expect(getTodayInSaoPaulo(new Date("2026-11-20T15:00:00Z"))).toBe(
      "2026-11-20",
    );
  });
});
