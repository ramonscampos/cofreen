"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { Button } from "@/components/ui/button";
import { mergeTransactionsAndTemplates } from "@/lib/finance-logic";
import type {
  Card,
  CardTransaction,
  DashboardItem,
  RecurringTemplate,
  Transaction,
} from "@/types";

interface DashboardViewProps {
  user: any;
  initialMonthRef: string;
  initialTransactions: Transaction[];
  initialTemplates: RecurringTemplate[];
  initialCards: Card[];
  initialCardTransactions: CardTransaction[];
}

import { ChevronRight } from "lucide-react";
import { NewExpenseModal } from "@/components/dashboard/new-expense-modal";
import { NewIncomeModal } from "@/components/dashboard/new-income-modal";
// ... imports
import { TransactionForm } from "@/components/dashboard/transaction-form";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type { Kind } from "@/types";

// ... inside DashboardView component body

export function DashboardView({
  user,
  initialMonthRef,
  initialTransactions,
  initialTemplates,
  initialCards,
  initialCardTransactions,
}: DashboardViewProps) {
  const router = useRouter();
  const supabase = createClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<Kind>("incoming");
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);

  const items = useMemo(() => {
    return mergeTransactionsAndTemplates(
      initialTransactions,
      initialTemplates,
      initialMonthRef,
    );
  }, [initialTransactions, initialTemplates, initialMonthRef]);

  const openNewModal = (kind: Kind) => {
    setEditingItem(null);
    setModalKind(kind);
    setModalOpen(true);
  };

  return (
    <div className="space-y-8 relative z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            className="bg-[#00875f] hover:bg-[#00875f]/90 text-white font-bold h-12 px-6"
            onClick={() => openNewModal("incoming")}
          >
            Nova entrada
          </Button>
          <Button
            type="button"
            className="bg-[#f75a68] hover:bg-[#f75a68]/90 text-white font-bold h-12 px-6"
            onClick={() => openNewModal("expense")}
          >
            Nova saída
          </Button>
        </div>

        <button
          type="button"
          className="text-white font-bold text-sm hover:underline flex items-center gap-1 transition-colors"
          onClick={() => router.push("/cards")}
        >
          Listar cartões cadastrados
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid gap-2">
        <h2 className="sr-only">Transações</h2>
        <TransactionList items={items} />
      </div>

      {/* Edit Modal (Legacy/Shared) */}
      <Modal
        isOpen={modalOpen && !!editingItem}
        onClose={() => setModalOpen(false)}
        title="Editar Transação"
      >
        <TransactionForm
          onClose={() => setModalOpen(false)}
          kind={modalKind}
          monthRef={initialMonthRef}
          userId={user.id}
          initialData={editingItem}
          userCards={initialCards}
        />
      </Modal>

      {/* New Income Modal (Independent) */}
      <NewIncomeModal
        isOpen={modalOpen && !editingItem && modalKind === "incoming"}
        onClose={() => setModalOpen(false)}
        userId={user.id}
        defaultMonthRef={initialMonthRef}
      />

      {/* New Expense Modal (Independent) */}
      <NewExpenseModal
        isOpen={modalOpen && !editingItem && modalKind === "expense"}
        onClose={() => setModalOpen(false)}
        userId={user.id}
        monthRef={initialMonthRef}
        userCards={initialCards}
      />
    </div>
  );
}
