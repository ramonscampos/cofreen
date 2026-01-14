"use client";

import { Pencil, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardItem } from "@/types";

interface TransactionItemProps {
  item: DashboardItem;
  // onMarkAsPaid: (item: DashboardItem) => void;
  // onDelete: (item: DashboardItem) => void;
  // onEdit: (item: DashboardItem) => void;
}

export function TransactionItem({ item }: TransactionItemProps) {
  const isExpense = item.kind === "expense";
  const isExpected = item.type === "expected";

  const amount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(item.amount);

  return (
    <div className="bg-[#29292e] rounded-md p-4 flex items-center justify-between hover:bg-[#323238] transition-colors group relative h-16 cursor-pointer">
      <div className="grid grid-cols-[4fr_2fr_2fr_1fr] w-full items-center gap-4">
        <div className="text-zinc-300 font-normal text-base flex items-center gap-3">
          <span className={isExpected ? "text-zinc-500 italic" : ""}>
            {item.description}
          </span>
        </div>

        <div
          className={cn(
            "font-bold",
            isExpense ? "text-[#f75a68]" : "text-[#00b37e]",
            isExpected && "opacity-50",
          )}
        >
          {isExpense ? "- " : ""}
          {amount}
        </div>

        <div className="text-zinc-500">
          {item.day ? String(item.day).padStart(2, "0") : "-"}
        </div>

        <div className="flex items-center justify-end pr-4 text-zinc-500">
          {item.isRecurring && <Repeat className="h-4 w-4 rotate-90" />}

          {!item.isRecurring &&
            item.installmentTotal &&
            item.installmentTotal > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">
                  {String(item.installmentCurrent).padStart(2, "0")}/
                  {String(item.installmentTotal).padStart(2, "0")}
                </span>
                <div className="relative h-4 w-4">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                    <title>Recorrente</title>
                    <path
                      className="text-zinc-700"
                      d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="text-[#00b37e]"
                      strokeDasharray={`${(item.installmentCurrent! / item.installmentTotal!) * 100}, 100`}
                      d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                  </svg>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
