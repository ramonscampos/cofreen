"use server";

import { auth } from "@/auth";
import { getCurrentMonthRef, normalizeMonthRef } from "@/lib/finance-logic";
import { getMonthData, type MonthData } from "@/lib/month-data";
import type { ActionResult } from "@/types";

export async function getDashboardSummaryAction(
  monthRef: string,
): Promise<ActionResult<MonthData>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    return {
      success: true,
      data: await getMonthData(
        session.user.id,
        normalizeMonthRef(monthRef, getCurrentMonthRef()),
      ),
    };
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
