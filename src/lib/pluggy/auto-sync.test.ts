import { describe, expect, it } from "vitest";
import type { SyncStatus } from "@/types";
import { shouldAutoSync } from "./auto-sync";

const now = new Date("2026-11-20T12:00:00Z");
const status = (overrides: Partial<SyncStatus>): SyncStatus => ({
  id: "pluggy",
  lastSuccessAt: null,
  lastErrorAt: null,
  lastError: null,
  consentExpiresAt: null,
  ...overrides,
});

describe("shouldAutoSync", () => {
  it("syncs when never synced", () => {
    expect(shouldAutoSync(null, now)).toBe(true);
  });

  it("skips within 24h of the last attempt", () => {
    expect(
      shouldAutoSync(status({ lastSuccessAt: "2026-11-19T13:00:00Z" }), now),
    ).toBe(false);
  });

  it("syncs after 24h", () => {
    expect(
      shouldAutoSync(status({ lastSuccessAt: "2026-11-19T11:59:00Z" }), now),
    ).toBe(true);
  });

  it("counts a recent failure as an attempt", () => {
    expect(
      shouldAutoSync(
        status({
          lastSuccessAt: "2026-10-01T00:00:00Z",
          lastErrorAt: "2026-11-20T08:00:00Z",
        }),
        now,
      ),
    ).toBe(false);
  });
});
