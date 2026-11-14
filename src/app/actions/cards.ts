"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { cardBillPayments, cards } from "@/db/schema";
import {
  type BillPaymentInput,
  validateBillPayment,
} from "@/lib/cards/bill-payment";

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

function failure(err: unknown): ActionResult {
  return {
    success: false,
    error: err instanceof Error ? err.message : "Erro desconhecido",
  };
}

// Registers (or replaces) the manual payment of one card bill; it creates no expense
export async function markCardBillPaidAction(
  input: BillPaymentInput,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };
  const userId = session.user.id;

  const invalid = validateBillPayment(input);
  if (invalid) return { success: false, error: invalid };

  try {
    const [card] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.id, input.cardId), eq(cards.userId, userId)));
    if (!card) return { success: false, error: "Cartão não encontrado" };

    const values = { amount: String(input.amount), paidOn: input.paidOn };
    await db
      .insert(cardBillPayments)
      .values({
        userId,
        cardId: input.cardId,
        monthRef: input.monthRef,
        ...values,
      })
      .onConflictDoUpdate({
        target: [cardBillPayments.cardId, cardBillPayments.monthRef],
        set: values,
      });
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return failure(err);
  }
}

export async function undoCardBillPaymentAction(
  cardId: string,
  monthRef: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db
      .delete(cardBillPayments)
      .where(
        and(
          eq(cardBillPayments.userId, session.user.id),
          eq(cardBillPayments.cardId, cardId),
          eq(cardBillPayments.monthRef, monthRef),
        ),
      );
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return failure(err);
  }
}
