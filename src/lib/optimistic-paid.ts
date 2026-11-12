import type { DashboardItem } from "@/types";
import type { MonthData } from "./month-data";

type MonthTransaction = MonthData["transactions"][number];

const OPTIMISTIC_PREFIX = "optimistic-";

export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX);
}

// A recurring/installment template that has no transaction in this month yet
export function isTemplateProjection(item: DashboardItem): boolean {
  return !!item.originalTemplateId && !item.transactionId && !item.paid;
}

const optimisticIdFor = (templateId: string) =>
  `${OPTIMISTIC_PREFIX}${templateId}`;

// Shows the toggled paid state before the server answers. A projected template
// becomes a paid transaction, mirroring what the server will create.
export function applyOptimisticPaid(
  data: MonthData,
  item: DashboardItem,
  monthRef: string,
): MonthData {
  if (isTemplateProjection(item)) {
    const templateId = item.originalTemplateId ?? item.id;
    const template = data.templates.find((t) => t.id === templateId);
    if (!template) return data;

    const day = String(item.day ?? template.dayOfMonth).padStart(2, "0");
    const created: MonthTransaction = {
      id: optimisticIdFor(templateId),
      userId: template.userId,
      kind: item.kind,
      monthRef,
      description: item.description,
      amount: String(item.amount),
      paid: true,
      isRecurring: item.isRecurring,
      templateId,
      cardId: null,
      installmentCurrent: item.installmentCurrent ?? null,
      installmentTotal: item.installmentTotal ?? null,
      transactionDate: `${monthRef}-${day} 12:00:00+00`,
      deferredToMonth: null,
      deferredFromId: null,
      createdAt: `${monthRef}-${day} 12:00:00+00`,
    };
    return { ...data, transactions: [...data.transactions, created] };
  }

  const transactionId = item.transactionId ?? item.id;
  return {
    ...data,
    transactions: data.transactions.map((t) =>
      t.id === transactionId ? { ...t, paid: !item.paid } : t,
    ),
  };
}

// Undoes applyOptimisticPaid for that one item only, so changes made to other
// items while the request was in flight are kept
export function revertOptimisticPaid(
  data: MonthData,
  item: DashboardItem,
): MonthData {
  if (isTemplateProjection(item)) {
    const id = optimisticIdFor(item.originalTemplateId ?? item.id);
    return {
      ...data,
      transactions: data.transactions.filter((t) => t.id !== id),
    };
  }

  const transactionId = item.transactionId ?? item.id;
  return {
    ...data,
    transactions: data.transactions.map((t) =>
      t.id === transactionId ? { ...t, paid: item.paid } : t,
    ),
  };
}
