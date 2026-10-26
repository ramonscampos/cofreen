"use client";

import { parse } from "date-fns";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { Button } from "@/components/ui/button";
import { triggerTransactionUpdate } from "@/lib/events";
import { buildPaidTemplateTransaction } from "@/lib/finance-logic";
import type { MonthData } from "@/lib/month-data";
import { buildMonthView } from "@/lib/month-view";
import { cn } from "@/lib/utils";
import type { ActionResult, DashboardItem, Kind } from "@/types";

interface DashboardViewProps {
  initialMonthRef: string;
  monthData: MonthData;
  // yyyy-MM-dd computed on the server so both renders agree
  today: string;
}

import { ChevronRight, Layers, List } from "lucide-react";
import { CardBillsSection } from "@/components/cards/card-bills-section";
import { BalanceCards } from "@/components/dashboard/balance-cards";
import { ExpenseModal } from "@/components/dashboard/expense-modal";
import { IncomeModal } from "@/components/dashboard/income-modal";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";

export function DashboardView({
  initialMonthRef,
  monthData,
  today,
}: DashboardViewProps) {
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<Kind>("incoming");
  const [editingItem, setEditingItem] = useState<DashboardItem | null>(null);

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DashboardItem | null>(null);

  // Grouped keeps incomes apart from expenses
  const [viewMode, setViewMode] = useState<"mixed" | "grouped">("grouped");

  const { items, cardBills } = useMemo(
    () =>
      buildMonthView(
        monthData,
        initialMonthRef,
        parse(today, "yyyy-MM-dd", new Date()),
      ),
    [monthData, initialMonthRef, today],
  );

  const openNewModal = (kind: Kind) => {
    setEditingItem(null);
    setModalKind(kind);
    setModalOpen(true);
  };

  /* Handlers */
  const handleEdit = (item: DashboardItem) => {
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
    } else {
      const { deleteTransactionAction } = await import(
        "@/app/actions/transactions"
      );
      result = await deleteTransactionAction(item.id);
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

  const handleDefer = async (item: DashboardItem) => {
    const { deferBillAction } = await import("@/app/actions/transactions");
    const result = await deferBillAction(item, initialMonthRef);
    if (result.success) {
      toast.success("Conta adiada para o próximo mês");
      triggerTransactionUpdate();
      router.refresh();
    } else {
      toast.error(result.error || "Erro ao adiar conta");
    }
  };

  const handleUndoDefer = async (item: DashboardItem) => {
    if (!item.transactionId) return;
    const { undoDeferAction } = await import("@/app/actions/transactions");
    const result = await undoDeferAction(item.transactionId);
    if (result.success) {
      toast.success("Adiamento desfeito");
      triggerTransactionUpdate();
      router.refresh();
    } else {
      toast.error(result.error || "Erro ao desfazer adiamento");
    }
  };

  const handleMarkAsPaid = async (item: DashboardItem) => {
    const { createTransactionAction, updateTransactionAction } = await import(
      "@/app/actions/transactions"
    );

    if (item.originalTemplateId && !item.transactionId && !item.paid) {
      // It's a template projection being paid. Create it as a real Transaction.
      const result = await createTransactionAction(
        buildPaidTemplateTransaction(item, initialMonthRef),
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
      item.transactionId ?? item.id,
      { paid: !item.paid },
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
      <BalanceCards balances={monthData.balances} />

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
          Gerenciar cartões
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

      <CardBillsSection bills={cardBills} syncStatus={monthData.syncStatus} />

      <div className="grid gap-2">
        <h2 className="sr-only">Transações</h2>
        <TransactionList
          items={items}
          viewMode={viewMode}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onMarkAsPaid={handleMarkAsPaid}
          onDefer={handleDefer}
          onUndoDefer={handleUndoDefer}
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
        initialData={editingItem}
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
