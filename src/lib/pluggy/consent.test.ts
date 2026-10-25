import { describe, expect, it } from "vitest";
import { getConsentNotice } from "./consent";

const now = new Date("2026-11-20T12:00:00Z");

describe("getConsentNotice", () => {
  it("is silent when expiry is far away", () => {
    expect(getConsentNotice("2027-10-25T00:00:00Z", now)).toBeNull();
    expect(getConsentNotice(null, now)).toBeNull();
  });

  it("warns within 30 days", () => {
    expect(getConsentNotice("2026-12-10T15:00:00Z", now)).toEqual({
      expired: false,
      date: "10/12/2026",
    });
  });

  it("reports an expiry already passed", () => {
    expect(getConsentNotice("2026-11-01T15:00:00Z", now)).toEqual({
      expired: true,
      date: "01/11/2026",
    });
  });

  it("shows the Brazilian date for a midnight UTC expiry", () => {
    expect(getConsentNotice("2026-12-10T00:00:00Z", now)?.date).toBe(
      "09/12/2026",
    );
  });
});
