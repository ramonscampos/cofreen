"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  createTemplateAction,
  updateTemplateAction,
} from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ActionResult, Kind, RecurringTemplate } from "@/types";

interface TemplateFormProps {
  onClose: () => void;
  initialData?: RecurringTemplate | null;
}

export function TemplateForm({ onClose, initialData }: TemplateFormProps) {
  const _router = useRouter();
  const [loading, setLoading] = useState(false);

  const [kind, setKind] = useState<Kind>(initialData?.kind || "expense");
  const [description, setDescription] = useState(
    initialData?.description || "",
  );
  const [amount, setAmount] = useState(
    initialData?.defaultAmount?.toString() || "",
  );
  const [day, setDay] = useState(initialData?.dayOfMonth?.toString() || "1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      kind,
      description,
      defaultAmount: parseFloat(amount.replace(",", ".")).toString(),
      dayOfMonth: parseInt(day, 10),
      isActive: true,
    };

    let result: ActionResult;

    if (initialData?.id) {
      result = await updateTemplateAction(initialData.id, payload);
    } else {
      result = await createTemplateAction(payload);
    }

    setLoading(false);

    if (result.success) {
      toast.success("Modelo salvo com sucesso!");
      onClose();
    } else {
      toast.error(result.error || "Erro ao salvar modelo");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="template-kind"
          className="text-sm font-medium text-zinc-400 block mb-1"
        >
          Tipo
        </label>
        <Select
          id="template-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
        >
          <option value="incoming">Entrada</option>
          <option value="expense">Despesa</option>
        </Select>
      </div>

      <div>
        <label
          htmlFor="template-description"
          className="text-sm font-medium text-zinc-400 block mb-1"
        >
          Descrição
        </label>
        <Input
          id="template-description"
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
      </div>

      <div>
        <label
          htmlFor="template-amount"
          className="text-sm font-medium text-zinc-400 block mb-1"
        >
          Valor Padrão
        </label>
        <Input
          id="template-amount"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      <div>
        <label
          htmlFor="template-day"
          className="text-sm font-medium text-zinc-400 block mb-1"
        >
          Dia do Mês (Previsão)
        </label>
        <Input
          id="template-day"
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
