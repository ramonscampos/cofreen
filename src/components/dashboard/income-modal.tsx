"use client";

import { format, isValid, parse } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Switch } from "@/components/ui/switch";
import { triggerTransactionUpdate } from "@/lib/events";
import { cn } from "@/lib/utils";
import type {
  ActionResult,
  CreateTemplatePayload,
  CreateTransactionPayload,
  DashboardItem,
} from "@/types";

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMonthRef?: string;
  initialData?: DashboardItem | null;
}

export function IncomeModal({
  isOpen,
  onClose,
  defaultMonthRef,
  initialData,
}: IncomeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [day, setDay] = useState<string>("");

  // State for Date object for picker
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Effect to populate form on open/initialData change
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDescription(initialData.description);
        setAmount(initialData.amount?.toString() || "");
        setIsRecurring(initialData.isRecurring || false);

        if (initialData.day) {
          setDay(initialData.day.toString());
        }
        const ref = initialData.monthRef || defaultMonthRef;

        if (ref) {
          setSelectedDate(parse(ref, "yyyy-MM", new Date()));
        }
      } else {
        // Reset for new creation
        setDescription("");
        setAmount("");
        setIsRecurring(false);
        setDay(String(new Date().getDate()));
        if (defaultMonthRef) {
          setSelectedDate(parse(defaultMonthRef, "yyyy-MM", new Date()));
        } else {
          setSelectedDate(new Date());
        }
      }
    }
  }, [isOpen, initialData, defaultMonthRef]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const numericAmount = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(numericAmount)) {
      toast.error("Valor inválido");
      setLoading(false);
      return;
    }

    if (!isValid(selectedDate)) {
      toast.error("Data de referência inválida");
      setLoading(false);
      return;
    }

    let result: ActionResult;
    const monthRefStr = format(selectedDate, "yyyy-MM");

    const payload = {
      description,
      [isRecurring ? "defaultAmount" : "amount"]: numericAmount.toString(),
      kind: "incoming",
      ...(isRecurring
        ? { dayOfMonth: parseInt(day, 10) }
        : { monthRef: monthRefStr, paid: true, isRecurring: false }),
      ...(isRecurring ? { monthRef: monthRefStr, isActive: true } : {}), // recurring also has monthRef usually as start
      // Add transaction date only for non-recurring income
      ...(!isRecurring && {
        transactionDate: new Date().toISOString().split("T")[0],
      }),
    };

    const { createTemplateAction, updateTemplateAction } = await import(
      "@/app/actions/templates"
    );
    const { createTransactionAction, updateTransactionAction } = await import(
      "@/app/actions/transactions"
    );

    if (initialData?.id) {
      // UPDATE
      if (initialData.isRecurring) {
        result = await updateTemplateAction(
          initialData.id,
          payload as Partial<CreateTemplatePayload>,
        );
      } else {
        result = await updateTransactionAction(
          initialData.id,
          payload as Partial<CreateTransactionPayload>,
        );
      }
    } else {
      // CREATE
      if (isRecurring) {
        result = await createTemplateAction(
          payload as unknown as CreateTemplatePayload,
        );
      } else {
        result = await createTransactionAction(
          payload as unknown as CreateTransactionPayload,
        );
      }
    }

    setLoading(false);

    if (result.success) {
      toast.success(
        initialData ? "Entrada atualizada!" : "Entrada cadastrada!",
      );
      triggerTransactionUpdate();
      router.refresh();
      onClose();
    } else {
      toast.error(result.error || "Erro ao salvar entrada");
    }
  };

  // No handleClose needed specifically if we use useEffect to reset/populate

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Editar Entrada" : "Nova Entrada"}
      className="bg-gray-2 border-none"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="income-description" className="sr-only">
            Descrição
          </label>
          <Input
            id="income-description"
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5 h-12"
          />
        </div>

        <div>
          <label htmlFor="income-amount" className="sr-only">
            Preço
          </label>
          <MoneyInput
            id="income-amount"
            placeholder="Preço"
            value={amount}
            onValueChange={(value) => setAmount(value || "")}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5 h-12"
          />
        </div>

        <div className="flex items-center justify-between py-2 gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "text-white text-sm",
                !!initialData && "opacity-50",
              )}
            >
              Recorrente?
            </span>
            <Switch
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
              disabled={!!initialData}
            />
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="text-sm text-gray-5 whitespace-nowrap">
              Mês de referência
            </span>
            <div className="w-45">
              <MonthYearPicker date={selectedDate} onChange={setSelectedDate} />
            </div>
          </div>
        </div>

        {isRecurring && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="income-day"
              className="text-sm text-white whitespace-nowrap"
            >
              Dia do mês:
            </label>
            <Input
              id="income-day"
              type="number"
              min="1"
              max="31"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
              className="bg-gray-1 border-none text-white h-10 w-20"
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-green hover:bg-green-light text-white font-bold mt-4"
        >
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </Modal>
  );
}
