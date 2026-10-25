"use server";

import { auth } from "@/auth";
import { getMonthData } from "@/lib/month-data";

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
    const monthData = await getMonthData(session.user.id, monthRef);

    return {
      success: true,
      data: monthData,
    };
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
