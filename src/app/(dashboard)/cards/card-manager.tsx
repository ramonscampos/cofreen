"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CreditCard,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardForm } from "@/components/cards/card-form";
import { CardTransactionForm } from "@/components/cards/card-transaction-form";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type { Card, CardTransaction } from "@/types";

interface CardManagerProps {
  user: any;
  initialCards: Card[];
  monthRef: string;
  initialCardTransactions: CardTransaction[];
}

export function CardManager({
  user,
  initialCards,
  monthRef,
  initialCardTransactions,
}: CardManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const handleEdit = (card: Card, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCard(card);
    setModalOpen(true);
  };

  const handleDelete = async (card: Card, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Tem certeza que deseja excluir o cartão ${card.bank_name}?`)) {
      const { error } = await supabase.from("cards").delete().eq("id", card.id);
      if (!error) router.refresh();
    }
  };

  const handleOpenPurchase = (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCardId(cardId);
    setPurchaseModalOpen(true);
  };

  const toggleExpand = (cardId: string) => {
    setExpandedCardId(expandedCardId === cardId ? null : cardId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 text-zinc-100 font-bold hover:text-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          Dashboard
        </button>

        <Button
          className="bg-[#00875f] hover:bg-[#00875f]/90 text-white font-bold"
          onClick={() => {
            setEditingCard(null);
            setModalOpen(true);
          }}
        >
          Novo cartão
        </Button>
      </div>

      <div className="grid gap-4">
        {initialCards.map((card) => (
          <div
            key={card.id}
            className="rounded-lg border border-gray-4 bg-gray-3 overflow-hidden"
          >
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
              style={{ borderLeft: `10px solid ${card.color}` }}
              onClick={() => toggleExpand(card.id)}
            >
              <div className="flex flex-1 items-center gap-4 pr-8">
                <CreditCard className="h-6 w-6 text-zinc-400" />
                <div>
                  <div className="font-semibold text-lg">{card.bank_name}</div>
                  {card.description && (
                    <div className="text-sm text-zinc-500">
                      {card.description}
                    </div>
                  )}
                </div>
                <span className="ml-auto">{card.due_day}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCard ? "Editar Cartão" : "Novo Cartão"}
        className="bg-[#202024] border-none"
      >
        <CardForm
          onClose={() => setModalOpen(false)}
          userId={user.id}
          initialData={editingCard}
        />
      </Modal>

      <Modal
        isOpen={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        title="Nova Compra no Cartão"
        className="bg-[#202024] border-none"
      >
        {selectedCardId && (
          <CardTransactionForm
            onClose={() => setPurchaseModalOpen(false)}
            cardId={selectedCardId}
            userId={user.id}
            currentMonthRef={monthRef}
          />
        )}
      </Modal>
    </div>
  );
}
