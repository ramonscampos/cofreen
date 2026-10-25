import { type CursorPage, collectCursorPages } from "./pagination";
import type {
  PluggyAccount,
  PluggyBill,
  PluggyItem,
  PluggyPage,
  PluggyTransaction,
} from "./types";

const BASE_URL = "https://api.pluggy.ai";

export class PluggyError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Pluggy ${status}: ${body.slice(0, 200)}`);
  }
}

export interface PluggyClient {
  getItem(itemId: string): Promise<PluggyItem>;
  listAccounts(itemId: string): Promise<PluggyAccount[]>;
  listBills(accountId: string): Promise<PluggyBill[]>;
  listTransactions(
    accountId: string,
    from: string,
  ): Promise<PluggyTransaction[]>;
}

async function request<T>(
  path: string,
  init: RequestInit & { apiKey?: string } = {},
): Promise<T> {
  const { apiKey, headers, ...rest } = init;
  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-KEY": apiKey } : {}),
      ...headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new PluggyError(response.status, await response.text());
  }
  return response.json() as Promise<T>;
}

export async function createPluggyClient(): Promise<PluggyClient> {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET não configurados");
  }

  const { apiKey } = await request<{ apiKey: string }>("/auth", {
    method: "POST",
    body: JSON.stringify({ clientId, clientSecret }),
  });

  const get = <T>(path: string) => request<T>(path, { apiKey });

  async function getAllPages<T>(path: string): Promise<T[]> {
    const separator = path.includes("?") ? "&" : "?";
    const results: T[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const data = await get<PluggyPage<T>>(
        `${path}${separator}pageSize=500&page=${page}`,
      );
      results.push(...data.results);
      totalPages = data.totalPages ?? 1;
      page += 1;
    } while (page <= totalPages);
    return results;
  }

  return {
    getItem: (itemId) => get<PluggyItem>(`/items/${itemId}`),
    listAccounts: async (itemId) =>
      (await get<{ results: PluggyAccount[] }>(`/accounts?itemId=${itemId}`))
        .results,
    listBills: (accountId) =>
      getAllPages<PluggyBill>(`/bills?accountId=${accountId}`),
    listTransactions: (accountId, from) =>
      collectCursorPages(
        (query) =>
          get<CursorPage<PluggyTransaction>>(`/v2/transactions${query}`),
        `?accountId=${accountId}&dateFrom=${from}`,
      ),
  };
}
