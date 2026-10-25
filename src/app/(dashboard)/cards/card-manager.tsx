"use client";

import { ChevronLeft, CreditCard, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardForm } from "@/components/cards/card-form";
import { Modal } from "@/components/ui/modal";
import type { Card } from "@/types";

interface CardManagerProps {
  initialCards: Card[];
}

export function CardManager({ initialCards }: CardManagerProps) {
  const router = useRouter();
  const [editingCard, setEditingCard] = useState<Card | null>(null);

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
      </div>

      <div className="grid gap-4">
        {initialCards.map((card) => (
          <div
            key={card.id}
            className="rounded-lg bg-gray-3 h-22 p-4 flex items-center justify-between"
            style={{ borderLeft: `10px solid ${card.color}` }}
          >
            <div className="flex items-center gap-4">
              <CreditCard className="h-6 w-6 text-zinc-400" />
              <div>
                <div className="font-semibold text-lg">{card.bankName}</div>
                <div className="text-sm text-zinc-500">
                  Vence dia {card.dueDay}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingCard(card)}
              className="p-2 rounded-md hover:bg-zinc-700 transition-colors"
              aria-label={`Editar ${card.bankName}`}
            >
              <Pencil className="h-5 w-5 text-zinc-300" />
            </button>
          </div>
        ))}
        {initialCards.length === 0 && (
          <div className="text-zinc-500 text-center py-6">
            Nenhum cartão sincronizado ainda. Os cartões aparecem após a
            primeira sincronização com a Pluggy.
          </div>
        )}
      </div>

      <Modal
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        title="Editar cartão"
        className="bg-[#202024] border-none"
      >
        {editingCard && (
          <CardForm card={editingCard} onClose={() => setEditingCard(null)} />
        )}
      </Modal>
    </div>
  );
}
