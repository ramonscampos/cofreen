"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import { splitPaidLast } from "@/lib/paid-last";
import type { DashboardItem } from "@/types";
import { PaidGroup } from "./paid-group";
import { TransactionItem } from "./transaction-item";

interface TransactionListProps {
  items: DashboardItem[];
  viewMode?: "mixed" | "grouped";
  onMarkAsPaid: (item: DashboardItem) => void;
  onDelete: (item: DashboardItem) => void;
  onEdit: (item: DashboardItem) => void;
  onDefer: (item: DashboardItem) => void;
  onUndoDefer: (item: DashboardItem) => void;
  // Owned by the parent so it survives month switches
  paidOpen: boolean;
  onPaidOpenChange: (open: boolean) => void;
}

export function TransactionList({
  items: initialItems,
  viewMode = "grouped",
  onMarkAsPaid,
  onDelete,
  onEdit,
  onDefer,
  onUndoDefer,
  paidOpen,
  onPaidOpenChange,
}: TransactionListProps) {
  const [openItemId, setOpenItemId] = useState<string | number | null>(null);
  const [sortBy, setSortBy] = useState<"day" | "amount">("day");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleToggle = (id: string | number) => {
    setOpenItemId((current) => (current === id ? null : id));
  };

  const handleSort = (field: "day" | "amount") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  const sortItems = (itemsList: DashboardItem[]) => {
    return [...itemsList].sort((a, b) => {
      let valA: number;
      let valB: number;

      if (sortBy === "day") {
        valA = a.day || 0;
        valB = b.day || 0;
      } else {
        // For amount, we use the display amount (considering installments)
        valA =
          a.installmentTotal && a.installmentTotal > 1
            ? a.amount / a.installmentTotal
            : a.amount;
        valB =
          b.installmentTotal && b.installmentTotal > 1
            ? b.amount / b.installmentTotal
            : b.amount;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedItems = sortItems(initialItems);
  const incomings =
    viewMode === "grouped"
      ? sortItems(initialItems.filter((i) => i.kind === "incoming"))
      : [];
  const expenses =
    viewMode === "grouped"
      ? sortItems(initialItems.filter((i) => i.kind === "expense"))
      : [];

  const renderItem = (item: DashboardItem) => (
    <TransactionItem
      key={item.id}
      item={item}
      isOpen={openItemId === item.id}
      onToggle={() => handleToggle(item.id)}
      onMarkAsPaid={onMarkAsPaid}
      onDelete={onDelete}
      onEdit={onEdit}
      onDefer={onDefer}
      onUndoDefer={onUndoDefer}
    />
  );

  // Paid items sit after every pending one, behind a quiet divider
  const renderPaidLast = (list: DashboardItem[]) => {
    const { pending, paid } = splitPaidLast(list);
    return (
      <>
        {pending.map(renderItem)}
        {paid.length > 0 && (
          <PaidGroup
            count={paid.length}
            open={paidOpen}
            onOpenChange={onPaidOpenChange}
          >
            {paid.map(renderItem)}
          </PaidGroup>
        )}
      </>
    );
  };

  const sortButtonClass =
    "flex min-h-11 min-w-11 items-center gap-1 transition-colors hover:text-zinc-300 md:min-h-0 md:min-w-0";

  return (
    <div className="space-y-4">
      <div className="space-y-4 mt-8">
        <div className="flex items-center gap-4 px-4 text-sm text-zinc-500 mb-2 select-none md:grid md:grid-cols-[4fr_2fr_2fr_1fr] md:px-6">
          <div className="hidden items-center gap-1 cursor-default md:flex">
            Descrição
          </div>
          <button
            type="button"
            className={sortButtonClass}
            onClick={() => handleSort("amount")}
          >
            Valor
            {sortBy === "amount" &&
              (sortOrder === "asc" ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              ))}
          </button>
          <button
            type="button"
            className={sortButtonClass}
            onClick={() => handleSort("day")}
          >
            Data
            {sortBy === "day" &&
              (sortOrder === "asc" ? (
                <ArrowUp size={14} />
              ) : (
                <ArrowDown size={14} />
              ))}
          </button>
          <div className="hidden text-right pr-4 md:block">Parcelas</div>
        </div>
        {initialItems.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            Nenhuma transação encontrada.
          </div>
        ) : viewMode === "grouped" ? (
          <>
            {incomings.map(renderItem)}

            {incomings.length > 0 && expenses.length > 0 && (
              <div className="border-t border-zinc-800 my-4" />
            )}

            {renderPaidLast(expenses)}
          </>
        ) : (
          renderPaidLast(sortedItems)
        )}
      </div>
    </div>
  );
}
