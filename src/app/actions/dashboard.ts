"use server";

import { and, eq, gt, lte, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  cards,
  cardTransactions,
  recurringTemplates,
  transactions,
} from "@/db/schema";

import type {
  ActionResult,
  Card,
  CardTransaction,
  RecurringTemplate,
  Transaction,
} from "@/types";

export interface DashboardSummaryData {
  transactions: Transaction[];
  templates: RecurringTemplate[];
  cards: Card[];
  cardTransactions: CardTransaction[];
}

export async function getDashboardSummaryAction(
  monthRef: string,
): Promise<ActionResult<DashboardSummaryData>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const [txRes, tmplRes, cardRes, cardTxRes] = await Promise.all([
      db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, session.user.id),
            eq(transactions.monthRef, monthRef),
          ),
        ),
      db
        .select()
        .from(recurringTemplates)
        .where(
          and(
            eq(recurringTemplates.userId, session.user.id),
            eq(recurringTemplates.isActive, true),
          ),
        ),
      db.select().from(cards).where(eq(cards.userId, session.user.id)),
      db
        .select()
        .from(cardTransactions)
        .where(
          and(
            eq(cardTransactions.userId, session.user.id),
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
      success: true,
      data: {
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle select types are complex and match our interfaces
        transactions: txRes as any[],
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle select types are complex and match our interfaces
        templates: tmplRes as any[],
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle select types are complex and match our interfaces
        cards: cardRes as any[],
        // biome-ignore lint/suspicious/noExplicitAny: Drizzle select types are complex and match our interfaces
        cardTransactions: cardTxRes as any[],
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
