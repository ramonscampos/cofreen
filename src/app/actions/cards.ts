"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { cards } from "@/db/schema";

import type { ActionResult, CreateCardPayload } from "@/types";

export async function createCardAction(
  payload: CreateCardPayload,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db.insert(cards).values({
      ...payload,
      userId: session.user.id,
    });
    revalidatePath("/cards");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

export async function updateCardAction(
  id: string,
  payload: Partial<CreateCardPayload>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db
      .update(cards)
      .set(payload)
      .where(and(eq(cards.id, id), eq(cards.userId, session.user.id)));
    revalidatePath("/cards");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

export async function deleteCardAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db
      .delete(cards)
      .where(and(eq(cards.id, id), eq(cards.userId, session.user.id)));
    revalidatePath("/cards");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
