import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Pencil, Repeat, Trash2, Undo2 } from "lucide-react";
import { getMonthlyAmount } from "@/lib/finance-logic";
import { cn } from "@/lib/utils";
import type { DashboardItem } from "@/types";

interface TransactionItemProps {
  item: DashboardItem;
  isOpen: boolean;
  onToggle: () => void;
  onMarkAsPaid: (item: DashboardItem) => void;
  onDelete: (item: DashboardItem) => void;
  onEdit: (item: DashboardItem) => void;
}

export function TransactionItem({
  item,
  isOpen,
  onToggle,
  onMarkAsPaid,
  onDelete,
  onEdit,
}: TransactionItemProps) {
  const isExpense = item.kind === "expense";
  // Overdue copies are only paid here; editing happens in their own month
  const overdueMonth = item.overdueFromMonthRef
    ? format(parse(item.overdueFromMonthRef, "yyyy-MM", new Date()), "MMM", {
        locale: ptBR,
      })
    : null;

  const displayAmount = getMonthlyAmount(item.amount, item.installmentTotal);

  const amount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(displayAmount);

  return (
    <div className="relative w-full mb-2">
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex h-16 transition-opacity duration-300",
          overdueMonth ? "w-20" : "w-48",
          !isOpen && "opacity-0 pointer-events-none",
        )}
      >
        {!overdueMonth && (
          <>
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
                onToggle(); // Close on action
              }}
              className={cn(
                "flex-1 bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors rounded-r-lg z-2  h-16.5",
                isExpense && "-mr-4",
              )}
            >
              <Pencil className="h-5 w-5 text-white  ml-3" />
            </button>
          </>
        )}
        {isExpense && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsPaid(item);
              onToggle(); // Close on action
            }}
            className={cn(
              "flex-1 flex items-center justify-center transition-colors rounded-r-lg h-16.5 z-1",
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
        )}
      </div>

      <div
        onClick={() => onToggle()}
        className={cn(
          "relative rounded-md transition-all duration-300 ease-in-out cursor-pointer z-10 overflow-hidden border border-transparent",
          item.paid
            ? "bg-[#18181b] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] "
            : "bg-[#29292e] hover:bg-[#323238]",
          isOpen
            ? overdueMonth
              ? "w-[calc(100%-4rem)]"
              : "w-[calc(100%-11rem)]"
            : "w-full",
        )}
      >
        <div
          className={cn(
            "min-h-16 items-center px-4 gap-4 grid grid-cols-[4fr_2fr_2fr_1fr] w-full transition-all",
            item.paid && "opacity-50 grayscale",
          )}
        >
          <div className="text-zinc-300 font-normal text-base flex items-center gap-3 overflow-hidden">
            <span className={cn("truncate")}>{item.description}</span>
            {overdueMonth && (
              <span className="shrink-0 rounded bg-[#f75a68]/15 px-2 py-0.5 text-xs text-[#f75a68]">
                Atrasada · {overdueMonth}
              </span>
            )}
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
                      <title>Progresso de Parcelas</title>
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
                        strokeDasharray={`${((item.installmentCurrent || 0) / item.installmentTotal) * 100}, 100`}
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
    </div>
  );
}
