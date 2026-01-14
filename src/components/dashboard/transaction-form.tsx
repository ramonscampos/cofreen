"use client";

import { useRouter } from "next/navigation";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Card, Kind, Transaction } from "@/types";

interface TransactionFormProps {
  onClose: () => void;
  kind: Kind;
  monthRef: string;
  userId: string;
  initialData?: Transaction | null;
  userCards?: Card[];
}

export function TransactionForm({
  onClose,
  kind,
  monthRef,
  userId,
  initialData,
  userCards = [],
}: TransactionFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [isPaid, setIsPaid] = useState(initialData?.paid ?? true); // Default true for manual entry usually
  const [cardId, setCardId] = useState(initialData?.card_id || "");
  // Recurring logic is complex (template creation), omitting for first pass of "Simple Transaction"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      description,
      amount: parseFloat(amount.replace(",", ".")), // Basic sanitization
      kind,
      month_ref: monthRef,
      paid: isPaid,
      card_id: cardId || null,
      user_id: userId,
    };

    let error = null;

    if (initialData?.id) {
      // Update
      const { error: err } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", initialData.id);
      error = err;
    } else {
      // Create
      const { error: err } = await supabase
        .from("transactions")
        .insert(payload);
      error = err;
    }

    setLoading(false);

    if (!error) {
      toast.success("Transação salva com sucesso!");
      router.refresh();
      onClose();
    } else {
      toast.error("Erro ao salvar transação");
      console.error(error);
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
        <span className="text-sm font-medium text-zinc-400">Valor</span>
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      {kind === "expense" && userCards.length > 0 && (
        <div>
          <span className="text-sm font-medium text-zinc-400">
            Cartão (Opcional - Fatura Manual)
          </span>
          <Select value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">Selecione um cartão (Nenhum)</option>
            {userCards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.bank_name}{" "}
                {card.description ? `- ${card.description}` : ""}
              </option>
            ))}
          </Select>
          <p className="text-xs text-zinc-500 mt-1">
            Selecione apenas se estiver registrando o{" "}
            <strong>pagamento da fatura</strong> deste mês. Para compras
            parceladas, use a área de Cartões.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="paid"
          checked={isPaid}
          onChange={(e) => setIsPaid(e.target.checked)}
          className="rounded border-zinc-700 bg-zinc-900"
        />
        <span htmlFor="paid" className="text-sm text-zinc-300">
          Pago / Recebido
        </span>
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
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
