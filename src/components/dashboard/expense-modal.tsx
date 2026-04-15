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
  Card,
  CreateTemplatePayload,
  CreateTransactionPayload,
  DashboardItem,
} from "@/types";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthRef: string;
  userCards?: Card[];
  initialData?: DashboardItem | null;
}

export function ExpenseModal({
  isOpen,
  onClose,
  monthRef,
  userCards = [],
  initialData,
}: ExpenseModalProps) {
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
        setAmount(initialData.amount?.toString() || "");

        setIsRecurring(initialData.isRecurring || false);

        if (initialData.day) {
          setDay(initialData.day.toString());
        } else {
          setDay(String(new Date().getDate()));
        }

        const ref = initialData.monthRef || monthRef;
        if (ref) {
          setSelectedDate(parse(ref, "yyyy-MM", new Date()));
        } else {
          setSelectedDate(new Date());
        }

        if (initialData.cardId) {
          setCardId(initialData.cardId);
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
      const count = Number.parseInt(installments, 10);
      const current = Number.parseInt(installmentCurrent, 10);

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

      const { createTemplateAction } = await import("@/app/actions/templates");
      const { createTransactionAction } = await import(
        "@/app/actions/transactions"
      );

      // CASE A: Card Installments -> Generate SINGLE Master Record in card_transactions
      if (useCard && cardId) {
        const monthRefStr = format(selectedDate, "yyyy-MM");

        const result = await createTransactionAction(
          {
            description,
            amount: numericAmount.toString(),
            cardId: cardId,
            monthRef: monthRefStr,
            installmentCurrent: current,
            installmentTotal: count,
            kind: "expense",
            paid: false,
          } as CreateTransactionPayload,

          true,
        ); // isCardTransaction = true

        if (!result.success) {
          console.error(result.error);
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
        const result = await createTemplateAction({
          description,
          defaultAmount: numericAmount.toString(),
          kind: "expense",
          dayOfMonth: selectedDate.getDate(),
          monthRef: format(selectedDate, "yyyy-MM"),
          installmentCurrent: current,
          installmentTotal: count,
          isActive: true,
        });

        if (!result.success) {
          console.error(result.error);
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

    let result: ActionResult;
    const monthRefStr = format(selectedDate, "yyyy-MM");

    const payload = {
      description,
      [isRecurring ? "defaultAmount" : "amount"]: numericAmount.toString(), // recurring uses defaultAmount
      kind: "expense",
      cardId: useCard ? cardId : null,
      ...(isRecurring
        ? { dayOfMonth: Number.parseInt(day, 10) || 1 }
        : {
            monthRef: monthRefStr,
            paid: false,
            isRecurring: false,
          }),
      ...(isRecurring ? { monthRef: monthRefStr, isActive: true } : {}),
      // Add transaction date only for non-recurring expenses
      ...(!isRecurring && {
        transactionDate: `${monthRefStr}-${String(parseInt(day, 10) || (monthRefStr === new Date().toISOString().substring(0, 7) ? new Date().getDate() : 1)).padStart(2, "0")}`,
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
        // CASE 1: Update Recurring Template
        result = await updateTemplateAction(
          initialData.id,
          payload as Partial<CreateTemplatePayload>,
        );
      } else if (initialData.isCardTransaction) {
        // CASE 2: Update Card Transaction
        result = await updateTransactionAction(
          initialData.id,
          {
            description,
            amount: numericAmount.toString(),
            cardId: useCard ? cardId : null,
            monthRef: monthRefStr,
            paid: initialData.paid,
          } as Partial<CreateTransactionPayload>,
          true,
        );
      } else {
        // CASE 3: Update Existing Transaction
        result = await updateTransactionAction(
          initialData.id,
          payload as Partial<CreateTransactionPayload>,
          false,
        );
      }
    } else {
      // CREATE
      if (isRecurring) {
        result = await createTemplateAction(
          payload as unknown as CreateTemplatePayload,
        );
      } else {
        // CASE 4: Create New Expense
        if (useCard && cardId) {
          // NEW RULE: Card Expenses go to `card_transactions`
          result = await createTransactionAction(
            {
              description,
              amount: numericAmount.toString(),
              cardId: cardId,
              monthRef: monthRefStr,
              installmentCurrent: 1,
              installmentTotal: 1,
              kind: "expense",
              paid: false,
            } as CreateTransactionPayload,
            true,
          );
        } else {
          // Normal Expense (Cash/Debit) -> `transactions`
          result = await createTransactionAction(
            payload as unknown as CreateTransactionPayload,
            false,
          );
        }
      }
    }

    setLoading(false);

    if (result?.success) {
      toast.success(
        initialData ? "Despesa atualizada!" : "Despesa cadastrada!",
      );
      triggerTransactionUpdate();
      router.refresh();
      onClose();
    } else {
      toast.error(result ? result.error : "Erro ao salvar despesa");
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
          <label htmlFor="expense-description" className="sr-only">
            Descrição
          </label>
          <Input
            id="expense-description"
            autoFocus
            placeholder="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5 h-12"
          />
        </div>

        <div>
          <label htmlFor="expense-amount" className="sr-only">
            Preço
          </label>
          <MoneyInput
            id="expense-amount"
            placeholder="Preço"
            value={amount}
            onValueChange={(value) => setAmount(value || "")}
            required
            className="bg-gray-1 border-none text-white placeholder:text-gray-5 h-12"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="expense-day"
              className="text-sm text-gray-5 whitespace-nowrap"
            >
              Dia:
            </label>
            <Input
              id="expense-day"
              type="number"
              min="1"
              max="31"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="bg-gray-1 border-none text-white h-10 w-16"
              placeholder="DD"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm text-gray-5 whitespace-nowrap">Mês:</span>
            <div className="w-full">
              <MonthYearPicker date={selectedDate} onChange={setSelectedDate} />
            </div>
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
              <label
                htmlFor="expense-installment-current"
                className={cn(
                  "text-sm text-gray-400",
                  !isInstallment && "opacity-50",
                )}
              >
                Atual:
              </label>
              <Input
                id="expense-installment-current"
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
              <label
                htmlFor="expense-installments-total"
                className={cn(
                  "text-sm text-gray-400",
                  !isInstallment && "opacity-50",
                )}
              >
                Total:
              </label>
              <Input
                id="expense-installments-total"
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
                  // Keep day logic flexible
                }
              }}
              disabled={!!initialData}
            />
          </div>

          <div className="flex items-center gap-2  w-full">
            {/* Day input moved above */}
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
                      {card.bankName}
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
