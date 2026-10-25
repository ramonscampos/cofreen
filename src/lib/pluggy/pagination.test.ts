import { describe, expect, it } from "vitest";
import { collectCursorPages } from "./pagination";

describe("collectCursorPages", () => {
  it("follows next until null, appending it as received", async () => {
    const requested: string[] = [];
    const pages: Record<string, { results: number[]; next: string | null }> = {
      "?accountId=a&dateFrom=2026-05-01": {
        results: [1, 2],
        next: "?accountId=a&after=c1",
      },
      "?accountId=a&after=c1": { results: [3], next: null },
    };

    const results = await collectCursorPages(async (query) => {
      requested.push(query);
      return pages[query];
    }, "?accountId=a&dateFrom=2026-05-01");

    expect(results).toEqual([1, 2, 3]);
    expect(requested).toEqual([
      "?accountId=a&dateFrom=2026-05-01",
      "?accountId=a&after=c1",
    ]);
  });
});
