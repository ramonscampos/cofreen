import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  cards,
  cardTransactions,
  recurringTemplates,
  transactions,
} from "@/db/schema";
import { getCurrentMonthRef } from "@/lib/finance-logic";
import { DashboardView } from "../dashboard-view";

interface SearchParams {
  month?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    return redirect("/login");
  }

  // Resolve search params
  const params = await searchParams;
  const monthRef = params.month || getCurrentMonthRef();

  // Fetch initial data for the month
  // We fetch in parallel for performance
  const [transactionsRes, templatesRes, cardsRes, cardTransRes] =
    await Promise.all([
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
            eq(cardTransactions.monthRef, monthRef),
          ),
        ),
    ]);

  return (
    <DashboardView
      initialMonthRef={monthRef}
      initialTransactions={transactionsRes}
      initialTemplates={templatesRes}
      initialCards={cardsRes}
      initialCardTransactions={cardTransRes}
    />
  );
}
