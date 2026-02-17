"use client";

import type { DashboardItem } from "@/types";
import { TransactionItem } from "./transaction-item";

interface TransactionListProps {
  items: DashboardItem[];
  onMarkAsPaid: (item: DashboardItem) => void;
  onDelete: (item: DashboardItem) => void;
  onEdit: (item: DashboardItem) => void;
}

export function TransactionList({
  items,
  onMarkAsPaid,
  onDelete,
  onEdit,
}: TransactionListProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-4 mt-8">
        <div className="grid grid-cols-[4fr_2fr_2fr_1fr] gap-4 px-6 text-sm text-zinc-500 mb-2">
          <div>Descrição</div>
          <div>Valor</div>
          <div>Data</div>
          <div className="text-right pr-4">Parcelas</div>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            Nenhuma transação encontrada.
          </div>
        ) : (
          items.map((item) => (
            <TransactionItem
              key={item.id}
              item={item}
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
