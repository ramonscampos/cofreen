"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { CardTransaction } from "@/types";

interface CardTransactionFormProps {
  onClose: () => void;
  cardId: string;
  userId: string;
  currentMonthRef: string;
}

export function CardTransactionForm({
  onClose,
  cardId,
  userId,
  currentMonthRef,
}: CardTransactionFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState("1");
  // "billingMonth" could be editable, but for simplicity let's assume "First installment is this month (or next depending on due day?)".
  // Requirement says: "When creating installments: Support 'installment already in progress' - Generate ONLY remaining months".
  // For this form, let's assume standard "New Purchase".

  // Logic:
  // If we buy today, it goes to currentMonthRef bill?
  // Depends on "Closing Date". Card entity has "due_day".
  // If today > closing_day, it goes to next month.
  // Simplifying: User selects "Mês da 1ª Parcela". Default to current view context.
  const [firstMonthRef, setFirstMonthRef] = useState(currentMonthRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const totalInstallments = parseInt(installments);
    const purchaseAmount = parseFloat(amount.replace(",", "."));
    const installmentValue = purchaseAmount / totalInstallments;

    const planId = crypto.randomUUID();
    const records: Partial<CardTransaction>[] = [];

    let currentRef = firstMonthRef;

    for (let i = 1; i <= totalInstallments; i++) {
      records.push({
        user_id: userId,
        card_id: cardId,
        month_ref: currentRef,
        description:
          totalInstallments > 1
            ? `${description} (${i}/${totalInstallments})`
            : description,
        amount: installmentValue,
        installment_total: totalInstallments,
        installment_current: i,
        plan_id: planId,
      });

      // Increment month
      const [y, m] = currentRef.split("-").map(Number);
      const date = new Date(y, m - 1 + 1, 1);
      const nextY = date.getFullYear();
      const nextM = String(date.getMonth() + 1).padStart(2, "0");
      currentRef = `${nextY}-${nextM}`;
    }

    const { error } = await supabase.from("card_transactions").insert(records);

    setLoading(false);

    if (!error) {
      toast.success("Compra lançada com sucesso!");
      router.refresh();
      onClose();
    } else {
      toast.error("Erro ao salvar compra");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="text-sm font-medium text-zinc-400">Descrição</span>
        <Input
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <div>
        <span className="text-sm font-medium text-zinc-400">
          Valor Total da Compra
        </span>
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div>
        <span className="text-sm font-medium text-zinc-400">Parcelas</span>
        <Input
          type="number"
          min="1"
          max="99"
          value={installments}
          onChange={(e) => setInstallments(e.target.value)}
          required
        />
      </div>

      <div>
        <span className="text-sm font-medium text-zinc-400">
          Mês da 1ª Parcela
        </span>
        <Input
          type="month"
          value={firstMonthRef}
          onChange={(e) => setFirstMonthRef(e.target.value)}
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          Lançar Compra
        </Button>
      </div>
    </form>
  );
}
