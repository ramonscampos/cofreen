"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useState } from "react";
import type { DashboardItem } from "@/types";
import { TransactionItem } from "./transaction-item";

interface TransactionListProps {
  items: DashboardItem[];
  viewMode?: "mixed" | "grouped";
  onMarkAsPaid: (item: DashboardItem) => void;
  onDelete: (item: DashboardItem) => void;
  onEdit: (item: DashboardItem) => void;
}

export function TransactionList({
  items: initialItems,
  viewMode = "mixed",
  onMarkAsPaid,
  onDelete,
  onEdit,
}: TransactionListProps) {
  const [openItemId, setOpenItemId] = useState<string | number | null>(null);
  const [sortBy, setSortBy] = useState<"day" | "amount">("day");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleToggle = (id: string | number) => {
    setOpenItemId(current => current === id ? null : id);
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
        valA = a.installmentTotal && a.installmentTotal > 1 ? a.amount / a.installmentTotal : a.amount;
        valB = b.installmentTotal && b.installmentTotal > 1 ? b.amount / b.installmentTotal : b.amount;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedItems = sortItems(initialItems);
  const incomings = viewMode === "grouped" ? sortItems(initialItems.filter(i => i.kind === "incoming")) : [];
  const expenses = viewMode === "grouped" ? sortItems(initialItems.filter(i => i.kind === "expense")) : [];

  return (
    <div className="space-y-4">
      <div className="space-y-4 mt-8">
        <div className="grid grid-cols-[4fr_2fr_2fr_1fr] gap-4 px-6 text-sm text-zinc-500 mb-2 select-none">
          <div className="flex items-center gap-1 cursor-default">Descrição</div>
          <div 
            className="flex items-center gap-1 cursor-pointer hover:text-zinc-300 transition-colors"
            onClick={() => handleSort("amount")}
          >
            Valor
            {sortBy === "amount" && (
              sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
            )}
          </div>
          <div 
            className="flex items-center gap-1 cursor-pointer hover:text-zinc-300 transition-colors"
            onClick={() => handleSort("day")}
          >
            Data
            {sortBy === "day" && (
              sortOrder === "asc" ? <ArrowUp size={14} /> : <ArrowDown size={14} />
            )}
          </div>
          <div className="text-right pr-4">Parcelas</div>
        </div>
        {initialItems.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            Nenhuma transação encontrada.
          </div>
        ) : viewMode === "grouped" ? (
          <>
            {incomings.map((item) => (
              <TransactionItem
                key={item.id}
                item={item}
                isOpen={openItemId === item.id}
                onToggle={() => handleToggle(item.id)}
                onMarkAsPaid={onMarkAsPaid}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
            
            {incomings.length > 0 && expenses.length > 0 && (
              <div className="border-t border-zinc-800 my-4" />
            )}

            {expenses.map((item) => (
              <TransactionItem
                key={item.id}
                item={item}
                isOpen={openItemId === item.id}
                onToggle={() => handleToggle(item.id)}
                onMarkAsPaid={onMarkAsPaid}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </>
        ) : (
          sortedItems.map((item) => (
            <TransactionItem
              key={item.id}
              item={item}
              isOpen={openItemId === item.id}
              onToggle={() => handleToggle(item.id)}
              onMarkAsPaid={onMarkAsPaid}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}
