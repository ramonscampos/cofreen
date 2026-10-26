import { dateInMonth } from "@/lib/dates";
import type { DashboardItem } from "@/types";

interface ItemForm {
  description: string;
  amount: number;
  day: number;
  monthRef: string;
}

export type ItemUpdate =
  | {
      target: "template";
      id: string;
      payload: {
        description: string;
        defaultAmount: string;
        dayOfMonth: number;
      };
    }
  | {
      target: "transaction";
      id: string;
      payload: {
        description: string;
        amount: string;
        monthRef?: string;
        transactionDate: string;
      };
    };

// A projected item (recurring bill, salary or installment plan) edits its template;
// its start month stays put so earlier months and installment numbers hold
export function buildItemUpdate(
  item: DashboardItem,
  form: ItemForm,
): ItemUpdate {
  if (item.originalTemplateId && !item.transactionId) {
    return {
      target: "template",
      id: item.originalTemplateId,
      payload: {
        description: form.description,
        defaultAmount: String(form.amount),
        dayOfMonth: form.day,
      },
    };
  }
  // Rows tied to a template or a deferral stay in their month, or the bill
  // would reappear unpaid there (and deferral links would point nowhere)
  const isLinked =
    !!item.originalTemplateId ||
    !!item.deferredToMonthRef ||
    !!item.isDeferredCopy;
  const monthRef = isLinked ? (item.monthRef ?? form.monthRef) : form.monthRef;
  return {
    target: "transaction",
    id: item.transactionId ?? item.id,
    payload: {
      description: form.description,
      amount: String(form.amount),
      ...(isLinked ? {} : { monthRef }),
      transactionDate: dateInMonth(monthRef, form.day),
    },
  };
}
