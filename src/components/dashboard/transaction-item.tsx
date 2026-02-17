import {
  CheckCircle2,
  ChevronDown,
  Pencil,
  Repeat,
  Trash2,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { DashboardItem } from "@/types";

interface TransactionItemProps {
  item: DashboardItem;
  onMarkAsPaid: (item: DashboardItem) => void;
  onDelete: (item: DashboardItem) => void;
  onEdit: (item: DashboardItem) => void;
}

export function TransactionItem({
  item,
  onMarkAsPaid,
  onDelete,
  onEdit,
}: TransactionItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpense = item.kind === "expense";
  const hasSubItems = item.cardTransactions && item.cardTransactions.length > 0;

  const displayAmount = 
    (item.installmentTotal && item.installmentTotal > 1) 
      ? item.amount / item.installmentTotal 
      : item.amount;

  const amount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(displayAmount);

  return (
    <div className="relative w-full mb-2">
      <div className="absolute inset-y-0 right-0 flex w-48 h-16">
        {!item.cardId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            className="flex-1 bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors rounded-l-none rounded-r-lg z-3 -mr-4 h-16.5"
          >
            <Trash2 className="h-5 w-5 text-white  ml-3" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
            setIsOpen(false);
          }}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors rounded-r-lg z-2 -mr-4 h-16.5"
        >
          <Pencil className="h-5 w-5 text-white  ml-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsPaid(item);
            setIsOpen(false);
          }}
          className={cn(
            "flex-1 flex items-center justify-center transition-colors rounded-r-lg h-16.5",
            item.paid
              ? "bg-yellow-600 hover:bg-yellow-700"
              : "bg-[#00875f] hover:bg-[#00875f]/90",
          )}
        >
          {item.paid ? (
            <Undo2 className="h-5 w-5 text-white  ml-3" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-white  ml-3" />
          )}
        </button>
      </div>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative bg-[#29292e] rounded-md transition-all duration-300 ease-in-out cursor-pointer z-10 overflow-hidden border border-transparent",
          isOpen ? "w-[calc(100%-11rem)]" : "w-full",
        )}
        style={{
          borderLeft: item.cardColor
            ? `10px solid ${item.cardColor}`
            : undefined,
        }}
      >
        <div className="min-h-16 items-center px-4 gap-4 grid grid-cols-[4fr_2fr_2fr_1fr] w-full">
          <div className="text-zinc-300 font-normal text-base flex items-center gap-3 overflow-hidden">
            {hasSubItems && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1 hover:bg-zinc-700 rounded-full transition-colors"
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>
            )}
            <span className={cn("truncate")}>{item.description}</span>
          </div>

          <div
            className={cn(
              "font-bold truncate",
              isExpense ? "text-[#f75a68]" : "text-[#00b37e]",
            )}
          >
            {isExpense ? "- " : ""}
            {amount}
          </div>

          <div className="text-zinc-500 truncate">
            {item.day ? String(item.day).padStart(2, "0") : "-"}
          </div>

          <div className="flex items-center justify-end pr-4 text-zinc-500">
            {item.isRecurring && <Repeat className="h-4 w-4 rotate-90" />}

            {!item.isRecurring &&
              item.installmentTotal &&
              item.installmentTotal > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400 whitespace-nowrap">
                    {String(item.installmentCurrent).padStart(2, "0")}/
                    {String(item.installmentTotal).padStart(2, "0")}
                  </span>
                  <div className="relative h-4 w-4 shrink-0">
                    <svg
                      viewBox="0 0 36 36"
                      className="h-full w-full -rotate-90"
                    >
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

        {/* Expanded View for Card Transactions */}
        {isExpanded && hasSubItems && (
          <div className="border-t border-zinc-700 py-4 px-4 space-y-2">
            {item.cardTransactions?.map((sub) => (
              <div
                key={sub.id}
                className="grid grid-cols-[4fr_2fr_2fr_1fr] gap-4 text-sm text-zinc-400"
              >
                <span className="truncate pl-8">{sub.description}</span>
                <span>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(
                    sub.installment_total && sub.installment_total > 1
                      ? sub.amount / sub.installment_total
                      : sub.amount
                  )}
                </span>
                <span>
                  {sub.installment_total && sub.installment_total > 1
                    ? `${sub.installment_current}/${sub.installment_total}`
                    : "-"}
                </span>
                <span></span>
              </div>
            ))}
            {item.cardTransactions?.length === 0 && (
              <p className="text-sm text-zinc-500 pl-8">Nenhuma transação.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
