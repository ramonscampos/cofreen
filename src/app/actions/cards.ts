"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { cards } from "@/db/schema";

import type { ActionResult, UpdateCardPayload } from "@/types";

// Cards are created by the Pluggy sync; only display fields are editable
export async function updateCardAction(
  id: string,
  payload: UpdateCardPayload,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db
      .update(cards)
      .set({ bankName: payload.bankName, color: payload.color })
      .where(and(eq(cards.id, id), eq(cards.userId, session.user.id)));
    revalidatePath("/cards");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
