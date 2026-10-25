"use client";

import { format, parse } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  CARD_BILL_STATUS_LABEL,
  type CardBillStatus,
  type CardBillView,
} from "@/lib/cards/bill-view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CardPurchaseList } from "./card-purchase-list";
import { CategoryChart } from "./category-chart";

const STATUS_STYLE: Record<Exclude<CardBillStatus, "empty">, string> = {
  paid: "bg-[#00b37e]/15 text-[#00b37e]",
  paid_inferred: "bg-[#00b37e]/15 text-[#00b37e]",
  partial: "bg-amber-500/15 text-amber-400",
  closed: "bg-amber-500/15 text-amber-400",
  open: "bg-sky-500/15 text-sky-300",
  forecast: "border border-dashed border-zinc-600 text-zinc-400",
};

interface CardBillItemProps {
  bill: CardBillView;
}

export function CardBillItem({ bill }: CardBillItemProps) {
  const [expanded, setExpanded] = useState(false);
  const isEmpty = bill.status === "empty";
  const dueDay = bill.dueDate
    ? format(parse(bill.dueDate, "yyyy-MM-dd", new Date()), "dd")
    : String(bill.card.dueDay).padStart(2, "0");

  return (
    <div className="rounded-md bg-[#29292e] overflow-hidden">
      <button
        type="button"
        disabled={isEmpty}
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className={cn(
          "w-full min-h-16 px-4 grid grid-cols-[auto_4fr_2fr_2fr_auto] items-center gap-4 text-left transition-colors",
          !isEmpty && "hover:bg-[#323238] cursor-pointer",
          isEmpty && "cursor-default",
        )}
      >
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: bill.card.color }}
          aria-hidden
        />
        <span className="flex items-center gap-3 overflow-hidden">
          <span className="truncate text-zinc-200">{bill.card.bankName}</span>
          {!isEmpty && (
            <span
              className={cn(
                "shrink-0 rounded px-2 py-0.5 text-xs",
                STATUS_STYLE[bill.status as Exclude<CardBillStatus, "empty">],
              )}
            >
              {
                CARD_BILL_STATUS_LABEL[
                  bill.status as Exclude<CardBillStatus, "empty">
                ]
              }
            </span>
          )}
        </span>
        <span
          className={cn(
            "font-bold tabular-nums",
            isEmpty ? "text-zinc-500 font-normal" : "text-[#f75a68]",
          )}
        >
          {isEmpty
            ? "Sem fatura neste mês"
            : `- ${formatCurrency(bill.amount)}`}
        </span>
        <span className="text-zinc-500 text-sm">Vence dia {dueDay}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-zinc-500 transition-transform",
            expanded && "rotate-180",
            isEmpty && "invisible",
          )}
        />
      </button>

      {expanded && !isEmpty && (
        <div className="border-t border-zinc-700 p-4 space-y-6">
          <CategoryChart categories={bill.categories} color={bill.card.color} />
          <CardPurchaseList purchases={bill.purchases} />
        </div>
      )}
    </div>
  );
}
