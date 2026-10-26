import { format, parse, subMonths } from "date-fns";
import { and, eq, gte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  balances,
  cardBills,
  cards,
  cardTransactions,
  recurringTemplates,
  syncStatus,
  transactions,
} from "@/db/schema";

// Recent card history feeds the forecast of upcoming months
const CARD_HISTORY_MONTHS = 3;

export async function getMonthData(userId: string, monthRef: string) {
  const previousMonthRef = format(
    subMonths(parse(monthRef, "yyyy-MM", new Date()), 1),
    "yyyy-MM",
  );
  const historyStart = format(
    subMonths(new Date(), CARD_HISTORY_MONTHS),
    "yyyy-MM",
  );

  const [
    transactionsRes,
    templatesRes,
    cardsRes,
    cardBillsRes,
    cardTransactionsRes,
    syncStatusRes,
    balancesRes,
    previousTransactionsRes,
  ] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.monthRef, monthRef),
        ),
      ),
    db
      .select()
      .from(recurringTemplates)
      .where(
        and(
          eq(recurringTemplates.userId, userId),
          eq(recurringTemplates.isActive, true),
        ),
      ),
    db.select().from(cards).where(eq(cards.userId, userId)),
    db.select().from(cardBills).where(eq(cardBills.userId, userId)),
    db
      .select()
      .from(cardTransactions)
      .where(
        and(
          eq(cardTransactions.userId, userId),
          or(
            eq(cardTransactions.monthRef, monthRef),
            gte(cardTransactions.monthRef, historyStart),
          ),
        ),
      ),
    db.select().from(syncStatus).where(eq(syncStatus.id, "pluggy")),
    db.select().from(balances).where(eq(balances.userId, userId)),
    // Last month's rows tell which bills are still unpaid
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.monthRef, previousMonthRef),
        ),
      ),
  ]);

  return {
    transactions: transactionsRes,
    templates: templatesRes,
    cards: cardsRes,
    cardBills: cardBillsRes,
    cardTransactions: cardTransactionsRes,
    syncStatus: syncStatusRes.at(0) ?? null,
    balances: balancesRes,
    previousTransactions: previousTransactionsRes,
  };
}

export type MonthData = Awaited<ReturnType<typeof getMonthData>>;
