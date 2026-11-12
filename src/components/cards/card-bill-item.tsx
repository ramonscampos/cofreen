"use client";

import { format, parse } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  CARD_BILL_STATUS_LABEL,
  type CardBillStatus,
  type CardBillView,
} from "@/lib/cards/bill-view";
import type { CategoryGroup } from "@/lib/cards/category-groups";
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
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryGroup | null>(null);
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
          "grid min-h-16 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left transition-colors md:grid-cols-[auto_4fr_2fr_2fr_auto] md:gap-4 md:px-4 md:py-0",
          !isEmpty && "hover:bg-[#323238] cursor-pointer",
          isEmpty && "cursor-default",
        )}
      >
        <span
          className="col-start-1 row-span-2 row-start-1 h-3 w-3 rounded-full md:col-start-auto md:row-span-1 md:row-start-auto"
          style={{ backgroundColor: bill.card.color }}
          aria-hidden
        />
        <span className="col-start-2 row-start-1 flex items-center gap-3 overflow-hidden md:col-start-auto md:row-start-auto">
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
            "col-start-2 row-start-2 truncate font-bold tabular-nums md:col-start-auto md:row-start-auto",
            isEmpty ? "text-zinc-500 font-normal" : "text-[#f75a68]",
          )}
        >
          {isEmpty
            ? "Sem fatura neste mês"
            : `- ${formatCurrency(bill.amount)}`}
        </span>
        <span className="col-start-3 row-start-2 whitespace-nowrap text-right text-sm text-zinc-500 md:col-start-auto md:row-start-auto">
          Vence dia {dueDay}
        </span>
        <ChevronDown
          className={cn(
            "col-start-3 row-start-1 ml-auto h-4 w-4 text-zinc-500 transition-transform md:col-start-auto md:row-start-auto",
            expanded && "rotate-180",
            isEmpty && "invisible",
          )}
        />
      </button>

      {expanded && !isEmpty && (
        <div className="border-t border-zinc-700 p-4 space-y-6">
          <CategoryChart
            categories={bill.categories}
            color={bill.card.color}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <CardPurchaseList
            purchases={bill.purchases}
            highlight={selectedCategory?.members ?? null}
          />
        </div>
      )}
    </div>
  );
}
