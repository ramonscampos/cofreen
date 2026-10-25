"use client";

import { useState } from "react";
import { toast } from "sonner";
import { updateCardAction } from "@/app/actions/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { Card } from "@/types";

interface CardFormProps {
  card: Card;
  onClose: () => void;
}

const COLORS = [
  "#8257e5",
  "#000000",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#f1c40f",
  "#e67e22",
  "#e74c3c",
  "#95a5a6",
];

export function CardForm({ card, onClose }: CardFormProps) {
  const [loading, setLoading] = useState(false);
  const [bankName, setBankName] = useState(card.bankName);
  const [color, setColor] = useState(card.color);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankName.trim()) {
      setError("O nome do cartão é obrigatório");
      return;
    }

    setLoading(true);
    const result = await updateCardAction(card.id, {
      bankName: bankName.trim(),
      color,
    });
    setLoading(false);

    if (result.success) {
      toast.success("Cartão salvo com sucesso!");
      onClose();
    } else {
      toast.error(result.error || "Erro ao salvar cartão");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="card-name" className="sr-only">
          Nome do cartão
        </label>
        <Input
          id="card-name"
          placeholder="Nome do cartão"
          autoFocus
          value={bankName}
          onChange={(e) => {
            setBankName(e.target.value);
            if (error) setError("");
          }}
          className={`bg-[#121214] text-white placeholder:text-zinc-500 h-12 ${error ? "border border-red-500" : "border-none"}`}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>

      <div>
        <span className="text-xs text-zinc-500 ml-1 mb-1 block">
          Cor do cartão
        </span>
        <div className="flex gap-2 flex-wrap items-center h-12 px-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-white scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        O vencimento e as faturas vêm da Pluggy automaticamente.
      </p>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-[#00875f] hover:bg-[#00875f]/90 text-white font-bold"
        >
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
