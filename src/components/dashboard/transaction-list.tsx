"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { DashboardItem } from "@/types";
import { TransactionItem } from "./transaction-item";

interface TransactionListProps {
  items: DashboardItem[];
  // onMarkAsPaid: (item: DashboardItem) => void;
  // onDelete: (item: DashboardItem) => void;
  // onEdit: (item: DashboardItem) => void;
}

export function TransactionList({
  items,
  // onMarkAsPaid,
  // onDelete,
  // onEdit,
}: TransactionListProps) {
  const [search, setSearch] = useState("");

  const filteredItems = items.filter((item) =>
    item.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      {/* <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
        <Input 
          placeholder="Buscar descrição..." 
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div> */}

      <div className="space-y-4 mt-8">
        <div className="grid grid-cols-[4fr_2fr_2fr_1fr] gap-4 px-6 text-sm text-zinc-500 mb-2">
          <div>Descrição</div>
          <div>Valor</div>
          <div>Data</div>
          <div>Parcelas</div>
        </div>
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            Nenhuma transação encontrada.
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <TransactionItem
              key={`${item.type}-${item.id}-${index}`}
              item={item}
              // onMarkAsPaid={onMarkAsPaid}
              // onDelete={onDelete}
              // onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}
