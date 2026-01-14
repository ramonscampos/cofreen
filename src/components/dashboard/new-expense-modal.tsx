"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Card } from "@/types";

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  monthRef: string;
  userCards?: Card[];
}

export function NewExpenseModal({
  isOpen,
  onClose,
  userId,
  monthRef,
  userCards = [],
}: NewExpenseModalProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [cardId, setCardId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      description,
      amount: parseFloat(amount.replace(",", ".")),
      kind: "expense",
      month_ref: monthRef,
      paid: isPaid,
      card_id: cardId || null,
      user_id: userId,
      is_recurring: false, // For now, recurring expense logic not requested to be changed
    };

    const { error } = await supabase.from("transactions").insert(payload);

    setLoading(false);

    if (!error) {
      toast.success("Despesa cadastrada com sucesso!");
      router.refresh();
      handleClose();
    } else {
      toast.error("Erro ao cadastrar despesa");
      console.error(error);
    }
  };

  const handleClose = () => {
    setDescription("");
    setAmount("");
    setIsPaid(true);
    setCardId("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nova Saída"
      className="bg-gray-2 border-none"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <span className="text-sm font-medium text-gray-5">Descrição</span>
          <Input
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5"
          />
        </div>

        <div>
          <span className="text-sm font-medium text-gray-5">Valor</span>
          <MoneyInput
            placeholder="Preço"
            value={amount}
            onValueChange={(value) => setAmount(value || "")}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5"
          />
        </div>

        {userCards.length > 0 && (
          <div>
            <span className="text-sm font-medium text-gray-5">
              Cartão (Opcional - Fatura Manual)
            </span>
            <Select
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className="bg-gray-1 border-none text-white"
            >
              <option value="">Selecione um cartão (Nenhum)</option>
              {userCards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.bank_name}{" "}
                  {card.description ? `- ${card.description}` : ""}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-5 mt-1">
              Selecione apenas se estiver registrando o{" "}
              <strong>pagamento da fatura</strong> deste mês.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="paid-expense"
            checked={isPaid}
            onChange={(e) => setIsPaid(e.target.checked)}
            className="rounded border-gray-4 bg-gray-1 accent-red-500"
          />
          <span htmlFor="paid-expense" className="text-sm text-gray-300">
            Pago
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
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
