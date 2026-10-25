import { describe, expect, it } from "vitest";
import {
  detectBank,
  institutionLabel,
  mapBankAccounts,
  mapInvestments,
  summarizeBalances,
} from "./balances";

describe("institutionLabel", () => {
  it("names the bank and the holder type from the tax number", () => {
    expect(
      institutionLabel(
        ["Nu Pagamentos S.A. - Instituição de Pagamento"],
        "12.345.678/0001-90",
      ),
    ).toBe("Nubank PJ");
    expect(institutionLabel(["Nu Pagamentos S.A."], "123.456.789-00")).toBe(
      "Nubank PF",
    );
    expect(institutionLabel(["Banco Bradesco"], null)).toBe("Bradesco");
  });
});

describe("mapBankAccounts", () => {
  it("keeps bank accounts with their balance", () => {
    expect(
      mapBankAccounts(
        [
          {
            id: "a1",
            type: "BANK",
            subtype: "CHECKING_ACCOUNT",
            name: "Nu",
            balance: 21.96,
          },
          {
            id: "c1",
            type: "CREDIT",
            subtype: "CREDIT_CARD",
            name: "gold",
            balance: 416.82,
          },
        ],
        "Nubank PJ",
      ),
    ).toEqual([
      {
        externalId: "a1",
        kind: "account",
        institution: "Nubank PJ",
        name: "Conta corrente",
        amount: "21.96",
      },
    ]);
  });
});

describe("mapInvestments", () => {
  it("keeps only active investments with money in them", () => {
    expect(
      mapInvestments(
        [
          {
            id: "i1",
            name: "CDB - NU FINANCEIRA",
            type: "FIXED_INCOME",
            balance: 505.56,
            status: "ACTIVE",
          },
          {
            id: "i2",
            name: "CDB - NU FINANCEIRA",
            type: "FIXED_INCOME",
            balance: 0,
            status: "TOTAL_WITHDRAWAL",
          },
        ],
        "Nubank PJ",
      ),
    ).toEqual([
      {
        externalId: "i1",
        kind: "investment",
        institution: "Nubank PJ",
        name: "CDB - NU FINANCEIRA",
        amount: "505.56",
      },
    ]);
  });
});

describe("mapInvestments status", () => {
  it("keeps investments without a status when they hold money", () => {
    expect(
      mapInvestments(
        [
          {
            id: "i3",
            name: "Caixinha",
            type: "FIXED_INCOME",
            balance: 100,
            status: null,
          },
        ],
        "Nubank PF",
      ).map((row) => row.externalId),
    ).toEqual(["i3"]);
  });
});

describe("detectBank", () => {
  it("recognizes the bank from its account names", () => {
    expect(detectBank(["Nu Pagamentos S.A."])).toBe("Nubank");
    expect(detectBank(["Banco Bradesco"])).toBe("Bradesco");
    expect(detectBank(["Banco Inter"])).toBe("Banco Inter");
  });
});

describe("summarizeBalances", () => {
  it("totals accounts and investments per institution", () => {
    const summary = summarizeBalances([
      { kind: "account", institution: "Nubank PJ", amount: "21.96" },
      { kind: "account", institution: "Bradesco", amount: "0" },
      { kind: "account", institution: "Bradesco", amount: "100" },
      { kind: "investment", institution: "Nubank PJ", amount: "505.56" },
    ]);
    expect(summary.accounts.total).toBeCloseTo(121.96);
    expect(summary.accounts.byInstitution).toEqual([
      { institution: "Bradesco", amount: 100 },
      { institution: "Nubank PJ", amount: 21.96 },
    ]);
    expect(summary.investments).toEqual({
      total: 505.56,
      byInstitution: [{ institution: "Nubank PJ", amount: 505.56 }],
    });
  });

  it("lists institutions with an empty balance too", () => {
    expect(
      summarizeBalances([
        { kind: "account", institution: "Nubank PF", amount: "0" },
      ]).accounts.byInstitution,
    ).toEqual([{ institution: "Nubank PF", amount: 0 }]);
  });
});
