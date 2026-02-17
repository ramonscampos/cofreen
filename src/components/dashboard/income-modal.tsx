"use client";

import { format, parse, isValid } from "date-fns";
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
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  defaultMonthRef?: string;
  initialData?: any; // Using any for DashboardItem flexibility, ideally strict type
}

export function IncomeModal({
  isOpen,
  onClose,
  userId,
  defaultMonthRef,
  initialData,
}: IncomeModalProps) {
  const supabase = createClient();
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
          setIsRecurring(initialData.isRecurring || initialData.is_recurring || false);
          
          if (initialData.day_of_month) {
             setDay(initialData.day_of_month.toString());
          }
          
          const ref = initialData.month_ref || defaultMonthRef;
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
    if (isNaN(numericAmount)) {
      toast.error("Valor inválido");
      setLoading(false);
      return;
    }

    if (!isValid(selectedDate)) {
      toast.error("Data de referência inválida");
      setLoading(false);
      return;
    }

    let error = null;
    const monthRefStr = format(selectedDate, "yyyy-MM");

    const payload = {
        description,
        [isRecurring ? 'default_amount' : 'amount']: numericAmount,
        kind: "incoming",
        ...(isRecurring ? { day_of_month: parseInt(day) } : { month_ref: monthRefStr, paid: true, is_recurring: false }),
        user_id: userId,
        ...(isRecurring ? { month_ref: monthRefStr, is_active: true } : {}), // recurring also has month_ref usually as start
    };

    if (initialData?.id) {
       // UPDATE
       // Check if we are updating a recurring template or a transaction
       const table = initialData.isRecurring ? "recurring_templates" : "transactions";
       // Note: Switch from recurring to transaction or vice versa is tricky here without delete/create. 
       // For now assuming we stick to the original type or simple updates.
       
       const { error: err } = await supabase
         .from(table)
         .update(payload)
         .eq("id", initialData.id);
       error = err;
       
    } else {
        // CREATE
        if (isRecurring) {
          const { error: err } = await supabase.from("recurring_templates").insert(payload);
          error = err;
        } else {
          const { error: err } = await supabase.from("transactions").insert(payload);
          error = err;
        }
    }

    setLoading(false);

    if (!error) {
      toast.success(initialData ? "Entrada atualizada!" : "Entrada cadastrada!");
      triggerTransactionUpdate();
      router.refresh();
      onClose();
    } else {
      toast.error("Erro ao salvar entrada");
      console.error(error);
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
            <span className={cn("text-white text-sm", !!initialData && "opacity-50")}>Recorrente?</span>
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
          {loading ? "Salvando..." : "Salvar"}
        </Button>
      </form>
    </Modal>
  );
}
