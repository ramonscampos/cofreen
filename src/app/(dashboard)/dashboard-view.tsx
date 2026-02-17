"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { Button } from "@/components/ui/button";
import { triggerTransactionUpdate } from "@/lib/events";
import { mergeTransactionsAndTemplates } from "@/lib/finance-logic";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
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

import { ChevronRight, Layers, List } from "lucide-react";
import { EditBillModal } from "@/components/dashboard/edit-bill-modal";
import { ExpenseModal } from "@/components/dashboard/expense-modal";
import { IncomeModal } from "@/components/dashboard/income-modal";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";

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

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DashboardItem | null>(null);

  const [viewMode, setViewMode] = useState<"mixed" | "grouped">("mixed");

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

  const handleDelete = (item: DashboardItem) => {
    setItemToDelete(item);
    setConfirmationOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const item = itemToDelete;

    let error = null;
    if (
      item.isRecurring ||
      (item.originalTemplateId && item.originalTemplateId === item.id)
    ) {
      const { error: err } = await supabase
        .from("recurring_templates")
        .delete()
        .eq("id", item.id);
      error = err;
    } else if (item.isCardTransaction) {
      const { error: err } = await supabase
        .from("card_transactions")
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
        transaction_date: `${initialMonthRef}-${String(item.day || 1).padStart(2, "0")}`,
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

    if (
      item.originalTemplateId &&
      !item.transactionId &&
      !item.paid
    ) {
      // It's a template projection being paid. Create it as a real Transaction.
      const { error } = await supabase.from("transactions").insert({
        description: item.description,
        amount: item.amount,
        kind: item.kind,
        month_ref: initialMonthRef,
        paid: true,
        template_id: item.originalTemplateId,
        user_id: user.id,
        is_recurring: item.isRecurring,
        installment_current: item.installmentCurrent,
        installment_total: item.installmentTotal,
        transaction_date: `${initialMonthRef}-${String(item.day || 1).padStart(2, "0")}`,
      });

      if (!error) {
        toast.success("Transação recorrente paga!");
        triggerTransactionUpdate();
        router.refresh();
      } else {
        console.error(error);
        toast.error("Erro ao processar transação recorrente");
      }
      return;
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



      <div className="flex justify-end mb-2">
        <div className="flex bg-[#202024] rounded-md p-1 gap-1">
          <button
            onClick={() => setViewMode("mixed")}
            className={cn(
              "p-1.5 rounded-md transition-all hover:text-white",
              viewMode === "mixed"
                ? "bg-[#00875f] text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-800",
            )}
            title="Visualização mista"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={cn(
              "p-1.5 rounded-md transition-all hover:text-white",
              viewMode === "grouped"
                ? "bg-[#00875f] text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-800",
            )}
            title="Visualização agrupada"
          >
            <Layers size={18} />
          </button>
        </div>
      </div>

      <div className="grid gap-2">
        <h2 className="sr-only">Transações</h2>
        <TransactionList
          items={items}
          viewMode={viewMode}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onMarkAsPaid={handleMarkAsPaid}
        />
      </div>

      <IncomeModal
        isOpen={modalOpen && modalKind === "incoming"}
        onClose={() => setModalOpen(false)}
        userId={user.id}
        defaultMonthRef={initialMonthRef}
        initialData={editingItem}
      />

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

      <ConfirmationModal
        isOpen={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir item"
        description={`Tem certeza que deseja excluir "${itemToDelete?.description}"? Essa ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  );
}
