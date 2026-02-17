"use client";

import { addMonths, format, isValid, parse } from "date-fns";
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
import type { Card } from "@/types";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  monthRef: string; // Keep as required or optional depending on usage, matching updated calls
  userCards?: Card[];
  initialData?: any;
}

export function ExpenseModal({
  isOpen,
  onClose,
  userId,
  monthRef,
  userCards = [],
  initialData,
}: ExpenseModalProps) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  // Recurring state
  const [isRecurring, setIsRecurring] = useState(false);
  const [day, setDay] = useState<string>("");

  // Installment state
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState("");
  const [installmentCurrent, setInstallmentCurrent] = useState("1");

  // Date state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Card state
  const [cardId, setCardId] = useState<string | null>(null);
  const useCard = !!cardId;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDescription(initialData.description);
        setAmount(
          initialData.amount?.toString() ||
            initialData.default_amount?.toString() ||
            "",
        );
        setIsRecurring(
          initialData.isRecurring || initialData.is_recurring || false,
        );

        if (initialData.day_of_month) {
          setDay(initialData.day_of_month.toString());
        } else {
          setDay(String(new Date().getDate()));
        }

        const ref = initialData.month_ref || monthRef;
        if (ref) {
          setSelectedDate(parse(ref, "yyyy-MM", new Date()));
        } else {
          setSelectedDate(new Date());
        }

        if (initialData.card_id) {
          setCardId(initialData.card_id);
        } else {
          setCardId(null);
        }
      } else {
        // Reset
        setDescription("");
        setAmount("");
        setIsRecurring(false);
        setDay(String(new Date().getDate()));
        setIsInstallment(false);
        setInstallments("");
        setInstallmentCurrent("1");
        setCardId(null);
        if (monthRef) setSelectedDate(parse(monthRef, "yyyy-MM", new Date()));
        else setSelectedDate(new Date());
      }
    }
  }, [isOpen, initialData, monthRef]);

  // Reset state when opening/closing
  const handleClose = () => {
    onClose();
  };

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

    // --- INSTALLMENT LOGIC ---
    if (isInstallment) {
      const count = Number.parseInt(installments);
      const current = Number.parseInt(installmentCurrent);

      if (Number.isNaN(count) || count < 2) {
        toast.error("Número de parcelas inválido (mínimo 2)");
        setLoading(false);
        return;
      }

      if (Number.isNaN(current) || current < 1) {
        toast.error("Parcela inicial inválida");
        setLoading(false);
        return;
      }

      if (current > count) {
        toast.error("Parcela inicial não pode ser maior que o total");
        setLoading(false);
        return;
      }

      // CASE A: Card Installments -> Generate SINGLE Master Record in card_transactions
      if (useCard && cardId) {
          const monthRefStr = format(selectedDate, "yyyy-MM");

          const { error } = await supabase.from("card_transactions").insert({
              description,
              amount: numericAmount,
              card_id: cardId,
              user_id: userId,
              month_ref: monthRefStr,
              installment_current: current,
              installment_total: count,
          });

        if (error) {
          console.error(error);
          toast.error("Erro ao configurar parcelamento no cartão");
        } else {
          toast.success("Parcelamento no cartão configurado!");
          triggerTransactionUpdate();
          router.refresh();
          onClose();
        }
      } 
      // CASE B: Manual Installments -> Create SINGLE recurring_template
      else {
         const { error } = await supabase.from("recurring_templates").insert({
            description,
            default_amount: numericAmount,
            kind: "expense",
            user_id: userId,
            day_of_month: selectedDate.getDate(),
            month_ref: format(selectedDate, "yyyy-MM"),
            installment_current: current,
            installment_total: count,
            is_active: true
         });

         if (error) {
            console.error(error);
            toast.error("Erro ao configurar parcelamento");
         } else {
            toast.success("Parcelamento configurado!");
            triggerTransactionUpdate();
            router.refresh();
            onClose();
         }
      }

      setLoading(false);
      return;
    }
    // --- END INSTALLMENT LOGIC ---

    let error = null;
    const monthRefStr = format(selectedDate, "yyyy-MM");

    const payload = {
      description,
      [isRecurring ? "default_amount" : "amount"]: numericAmount, // recurring uses default_amount
      kind: "expense",
      ...(isRecurring
        ? { day_of_month: Number.parseInt(day) || 1 }
        : {
            month_ref: monthRefStr,
            paid: false,
            card_id: useCard ? cardId : null,
            is_recurring: false,
          }),
      user_id: userId,
      ...(isRecurring ? { month_ref: monthRefStr, is_active: true } : {}),
    };

    if (initialData?.id) {
      // UPDATE
      if (initialData.isRecurring || initialData.is_recurring) {
        // CASE 1: Update Recurring Template
        const { error: err } = await supabase
          .from("recurring_templates")
          .update(payload)
          .eq("id", initialData.id);
        error = err;
      } else {
        // CASE 2: Update Existing Transaction
        const { error: err } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", initialData.id);
        error = err;
      }
    } else {
      // CREATE
      if (isRecurring) {
        const { error: err } = await supabase
          .from("recurring_templates")
          .insert(payload);
        error = err;
      } else {
        // CASE 4: Create New Expense
        if (useCard && cardId) {
          // NEW RULE: Card Expenses go to `card_transactions`
          const { error: err } = await supabase
            .from("card_transactions")
            .insert({
              description,
              amount: numericAmount,
              card_id: cardId,
              user_id: userId,
              month_ref: monthRefStr,
              installment_current: 1, // Default to single installment?
              installment_total: 1,
            });
          error = err;
        } else {
          // Normal Expense (Cash/Debit) -> `transactions`
          const { error: err } = await supabase
            .from("transactions")
            .insert(payload);
          error = err;
        }
      }
    }

    setLoading(false);

    if (!error) {
      toast.success(
        initialData ? "Despesa atualizada!" : "Despesa cadastrada!",
      );
      triggerTransactionUpdate();
      router.refresh();
      onClose();
    } else {
      toast.error("Erro ao salvar despesa");
      console.error(error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={initialData ? "Editar Despesa" : "Nova Despesa"}
      className="bg-gray-2 border-none"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Input
            autoFocus
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

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-5 whitespace-nowrap">
            Mês de referência
          </span>
          <div className="w-full">
            <MonthYearPicker date={selectedDate} onChange={setSelectedDate} />
          </div>
        </div>

        {/* Row 1: Parcelada + Qtd */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-white text-sm",
                !!initialData && "opacity-50",
              )}
            >
              Parcelada?
            </span>
            <Switch
              checked={isInstallment}
              onCheckedChange={(checked) => {
                setIsInstallment(checked);
                if (checked) {
                  setIsRecurring(false);
                  setDay("");
                } else {
                  setInstallments("");
                  setInstallmentCurrent("1");
                }
              }}
            />
          </div>

          <div className="flex items-center gap-2 w-full">
            <div className="flex items-center gap-2 flex-1">
              <span
                className={cn(
                  "text-sm text-gray-400",
                  !isInstallment && "opacity-50",
                )}
              >
                Atual:
              </span>
              <Input
                type="number"
                min="1"
                max="99"
                value={installmentCurrent}
                onChange={(e) => setInstallmentCurrent(e.target.value)}
                disabled={!isInstallment}
                className="bg-gray-1 border-none text-white w-14 h-10 disabled:opacity-50 flex-1"
              />
            </div>

            <div className="flex items-center gap-2 flex-1">
              <span
                className={cn(
                  "text-sm text-gray-400",
                  !isInstallment && "opacity-50",
                )}
              >
                Total:
              </span>
              <Input
                type="number"
                min="2"
                max="99"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                disabled={!isInstallment}
                className="bg-gray-1 border-none text-white w-14 h-10 disabled:opacity-50 flex-1"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
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
              onCheckedChange={(checked) => {
                setIsRecurring(checked);
                if (checked) {
                  setIsInstallment(false);
                  setInstallments("");
                } else {
                  setDay("");
                }
              }}
              disabled={!!initialData}
            />
          </div>

          <div className="flex items-center gap-2  w-full">
            <span
              className={cn(
                "text-sm text-gray-400",
                (!isRecurring || useCard) && "opacity-50",
              )}
            >
              Dia do mês:
            </span>
            <Input
              type="number"
              min="1"
              max="31"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              disabled={!isRecurring || useCard}
              className="bg-gray-1 border-none text-white h-10 flex-1 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Card Section */}
        {userCards.length > 0 && (
          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <div className="flex flex-wrap gap-2 pl-1">
              {userCards.map((card) => {
                const isSelected = cardId === card.id;
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      if (isSelected) {
                        setCardId(null);
                      } else {
                        setCardId(card.id);
                        if (isRecurring) {
                          setDay("");
                        }
                      }
                    }}
                    className={cn(
                      "cursor-pointer px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 flex items-center gap-2 text-white shadow-sm",
                      isSelected
                        ? "border-white scale-105 opacity-100"
                        : "border-transparent opacity-50 hover:opacity-100",
                    )}
                    style={{
                      backgroundColor: card.color,
                    }}
                  >
                    <span>
                      {card.bank_name}
                      {card.description ? ` - ${card.description}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
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
