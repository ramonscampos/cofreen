import { and, eq, gt, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  cards,
  cardTransactions,
  recurringTemplates,
  transactions,
} from "@/db/schema";

export async function getMonthData(userId: string, monthRef: string) {
  const [transactionsRes, templatesRes, cardsRes, cardTransactionsRes] =
    await Promise.all([
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
      db
        .select()
        .from(cardTransactions)
        .where(
          and(
            eq(cardTransactions.userId, userId),
            // Installment plans are stored once, in their start month
            or(
              eq(cardTransactions.monthRef, monthRef),
              and(
                gt(cardTransactions.installmentTotal, 1),
                lte(cardTransactions.monthRef, monthRef),
              ),
            ),
          ),
        ),
    ]);

  return {
    transactions: transactionsRes,
    templates: templatesRes,
    cards: cardsRes,
    cardTransactions: cardTransactionsRes,
  };
}
