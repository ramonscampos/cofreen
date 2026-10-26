import {
  CalendarArrowUp,
  CheckCircle2,
  Pencil,
  Repeat,
  Trash2,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
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
  onDefer: (item: DashboardItem) => void;
  onUndoDefer: (item: DashboardItem) => void;
}

interface RowAction {
  key: string;
  label: string;
  icon: ReactNode;
  className: string;
  run: () => void;
}

const ACTION_WIDTH_REM = 4;

export function TransactionItem({
  item,
  isOpen,
  onToggle,
  onMarkAsPaid,
  onDelete,
  onEdit,
  onDefer,
  onUndoDefer,
}: TransactionItemProps) {
  const isExpense = item.kind === "expense";
  // Only expenses get paid off; incomes have no paid state to show
  const isPaidExpense = isExpense && item.paid;
  const isDeferred = !!item.deferredToMonthRef;

  const displayAmount = getMonthlyAmount(item.amount, item.installmentTotal);

  const amount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(displayAmount);

  const close = (run: () => void) => () => {
    run();
    onToggle();
  };
  const iconClass = "h-5 w-5 text-white";
  const actions: RowAction[] = isDeferred
    ? [
        {
          key: "undo-defer",
          label: "Desfazer adiamento",
          icon: <Undo2 className={iconClass} />,
          className: "bg-yellow-600 hover:bg-yellow-700",
          run: close(() => onUndoDefer(item)),
        },
      ]
    : [
        // A deferred copy is managed from the month it came from
        ...(item.isDeferredCopy
          ? []
          : [
              {
                key: "delete",
                label: "Excluir",
                icon: <Trash2 className={iconClass} />,
                className: "bg-red-600 hover:bg-red-700",
                run: () => onDelete(item),
              },
              {
                key: "edit",
                label: "Editar",
                icon: <Pencil className={iconClass} />,
                className: "bg-zinc-700 hover:bg-zinc-600",
                run: close(() => onEdit(item)),
              },
            ]),
        ...(isExpense && !item.paid
          ? [
              {
                key: "defer",
                label: "Adiar pro próximo mês",
                icon: <CalendarArrowUp className={iconClass} />,
                className: "bg-sky-700 hover:bg-sky-600",
                run: close(() => onDefer(item)),
              },
            ]
          : []),
        ...(isExpense
          ? [
              {
                key: "pay",
                label: item.paid ? "Desmarcar pago" : "Marcar como pago",
                icon: item.paid ? (
                  <Undo2 className={iconClass} />
                ) : (
                  <CheckCircle2 className={iconClass} />
                ),
                className: item.paid
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : "bg-[#00875f] hover:bg-[#00875f]/90",
                run: close(() => onMarkAsPaid(item)),
              },
            ]
          : []),
      ];
  const actionsWidth = actions.length * ACTION_WIDTH_REM;

  return (
    <div className="relative w-full mb-2">
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex h-16 gap-1 transition-opacity duration-300",
          !isOpen && "opacity-0 pointer-events-none",
        )}
        style={{ width: `${actionsWidth}rem` }}
      >
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            title={action.label}
            aria-label={action.label}
            onClick={(e) => {
              e.stopPropagation();
              action.run();
            }}
            className={cn(
              "flex-1 flex items-center justify-center rounded-lg transition-colors",
              action.className,
            )}
          >
            {action.icon}
          </button>
        ))}
      </div>

      <div
        onClick={() => onToggle()}
        className={cn(
          "relative rounded-md transition-all duration-300 ease-in-out cursor-pointer z-10 overflow-hidden border border-transparent",
          isPaidExpense || isDeferred
            ? "bg-[#18181b] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] "
            : "bg-[#29292e] hover:bg-[#323238]",
        )}
        style={{
          width: isOpen ? `calc(100% - ${actionsWidth + 0.5}rem)` : "100%",
        }}
      >
        <div
          className={cn(
            "min-h-16 items-center px-4 gap-4 grid grid-cols-[4fr_2fr_2fr_1fr] w-full transition-all",
            (isPaidExpense || isDeferred) && "opacity-50 grayscale",
          )}
        >
          <div className="text-zinc-300 font-normal text-base flex items-center gap-3 overflow-hidden">
            <span className={cn("truncate")}>{item.description}</span>
            {item.deferLabel && (
              <span className="shrink-0 rounded bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
                {item.deferLabel}
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
