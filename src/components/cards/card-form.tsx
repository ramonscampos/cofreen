"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Card } from "@/types";

interface CardFormProps {
  onClose: () => void;
  userId: string;
  initialData?: Card | null;
}

const COLORS = [
  "#000000",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#f1c40f",
  "#e67e22",
  "#e74c3c",
  "#95a5a6",
];

export function CardForm({ onClose, userId, initialData }: CardFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [bankName, setBankName] = useState(initialData?.bank_name || "");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [dueDay, setDueDay] = useState(initialData?.due_day?.toString() || "1");
  const [color, setColor] = useState(initialData?.color || "#000000");

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!bankName.trim()) {
      newErrors.bankName = "O nome do banco é obrigatório";
    }

    const day = Number.parseInt(dueDay, 10);
    if (Number.isNaN(day) || day < 1 || day > 31) {
      newErrors.dueDay = "Dia deve ser entre 1 e 31";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    const payload = {
      bank_name: bankName,
      description,
      due_day: Number.parseInt(dueDay, 10),
      color,
      user_id: userId,
    };

    let error = null;

    if (initialData?.id) {
      const { error: err } = await supabase
        .from("cards")
        .update(payload)
        .eq("id", initialData.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("cards").insert(payload);
      error = err;
    }

    setLoading(false);

    if (!error) {
      toast.success("Cartão salvo com sucesso!");
      router.refresh();
      onClose();
    } else {
      toast.error("Erro ao salvar cartão");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          placeholder="Banco / Emissor"
          autoFocus
          value={bankName}
          onChange={(e) => {
            setBankName(e.target.value);
            if (errors.bankName) setErrors({ ...errors, bankName: "" });
          }}
          className={`bg-[#121214] text-white placeholder:text-zinc-500 h-12 ${errors.bankName ? "border border-red-500" : "border-none"}`}
        />
        {errors.bankName && (
          <p className="text-red-500 text-xs mt-1">{errors.bankName}</p>
        )}
      </div>

      <div>
        <Input
          placeholder="Descrição (Opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-[#121214] border-none text-white placeholder:text-zinc-500 h-12"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-xs text-zinc-500 ml-1 mb-1 block">
            Dia de Vencimento
          </span>
          <Input
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => {
              setDueDay(e.target.value);
              if (errors.dueDay) setErrors({ ...errors, dueDay: "" });
            }}
            className={`bg-[#121214] text-white placeholder:text-zinc-500 h-12 ${errors.dueDay ? "border border-red-500" : "border-none"}`}
          />
          {errors.dueDay && (
            <p className="text-red-500 text-xs mt-1">{errors.dueDay}</p>
          )}
        </div>

        <div>
          <span className="text-xs text-zinc-500 ml-1 mb-1 block">
            Cor do Cartão
          </span>
          <div className="flex gap-2 flex-wrap items-center h-12 px-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4">
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
