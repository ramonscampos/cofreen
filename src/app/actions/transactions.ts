"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { cardTransactions, transactions } from "@/db/schema";

import type { ActionResult, CreateTransactionPayload } from "@/types";

export async function createTransactionAction(
  payload: CreateTransactionPayload,
  isCardTx = false,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    if (isCardTx) {
      await db.insert(cardTransactions).values({
        ...payload,
        userId: session.user.id,
        // biome-ignore lint/suspicious/noExplicitAny: CardTransactions type mismatch between Drizzle and Central Payload
      } as any);
    } else {
      await db.insert(transactions).values({
        ...payload,
        userId: session.user.id,
        // biome-ignore lint/suspicious/noExplicitAny: Transactions type mismatch between Drizzle and Central Payload
      } as any);
    }
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
  isCardTx = false,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    if (isCardTx) {
      await db
        .update(cardTransactions)
        // biome-ignore lint/suspicious/noExplicitAny: Partial payload contains helper fields not in DB
        .set(payload as any)
        .where(
          and(
            eq(cardTransactions.id, id),
            eq(cardTransactions.userId, session.user.id),
          ),
        );
    } else {
      await db
        .update(transactions)
        // biome-ignore lint/suspicious/noExplicitAny: Partial payload contains helper fields not in DB
        .set(payload as any)
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.userId, session.user.id),
          ),
        );
    }

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
  isCardTx = false,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    if (isCardTx) {
      await db
        .delete(cardTransactions)
        .where(
          and(
            eq(cardTransactions.id, id),
            eq(cardTransactions.userId, session.user.id),
          ),
        );
    } else {
      await db
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, id),
            eq(transactions.userId, session.user.id),
          ),
        );
    }
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
