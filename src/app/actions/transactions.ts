"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions } from "@/db/schema";

import type { ActionResult, CreateTransactionPayload } from "@/types";

export async function createTransactionAction(
  payload: CreateTransactionPayload,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db.insert(transactions).values({
      ...payload,
      amount: String(payload.amount),
      userId: session.user.id,
    });
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

export async function updateTransactionAction(
  id: string,
  payload: Partial<CreateTransactionPayload>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    const { amount, ...rest } = payload;
    await db
      .update(transactions)
      .set({
        ...rest,
        ...(amount !== undefined ? { amount: String(amount) } : {}),
      })
      .where(
        and(eq(transactions.id, id), eq(transactions.userId, session.user.id)),
      );
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

export async function deleteTransactionAction(
  id: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db
      .delete(transactions)
      .where(
        and(eq(transactions.id, id), eq(transactions.userId, session.user.id)),
      );
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
