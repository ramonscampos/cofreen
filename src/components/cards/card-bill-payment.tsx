"use client";

import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import {
  markCardBillPaidAction,
  undoCardBillPaymentAction,
} from "@/app/actions/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import {
  formatPaidOn,
  maskDate,
  parsePaidOn,
  validateBillPayment,
} from "@/lib/cards/bill-payment";
import type { CardBillView } from "@/lib/cards/bill-view";
import { triggerTransactionUpdate } from "@/lib/events";
import { formatCurrency } from "@/lib/format";

interface CardBillPaymentProps {
  bill: CardBillView;
}

const roundCents = (value: number) => Math.round(value * 100) / 100;

export function CardBillPayment({ bill }: CardBillPaymentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { manualPayment } = bill;
  const canMarkPaid = !manualPayment && bill.status !== "paid";

  const openForm = () => {
    // Total of the bill, or what is left when part of it is already paid
    const remaining = roundCents(Math.max(bill.amount - bill.paidAmount, 0));
    setAmount(String(remaining || roundCents(bill.amount)));
    setDate(format(new Date(), "dd/MM/yyyy"));
    setError("");
    setIsOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const paidOn = parsePaidOn(date);
    if (!paidOn) {
      setError("Informe a data no formato dd/mm/aaaa");
      return;
    }
    const input = {
      cardId: bill.card.id,
      monthRef: bill.monthRef,
      amount: Number(amount),
      paidOn,
    };
    const invalid = validateBillPayment(input);
    if (invalid) {
      setError(invalid);
      return;
    }

    setLoading(true);
    const result = await markCardBillPaidAction(input);
    setLoading(false);
    if (result.success) {
      toast.success("Pagamento registrado");
      setIsOpen(false);
      triggerTransactionUpdate();
    } else {
      toast.error(result.error || "Erro ao registrar pagamento");
    }
  };

  const handleUndo = async () => {
    setLoading(true);
    const result = await undoCardBillPaymentAction(bill.card.id, bill.monthRef);
    setLoading(false);
    if (result.success) {
      toast.success("Pagamento desfeito");
      triggerTransactionUpdate();
    } else {
      toast.error(result.error || "Erro ao desfazer pagamento");
    }
  };

  if (!canMarkPaid && !manualPayment) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[#202024] px-3 py-2">
      {manualPayment ? (
        <>
          <p className="text-sm text-zinc-300">
            Pagamento registrado: {formatCurrency(manualPayment.amount)} em{" "}
            {formatPaidOn(manualPayment.paidOn)}
          </p>
          <Button
            variant="outline"
            size="sm"
            isLoading={loading}
            onClick={handleUndo}
            className="min-h-11 md:min-h-9"
          >
            Desfazer pagamento
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-400">
            {bill.paidAmount > 0
              ? `Pago ${formatCurrency(bill.paidAmount)} de ${formatCurrency(bill.amount)}`
              : "Fatura sem pagamento registrado"}
          </p>
          <Button
            size="sm"
            onClick={openForm}
            className="min-h-11 bg-[#00875f] font-bold text-white hover:bg-[#00875f]/90 md:min-h-9"
          >
            Marcar como paga
          </Button>
        </>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Pagamento da fatura ${bill.card.bankName}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="bill-payment-amount"
              className="mb-1 ml-1 block text-xs text-zinc-500"
            >
              Valor pago
            </label>
            <MoneyInput
              id="bill-payment-amount"
              inputMode="decimal"
              value={amount}
              onValueChange={(value) => {
                setAmount(value ?? "");
                if (error) setError("");
              }}
            />
          </div>
          <div>
            <label
              htmlFor="bill-payment-date"
              className="mb-1 ml-1 block text-xs text-zinc-500"
            >
              Data do pagamento
            </label>
            <Input
              id="bill-payment-date"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="dd/mm/aaaa"
              maxLength={10}
              value={date}
              onChange={(event) => {
                setDate(maskDate(event.target.value));
                if (error) setError("");
              }}
              className="h-12 bg-[#121214] text-white"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-xs text-zinc-500">
            Não cria despesa: o cartão continua na seção de cartões. Para
            pagamento parcial, informe um valor menor que o total.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={loading}
              className="bg-[#00875f] font-bold text-white hover:bg-[#00875f]/90"
            >
              Salvar pagamento
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
