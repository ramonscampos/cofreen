import "server-only";
import { format, startOfMonth, subMonths } from "date-fns";
import { and, eq, gte, notInArray, sql } from "drizzle-orm";
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
  detectOpenBillSource,
  evaluateItem,
  type ItemSyncResult,
  mapBill,
  mapTransaction,
  type OpenBillSource,
  planStalePrune,
  summarizeSync,
} from "./mapping";
import type { PluggyAccount } from "./types";

const DEFAULT_CARD_COLOR = "#8257e5";
const HISTORY_MONTHS = 6;
const UPSERT_CHUNK = 200;

async function resolveUserId(): Promise<string> {
  const email = process.env.ALLOWED_EMAIL;
  if (!email) throw new Error("ALLOWED_EMAIL não configurado");
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()));
  if (!user) throw new Error("Usuário do ALLOWED_EMAIL não encontrado");
  return user.id;
}

async function syncAccount(
  client: PluggyClient,
  userId: string,
  itemId: string,
  account: PluggyAccount,
  from: string,
  categoryNames: Map<string, string>,
  openBillSource: OpenBillSource,
) {
  const bills = await client.listBills(account.id);
  const days = deriveCardDays(bills, account.creditData?.balanceDueDate);

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
      balance: String(account.balance),
      openBillSource,
    })
    .onConflictDoUpdate({
      target: cards.pluggyAccountId,
      set: {
        pluggyItemId: itemId,
        balance: String(account.balance),
        openBillSource,
        ...(days ? { dueDay: days.dueDay, closingDay: days.closingDay } : {}),
      },
    })
    .returning();

  if (bills.length > 0) {
    await db
      .insert(cardBills)
      .values(
        bills.map((bill) => ({ ...mapBill(bill), userId, cardId: card.id })),
      )
      .onConflictDoUpdate({
        target: cardBills.externalId,
        set: {
          monthRef: sql`excluded.month_ref`,
          dueDate: sql`excluded.due_date`,
          closingDate: sql`excluded.closing_date`,
          totalAmount: sql`excluded.total_amount`,
          paidAmount: sql`excluded.paid_amount`,
          hasPaymentInfo: sql`excluded.has_payment_info`,
          updatedAt: sql`now()`,
        },
      });
  }

  const keepBillIds = planStalePrune(bills.map((bill) => bill.id));
  if (keepBillIds) {
    await db
      .delete(cardBills)
      .where(
        and(
          eq(cardBills.cardId, card.id),
          notInArray(cardBills.externalId, keepBillIds),
        ),
      );
  }

  const billsById = new Map(bills.map((bill) => [bill.id, bill]));
  const transactions = await client.listTransactions(account.id, from);
  const mapped = transactions
    .map((tx) =>
      mapTransaction(tx, {
        billsById,
        categoryNames,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
      }),
    )
    .filter((tx) => tx !== null);

  for (let i = 0; i < mapped.length; i += UPSERT_CHUNK) {
    await db
      .insert(cardTransactions)
      .values(
        mapped
          .slice(i, i + UPSERT_CHUNK)
          .map((tx) => ({ ...tx, userId, cardId: card.id })),
      )
      .onConflictDoUpdate({
        target: cardTransactions.externalId,
        set: {
          description: sql`excluded.description`,
          amount: sql`excluded.amount`,
          monthRef: sql`excluded.month_ref`,
          installmentCurrent: sql`excluded.installment_current`,
          installmentTotal: sql`excluded.installment_total`,
          billExternalId: sql`excluded.bill_external_id`,
          purchaseDate: sql`excluded.purchase_date`,
          category: sql`excluded.category`,
        },
      });
  }

  const keepIds = planStalePrune(mapped.map((tx) => tx.externalId));
  if (!keepIds) return;

  // Purchases that vanished from Pluggy inside the synced window
  await db
    .delete(cardTransactions)
    .where(
      and(
        eq(cardTransactions.cardId, card.id),
        gte(cardTransactions.purchaseDate, from),
        notInArray(cardTransactions.externalId, keepIds),
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
    const categoryNames = await client.listCategoryNames();
    const itemIds = (process.env.PLUGGY_ITEM_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (itemIds.length === 0) throw new Error("PLUGGY_ITEM_IDS vazio");

    const from = format(
      startOfMonth(subMonths(new Date(), HISTORY_MONTHS)),
      "yyyy-MM-dd",
    );

    for (const [index, itemId] of itemIds.entries()) {
      const label = `Conexão ${index + 1} de ${itemIds.length}`;
      try {
        const item = await client.getItem(itemId);
        const outcome = evaluateItem(item, new Date());
        if (!outcome.ok) {
          results.push({
            itemId,
            label,
            ok: false,
            error: outcome.error,
            consentExpiresAt: item.consentExpiresAt ?? null,
          });
          continue;
        }
        const accounts = await client.listAccounts(itemId);
        const openBillSource = detectOpenBillSource(
          accounts.filter((a) => a.type === "BANK").map((a) => a.name),
        );
        for (const account of accounts.filter((a) => a.type === "CREDIT")) {
          await syncAccount(
            client,
            userId,
            itemId,
            account,
            from,
            categoryNames,
            openBillSource,
          );
        }
        results.push({
          itemId,
          label,
          ok: true,
          consentExpiresAt: item.consentExpiresAt ?? null,
        });
      } catch (error) {
        results.push({
          itemId,
          label,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    results.push({
      itemId: "config",
      label: "Configuração",
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
