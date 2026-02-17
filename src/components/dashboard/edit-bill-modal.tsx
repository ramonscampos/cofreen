"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { triggerTransactionUpdate } from "@/lib/events";
import { MoneyInput } from "@/components/ui/money-input";
import { createClient } from "@/lib/supabase/client";
import type { DashboardItem } from "@/types";

interface EditBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DashboardItem | null;
  userId: string;
  monthRef: string;
}

export function EditBillModal({
  isOpen,
  onClose,
  item,
  userId,
  monthRef,
}: EditBillModalProps) {
  const supabase = createClient();
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

    if (isNaN(numericAmount)) {
      toast.error("Valor inválido");
      setLoading(false);
      return;
    }

    let error = null;

    // Logic:
    // 1. If ID starts with 'virtual-', it creates a new Transaction (Manual Bill).
    // 2. If ID is normal, it updates the existing Transaction (Manual Bill).

    if (item.id.toString().startsWith("virtual-card-")) {
      // CREATE
      const { error: err } = await supabase.from("transactions").insert({
        description: item.description, // Keep the card name as description
        amount: numericAmount,
        kind: "expense",
        month_ref: monthRef,
        paid: item.paid || false,
        card_id: item.cardId,
        user_id: userId,
        is_recurring: false,
      });
      error = err;
    } else {
      // UPDATE
      const { error: err } = await supabase
        .from("transactions")
        .update({ amount: numericAmount }) // Only amount updates allowed
        .eq("id", item.id);
      error = err;
    }

    setLoading(false);

    if (!error) {
      toast.success("Fatura atualizada!");
      triggerTransactionUpdate();
      router.refresh();
      onClose();
    } else {
      toast.error("Erro ao salvar fatura");
      console.error(error);
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
          <label className="text-xs text-gray-5 mb-1 block">
            Valor da Fatura
          </label>
          <MoneyInput
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
