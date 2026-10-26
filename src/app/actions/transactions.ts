"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions } from "@/db/schema";

import { buildDeferral } from "@/lib/deferral";
import type {
  ActionResult,
  CreateTransactionPayload,
  DashboardItem,
} from "@/types";

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

// Pushes a bill to next month: flags it here and adds a linked copy there
export async function deferBillAction(
  item: DashboardItem,
  monthRef: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };
  const userId = session.user.id;

  try {
    const { original, copy } = buildDeferral(item, monthRef);
    let originalId: string;
    if (original.kind === "create") {
      const [row] = await db
        .insert(transactions)
        .values({
          ...original.values,
          amount: String(original.values.amount),
          userId,
        })
        .returning({ id: transactions.id });
      originalId = row.id;
    } else {
      await db
        .update(transactions)
        .set({ deferredToMonth: copy.monthRef })
        .where(
          and(
            eq(transactions.id, original.id),
            eq(transactions.userId, userId),
          ),
        );
      originalId = original.id;
    }
    await db.insert(transactions).values({
      ...copy,
      amount: String(copy.amount),
      deferredFromId: originalId,
      userId,
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

// Brings a deferred bill back; its copy (and any re-deferral of it) goes away
export async function undoDeferAction(
  transactionId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };
  const userId = session.user.id;

  try {
    await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.deferredFromId, transactionId),
          eq(transactions.userId, userId),
        ),
      );
    await db
      .update(transactions)
      .set({ deferredToMonth: null })
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId),
        ),
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
