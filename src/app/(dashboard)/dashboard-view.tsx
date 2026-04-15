"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { Button } from "@/components/ui/button";
import { triggerTransactionUpdate } from "@/lib/events";
import { mergeTransactionsAndTemplates } from "@/lib/finance-logic";
import { cn } from "@/lib/utils";
import type {
  ActionResult,
  Card,
  CardTransaction,
  DashboardItem,
  Kind,
  RecurringTemplate,
  Transaction,
} from "@/types";

interface DashboardViewProps {
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

  const openNewModal = (kind: Kind) => {
    setEditingItem(null);
    setModalKind(kind);
    setModalOpen(true);
  };

  /* Handlers */
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

    let result: ActionResult;
    if (
      item.isRecurring ||
      (item.originalTemplateId && item.originalTemplateId === item.id)
    ) {
      const { deleteTemplateAction } = await import("@/app/actions/templates");
      result = await deleteTemplateAction(item.id);
    } else if (item.isCardTransaction) {
      const { deleteTransactionAction } = await import(
        "@/app/actions/transactions"
      );
      result = await deleteTransactionAction(item.id, true);
    } else {
      const { deleteTransactionAction } = await import(
        "@/app/actions/transactions"
      );
      result = await deleteTransactionAction(item.id, false);
    }

    if (result.success) {
      toast.success("Item removido com sucesso");
      triggerTransactionUpdate();
      setConfirmationOpen(false);
      router.refresh();
    } else {
      toast.error(result.error || "Erro ao remover item");
    }
  };

  const handleMarkAsPaid = async (item: DashboardItem) => {
    const { createTransactionAction, updateTransactionAction } = await import(
      "@/app/actions/transactions"
    );

    if (item.id.toString().startsWith("virtual-card-")) {
      // It's a virtual card bill being paid. Create it as a Paid Transaction.
      const result = await createTransactionAction(
        {
          description: item.description,
          amount: item.amount,
          kind: "expense", // Bill is expense
          monthRef: initialMonthRef, // Ensure we use the current view month
          paid: true,
          cardId: item.cardId,
          isRecurring: false,
        },
        false,
      );

      if (result.success) {
        toast.success("Fatura paga criada!");
        triggerTransactionUpdate();
        router.refresh();
      } else {
        toast.error("Erro ao pagar fatura");
      }
      return;
    }

    if (item.originalTemplateId && !item.transactionId && !item.paid) {
      // It's a template projection being paid. Create it as a real Transaction.
      const result = await createTransactionAction(
        {
          description: item.description,
          amount: item.amount,
          kind: item.kind,
          monthRef: initialMonthRef,
          paid: true,
          templateId: item.originalTemplateId,
          isRecurring: item.isRecurring,
        },
        false,
      );

      if (result.success) {
        toast.success("Transação recorrente paga!");
        triggerTransactionUpdate();
        router.refresh();
      } else {
        toast.error("Erro ao processar transação recorrente");
      }
      return;
    }

    const result = await updateTransactionAction(
      item.id,
      { paid: !item.paid },
      !!item.isCardTransaction,
    );

    if (result.success) {
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
            type="button"
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
            type="button"
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
        defaultMonthRef={initialMonthRef}
        initialData={editingItem}
      />

      <ExpenseModal
        isOpen={modalOpen && modalKind === "expense"}
        onClose={() => setModalOpen(false)}
        monthRef={initialMonthRef}
        userCards={initialCards}
        initialData={editingItem}
      />

      <EditBillModal
        isOpen={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        item={editingBillItem}
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
