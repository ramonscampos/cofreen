"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { syncPluggyCards } from "@/lib/pluggy/sync";
import type { ActionResult } from "@/types";

export async function syncCardsAction(): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  const result = await syncPluggyCards();
  revalidatePath("/dashboard");
  return result.ok
    ? { success: true }
    : { success: false, error: result.error ?? "Falha na sincronização" };
}
