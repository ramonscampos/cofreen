"use client";

import { format, parse } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface NewIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  defaultMonthRef?: string;
}

export function NewIncomeModal({
  isOpen,
  onClose,
  userId,
  defaultMonthRef,
}: NewIncomeModalProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [day, setDay] = useState<string>("");

  // State for Date object for picker
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (defaultMonthRef) {
      return parse(defaultMonthRef, "yyyy-MM", new Date());
    }
    return new Date();
  });

  // Keep monthRef string in sync or derive on submit
  // Actually simpler to just use selectedDate

  useEffect(() => {
    if (defaultMonthRef) {
      setSelectedDate(parse(defaultMonthRef, "yyyy-MM", new Date()));
    }
  }, [defaultMonthRef]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const numericAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numericAmount)) {
      toast.error("Valor inválido");
      setLoading(false);
      return;
    }

    let error = null;
    const monthRefStr = format(selectedDate, "yyyy-MM");

    if (isRecurring) {
      const { error: err } = await supabase.from("recurring_templates").insert({
        description,
        default_amount: numericAmount,
        kind: "incoming",
        day_of_month: parseInt(day),
        user_id: userId,
        month_ref: monthRefStr,
        // category: category // Ignored for now as per DB schema
        is_active: true,
      });
      error = err;
    } else {
      const { error: err } = await supabase.from("transactions").insert({
        description,
        amount: numericAmount,
        kind: "incoming",
        month_ref: monthRefStr,
        paid: true,
        user_id: userId,
        is_recurring: false,
        // category: category // Ignored
      });
      error = err;
    }

    setLoading(false);

    if (!error) {
      toast.success("Entrada cadastrada com sucesso!");
      router.refresh();
      handleClose();
    } else {
      toast.error("Erro ao cadastrar entrada");
      console.error(error);
    }
  };

  const handleClose = () => {
    setDescription("");
    setAmount("");
    setIsRecurring(false);
    setDay(String(new Date().getDate()));
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Nova entrada"
      className="bg-gray-2 border-none"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5 h-12"
          />
        </div>

        <div>
          <MoneyInput
            placeholder="Preço"
            value={amount}
            onValueChange={(value) => setAmount(value || "")}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5 h-12"
          />
        </div>

        <div className="flex items-center justify-between py-2 gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-white text-sm">Recorrente?</span>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <span className="text-sm text-gray-5 whitespace-nowrap">
              Mês de referência
            </span>
            <div className="w-[180px]">
              <MonthYearPicker date={selectedDate} onChange={setSelectedDate} />
            </div>
          </div>
        </div>

        {isRecurring && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-white whitespace-nowrap">
              Dia do mês:
            </span>
            <Input
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
          {loading ? "Cadastrando..." : "Cadastrar"}
        </Button>
      </form>
    </Modal>
  );
}
