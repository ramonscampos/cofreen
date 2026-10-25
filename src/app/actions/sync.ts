"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { syncStatus } from "@/db/schema";
import { shouldAutoSync } from "@/lib/pluggy/auto-sync";
import { syncPluggyCards } from "@/lib/pluggy/sync";
import type { ActionResult } from "@/types";

interface SyncOptions {
  // Manual syncs skip the once-a-day limit
  force?: boolean;
}

export async function syncCardsAction({
  force = false,
}: SyncOptions = {}): Promise<ActionResult<{ skipped: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  if (!force) {
    const [status] = await db
      .select()
      .from(syncStatus)
      .where(eq(syncStatus.id, "pluggy"));
    if (!shouldAutoSync(status ?? null, new Date())) {
      return { success: true, data: { skipped: true } };
    }
  }

  const result = await syncPluggyCards();
  revalidatePath("/dashboard");
  return result.ok
    ? { success: true, data: { skipped: false } }
    : { success: false, error: result.error ?? "Falha na sincronização" };
}
