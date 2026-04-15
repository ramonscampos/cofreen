"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db";
import { recurringTemplates } from "@/db/schema";

import type { ActionResult, CreateTemplatePayload } from "@/types";

export async function createTemplateAction(
  payload: CreateTemplatePayload,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db.insert(recurringTemplates).values({
      ...payload,
      userId: session.user.id,
    });
    revalidatePath("/templates");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

export async function updateTemplateAction(
  id: string,
  payload: Partial<CreateTemplatePayload>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db
      .update(recurringTemplates)
      .set(payload)
      .where(
        and(
          eq(recurringTemplates.id, id),
          eq(recurringTemplates.userId, session.user.id),
        ),
      );
    revalidatePath("/templates");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Não autenticado" };

  try {
    await db
      .delete(recurringTemplates)
      .where(
        and(
          eq(recurringTemplates.id, id),
          eq(recurringTemplates.userId, session.user.id),
        ),
      );
    revalidatePath("/templates");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
