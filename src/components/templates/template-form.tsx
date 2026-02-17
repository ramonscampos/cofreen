"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import type { Kind, RecurringTemplate } from "@/types";

interface TemplateFormProps {
  onClose: () => void;
  userId: string;
  initialData?: RecurringTemplate | null;
}

export function TemplateForm({
  onClose,
  userId,
  initialData,
}: TemplateFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [kind, setKind] = useState<Kind>(initialData?.kind || "expense");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [amount, setAmount] = useState(
    initialData?.default_amount?.toString() || "",
  );
  const [day, setDay] = useState(initialData?.day_of_month?.toString() || "1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      kind,
      description,
      default_amount: parseFloat(amount.replace(",", ".")),
      day_of_month: parseInt(day),
      user_id: userId,
      is_active: true,
    };

    let error = null;

    if (initialData?.id) {
      const { error: err } = await supabase
        .from("recurring_templates")
        .update(payload)
        .eq("id", initialData.id);
      error = err;
    } else {
      const { error: err } = await supabase
        .from("recurring_templates")
        .insert(payload);
      error = err;
    }

    setLoading(false);

    if (!error) {
      toast.success("Modelo salvo com sucesso!");
      router.refresh();
      onClose();
    } else {
      toast.error("Erro ao salvar modelo");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <span className="text-sm font-medium text-zinc-400">Tipo</span>
        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="incoming">Entrada</option>
          <option value="expense">Despesa</option>
        </Select>
      </div>

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
        <span className="text-sm font-medium text-zinc-400">Valor Padrão</span>
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div>
        <span className="text-sm font-medium text-zinc-400">
          Dia do Mês (Previsão)
        </span>
        <Input
          type="number"
          min="1"
          max="31"
          value={day}
          onChange={(e) => setDay(e.target.value)}
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
          Salvar
        </Button>
      </div>
    </form>
  );
}
