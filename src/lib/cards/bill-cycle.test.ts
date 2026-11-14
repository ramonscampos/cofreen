import { describe, expect, it } from "vitest";
import { billMonthForDate } from "./bill-cycle";

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe("billMonthForDate", () => {
  it("due after closing falls in the closing month", () => {
    expect(billMonthForDate(day(2026, 11, 4), 5, 15)).toBe("2026-11");
  });

  it("a purchase on the closing day goes to the next bill", () => {
    expect(billMonthForDate(day(2026, 11, 5), 5, 15)).toBe("2026-12");
  });

  it("due on or before closing falls in the month after closing", () => {
    expect(billMonthForDate(day(2026, 11, 10), 25, 5)).toBe("2026-12");
    expect(billMonthForDate(day(2026, 11, 9), 10, 10)).toBe("2026-12");
    expect(billMonthForDate(day(2026, 11, 10), 28, 5)).toBe("2026-12");
  });

  it("rolls over the year", () => {
    expect(billMonthForDate(day(2026, 12, 20), 5, 15)).toBe("2027-01");
    expect(billMonthForDate(day(2026, 12, 28), 25, 5)).toBe("2027-02");
  });

  it("caps a closing day past the end of a short month", () => {
    // closing 31 closes on Feb 28 in 2027 and Feb 29 in 2028
    expect(billMonthForDate(day(2027, 2, 27), 31, 10)).toBe("2027-03");
    expect(billMonthForDate(day(2027, 2, 28), 31, 10)).toBe("2027-04");
    expect(billMonthForDate(day(2028, 2, 28), 31, 10)).toBe("2028-03");
    expect(billMonthForDate(day(2028, 2, 29), 31, 10)).toBe("2028-04");
  });
});
