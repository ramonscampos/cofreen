import { format, startOfMonth, subMonths } from "date-fns";
import { and, eq, gte, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  cardBills,
  cards,
  cardTransactions,
  syncStatus,
  users,
} from "@/db/schema";
import { createPluggyClient, type PluggyClient } from "./client";
import {
  deriveCardDays,
  type ItemSyncResult,
  mapBill,
  mapTransaction,
  summarizeSync,
} from "./mapping";
import type { PluggyAccount } from "./types";

const DEFAULT_CARD_COLOR = "#8257e5";
const HISTORY_MONTHS = 6;

async function resolveUserId(): Promise<string> {
  const email = process.env.ALLOWED_EMAIL;
  if (!email) throw new Error("ALLOWED_EMAIL não configurado");
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email));
  if (!user) throw new Error("Usuário do ALLOWED_EMAIL não encontrado");
  return user.id;
}

async function syncAccount(
  client: PluggyClient,
  userId: string,
  itemId: string,
  account: PluggyAccount,
  from: string,
) {
  const bills = await client.listBills(account.id);
  const days = deriveCardDays(bills);

  const [card] = await db
    .insert(cards)
    .values({
      userId,
      bankName: account.marketingName ?? account.name,
      color: DEFAULT_CARD_COLOR,
      dueDay: days?.dueDay ?? 1,
      closingDay: days?.closingDay ?? null,
      pluggyAccountId: account.id,
      pluggyItemId: itemId,
    })
    .onConflictDoUpdate({
      target: cards.pluggyAccountId,
      set: {
        pluggyItemId: itemId,
        ...(days ? { dueDay: days.dueDay, closingDay: days.closingDay } : {}),
      },
    })
    .returning();

  for (const bill of bills) {
    const mapped = mapBill(bill);
    await db
      .insert(cardBills)
      .values({ ...mapped, userId, cardId: card.id })
      .onConflictDoUpdate({
        target: cardBills.externalId,
        set: { ...mapped, updatedAt: new Date().toISOString() },
      });
  }

  const billsById = new Map(bills.map((bill) => [bill.id, bill]));
  const transactions = await client.listTransactions(account.id, from);
  const externalIds: string[] = [];

  for (const tx of transactions) {
    const mapped = mapTransaction(tx, {
      billsById,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
    });
    if (!mapped) continue;
    externalIds.push(mapped.externalId);
    await db
      .insert(cardTransactions)
      .values({ ...mapped, userId, cardId: card.id })
      .onConflictDoUpdate({ target: cardTransactions.externalId, set: mapped });
  }

  // Purchases that vanished from Pluggy inside the synced window
  await db
    .delete(cardTransactions)
    .where(
      and(
        eq(cardTransactions.cardId, card.id),
        gte(cardTransactions.purchaseDate, from),
        externalIds.length > 0
          ? notInArray(cardTransactions.externalId, externalIds)
          : undefined,
      ),
    );
}

export async function syncPluggyCards(): Promise<{
  ok: boolean;
  error: string | null;
}> {
  const results: ItemSyncResult[] = [];

  try {
    const userId = await resolveUserId();
    const client = await createPluggyClient();
    const itemIds = (process.env.PLUGGY_ITEM_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (itemIds.length === 0) throw new Error("PLUGGY_ITEM_IDS vazio");

    const from = format(
      startOfMonth(subMonths(new Date(), HISTORY_MONTHS)),
      "yyyy-MM-dd",
    );

    for (const itemId of itemIds) {
      try {
        const item = await client.getItem(itemId);
        if (item.error || item.status === "LOGIN_ERROR") {
          results.push({
            itemId,
            ok: false,
            error: item.error?.code ?? item.status,
            consentExpiresAt: item.consentExpiresAt ?? null,
          });
          continue;
        }
        const accounts = await client.listAccounts(itemId);
        for (const account of accounts.filter((a) => a.type === "CREDIT")) {
          await syncAccount(client, userId, itemId, account, from);
        }
        results.push({
          itemId,
          ok: true,
          consentExpiresAt: item.consentExpiresAt ?? null,
        });
      } catch (error) {
        results.push({
          itemId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    results.push({
      itemId: "config",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const summary = summarizeSync(results);
  const now = new Date().toISOString();
  const status = summary.ok
    ? { lastSuccessAt: now }
    : { lastErrorAt: now, lastError: summary.error };
  const consent = summary.consentExpiresAt
    ? { consentExpiresAt: summary.consentExpiresAt }
    : {};

  await db
    .insert(syncStatus)
    .values({ id: "pluggy", ...status, ...consent })
    .onConflictDoUpdate({
      target: syncStatus.id,
      set: { ...status, ...consent },
    });

  return { ok: summary.ok, error: summary.error };
}
