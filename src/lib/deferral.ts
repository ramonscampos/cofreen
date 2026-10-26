import { dateInMonth } from "@/lib/dates";
import { getNextMonthRef } from "@/lib/finance-logic";
import type { CreateTransactionPayload, DashboardItem } from "@/types";

export interface Deferral {
  // The bill stays in its month, flagged as moved
  original:
    | { kind: "create"; values: CreateTransactionPayload }
    | { kind: "update"; id: string };
  // A one-off copy in next month, linked to the original once it has an id
  copy: Omit<CreateTransactionPayload, "deferredFromId">;
}

export function buildDeferral(item: DashboardItem, monthRef: string): Deferral {
  const nextMonthRef = getNextMonthRef(monthRef);
  const installment = {
    installmentCurrent: item.installmentCurrent ?? null,
    installmentTotal: item.installmentTotal ?? null,
  };

  return {
    original: item.transactionId
      ? { kind: "update", id: item.transactionId }
      : {
          kind: "create",
          values: {
            description: item.description,
            amount: String(item.amount),
            kind: item.kind,
            monthRef,
            paid: false,
            templateId: item.originalTemplateId ?? item.id,
            isRecurring: item.isRecurring,
            deferredToMonth: nextMonthRef,
            transactionDate: dateInMonth(monthRef, item.day),
            ...installment,
          },
        },
    copy: {
      description: item.description,
      amount: String(item.amount),
      kind: item.kind,
      monthRef: nextMonthRef,
      paid: false,
      isRecurring: false,
      transactionDate: dateInMonth(nextMonthRef, item.day),
      ...installment,
    },
  };
}
