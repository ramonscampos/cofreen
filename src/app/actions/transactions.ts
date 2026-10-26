"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { transactions } from "@/db/schema";

import { buildDeferral } from "@/lib/deferral";
import { getCurrentMonthRef, normalizeMonthRef } from "@/lib/finance-logic";
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

  if (item.kind !== "expense" || item.paid || item.deferredToMonthRef) {
    return { success: false, error: "Só contas em aberto podem ser adiadas" };
  }

  try {
    const safeMonthRef = normalizeMonthRef(monthRef, getCurrentMonthRef());
    const { original, copy } = buildDeferral(item, safeMonthRef);

    // Re-check on the server: a stale tab or double tap must not defer twice
    const existing =
      original.kind === "update"
        ? await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.id, original.id),
                eq(transactions.userId, userId),
              ),
            )
        : await db
            .select()
            .from(transactions)
            .where(
              and(
                eq(transactions.userId, userId),
                eq(transactions.templateId, original.values.templateId ?? ""),
                eq(transactions.monthRef, safeMonthRef),
              ),
            );
    if (original.kind === "update") {
      const [row] = existing;
      if (!row || row.paid || row.deferredToMonth) {
        return { success: false, error: "Essa conta já foi paga ou adiada" };
      }
    } else if (existing.length > 0) {
      return { success: false, error: "Essa conta já foi paga ou adiada" };
    }

    const originalId =
      original.kind === "update" ? original.id : crypto.randomUUID();
    const copyValues = {
      ...copy,
      amount: String(copy.amount),
      deferredFromId: originalId,
      userId,
    };
    // Both rows land together, or the bill would vanish from both months
    if (original.kind === "create") {
      await db.batch([
        db.insert(transactions).values({
          ...original.values,
          id: originalId,
          amount: String(original.values.amount),
          userId,
        }),
        db.insert(transactions).values(copyValues),
      ]);
    } else {
      await db.batch([
        db
          .update(transactions)
          .set({ deferredToMonth: copy.monthRef })
          .where(
            and(
              eq(transactions.id, originalId),
              eq(transactions.userId, userId),
            ),
          ),
        db.insert(transactions).values(copyValues),
      ]);
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

// Brings a deferred bill back; its copy (and any re-deferral of it) goes away
export async function undoDeferAction(
  transactionId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };
  const userId = session.user.id;

  try {
    const copies = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.deferredFromId, transactionId),
          eq(transactions.userId, userId),
        ),
      );
    // Never drop a recorded payment, or a re-deferral further down the chain
    if (copies.some((copy) => copy.paid || copy.deferredToMonth)) {
      return {
        success: false,
        error:
          "A conta no mês seguinte já foi paga ou adiada de novo. Desfaça lá primeiro.",
      };
    }

    await db.batch([
      db
        .delete(transactions)
        .where(
          and(
            eq(transactions.deferredFromId, transactionId),
            eq(transactions.userId, userId),
          ),
        ),
      db
        .update(transactions)
        .set({ deferredToMonth: null })
        .where(
          and(
            eq(transactions.id, transactionId),
            eq(transactions.userId, userId),
          ),
        ),
    ]);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
