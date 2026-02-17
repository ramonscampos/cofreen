"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { Button } from "@/components/ui/button";
import { triggerTransactionUpdate } from "@/lib/events";
import { mergeTransactionsAndTemplates } from "@/lib/finance-logic";
import { createClient } from "@/lib/supabase/client";
import type {
  Card,
  CardTransaction,
  DashboardItem,
  Kind,
  RecurringTemplate,
  Transaction,
  User,
} from "@/types";

interface DashboardViewProps {
  user: User;
  initialMonthRef: string;
  initialTransactions: Transaction[];
  initialTemplates: RecurringTemplate[];
  initialCards: Card[];
  initialCardTransactions: CardTransaction[];
}

import { ChevronRight } from "lucide-react";
import { EditBillModal } from "@/components/dashboard/edit-bill-modal";
import { ExpenseModal } from "@/components/dashboard/expense-modal";
import { IncomeModal } from "@/components/dashboard/income-modal";

// ... existing imports

export function DashboardView({
  user,
  initialMonthRef,
  initialTransactions,
  initialTemplates,
  initialCards,
  initialCardTransactions,
}: DashboardViewProps) {
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<Kind>("incoming");
  const [editingItem, setEditingItem] = useState<DashboardItem | null>(null);

  const [billModalOpen, setBillModalOpen] = useState(false);
  const [editingBillItem, setEditingBillItem] = useState<DashboardItem | null>(
    null,
  );

  const items = useMemo(() => {
    return mergeTransactionsAndTemplates(
      initialTransactions,
      initialTemplates,
      initialMonthRef,
      initialCards,
      initialCardTransactions,
    );
  }, [
    initialTransactions,
    initialTemplates,
    initialMonthRef,
    initialCards,
    initialCardTransactions,
  ]);

  console.log("DashboardView Render:", {
    monthRef: initialMonthRef,
    cardsCount: initialCards.length,
    cardTransCount: initialCardTransactions.length,
    itemsCount: items.length,
    cards: initialCards,
  });

  const openNewModal = (kind: Kind) => {
    setEditingItem(null);
    setModalKind(kind);
    setModalOpen(true);
  };

  /* Handlers */
  const supabase = createClient();

  const handleEdit = (item: DashboardItem) => {
    // Check if it's a Card Bill (Virtual or Manual)
    if (item.cardId) {
       setEditingBillItem(item);
       setBillModalOpen(true);
       return;
    }

    setEditingItem(item);
    setModalKind(item.kind);
    setModalOpen(true);
  };

  const handleDelete = async (item: DashboardItem) => {
    if (!confirm(`Tem certeza que deseja excluir?`)) return;

    let error = null;
    if (item.isRecurring || (item.originalTemplateId && item.originalTemplateId === item.id)) {
      const { error: err } = await supabase
        .from("recurring_templates")
        .delete()
        .eq("id", item.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from("transactions")
        .delete()
        .eq("id", item.id);
      error = err;
    }

    if (!error) {
      toast.success("Item removido com sucesso");
      triggerTransactionUpdate();
      router.refresh();
    } else {
      toast.error("Erro ao remover item");
    }
  };

  const handleMarkAsPaid = async (item: DashboardItem) => {
    if (item.id.toString().startsWith("virtual-card-")) {
      // It's a virtual card bill being paid. Create it as a Paid Transaction.
      const { error } = await supabase.from("transactions").insert({
        description: item.description,
        amount: item.amount,
        kind: "expense", // Bill is expense
        month_ref: initialMonthRef, // Ensure we use the current view month
        paid: true,
        card_id: item.cardId,
        user_id: user.id,
        is_recurring: false,
      });

      if (!error) {
        toast.success("Fatura paga criada!");
        triggerTransactionUpdate();
        router.refresh();
      } else {
        toast.error("Erro ao pagar fatura");
      }
      return;
    }

    if (item.isRecurring && !item.paid) {
      // Logic for templated items?
    }

    const { error } = await supabase
      .from("transactions")
      .update({ paid: !item.paid })
      .eq("id", item.id);

    if (!error) {
      toast.success(item.paid ? "Marcado como não pago" : "Marcado como pago");
      triggerTransactionUpdate();
      router.refresh();
    } else {
      toast.error("Erro ao atualizar status");
    }
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
            Nova despesa
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
        <TransactionList
          items={items}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onMarkAsPaid={handleMarkAsPaid}
        />
      </div>

      {/* Income Modal - Handles Edit & Create */}
      <IncomeModal
        isOpen={modalOpen && modalKind === "incoming"}
        onClose={() => setModalOpen(false)}
        userId={user.id}
        defaultMonthRef={initialMonthRef}
        initialData={editingItem}
      />

      {/* Expense Modal - Handles Edit & Create */}
      <ExpenseModal
        isOpen={modalOpen && modalKind === "expense"}
        onClose={() => setModalOpen(false)}
        userId={user.id}
        monthRef={initialMonthRef}
        userCards={initialCards}
        initialData={editingItem}
      />
      
      <EditBillModal
        isOpen={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        item={editingBillItem}
        userId={user.id}
        monthRef={initialMonthRef}
      />
    </div>
  );
}
