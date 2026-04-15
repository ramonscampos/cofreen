"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { triggerTransactionUpdate } from "@/lib/events";
import type { ActionResult, DashboardItem } from "@/types";

interface EditBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DashboardItem | null;
  monthRef: string;
}

export function EditBillModal({
  isOpen,
  onClose,
  item,
  monthRef,
}: EditBillModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isOpen && item) {
      setAmount(item.amount.toString());
    }
  }, [isOpen, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    setLoading(true);
    const numericAmount = parseFloat(amount.replace(",", "."));

    if (Number.isNaN(numericAmount)) {
      toast.error("Valor inválido");
      setLoading(false);
      return;
    }

    let result: ActionResult;
    const { createTransactionAction, updateTransactionAction } = await import(
      "@/app/actions/transactions"
    );

    // Logic:
    // 1. If ID starts with 'virtual-', it creates a new Transaction (Manual Bill).
    // 2. If ID is normal, it updates the existing Transaction (Manual Bill).

    if (item.id.toString().startsWith("virtual-card-")) {
      // CREATE
      result = await createTransactionAction(
        {
          description: item.description, // Keep the card name as description
          amount: numericAmount.toString(),
          kind: "expense",
          monthRef: monthRef,
          paid: item.paid || false,
          cardId: item.cardId,
          isRecurring: false,
        },
        false,
      );
    } else {
      // UPDATE
      result = await updateTransactionAction(
        item.id,
        { amount: numericAmount.toString() },
        false,
      );
    }

    setLoading(false);

    if (result?.success) {
      toast.success("Fatura atualizada!");
      triggerTransactionUpdate();
      router.refresh();
      onClose();
    } else {
      toast.error(result?.error || "Erro ao salvar fatura");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Fatura - ${item?.description || ""}`}
      className="bg-gray-2 border-none"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="bill-amount" className="sr-only">
            Valor da Fatura
          </label>
          <MoneyInput
            id="bill-amount"
            placeholder="Valor"
            value={amount}
            onValueChange={(value) => setAmount(value || "")}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5 h-12"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="text-gray-6 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-red hover:bg-red-light text-white font-bold"
          >
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
