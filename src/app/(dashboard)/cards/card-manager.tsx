"use client";

import { ChevronLeft, CreditCard, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CardForm } from "@/components/cards/card-form";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type { Card, User } from "@/types";

interface CardManagerProps {
  user: User;
  initialCards: Card[];
}

export function CardManager({
  user,
  initialCards,
}: CardManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const handleDelete = async (card: Card) => {
    if (confirm(`Tem certeza que deseja excluir o cartão ${card.bank_name}?`)) {
      const { error } = await supabase.from("cards").delete().eq("id", card.id);
      if (!error) router.refresh();
    }
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
          <CardItem
            key={card.id}
            card={card}
            onEdit={(card) => {
              setEditingCard(card);
              setModalOpen(true);
            }}
            onDelete={(card) => handleDelete(card)}
          />
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
    </div>
  );
}

interface CardItemProps {
  card: Card;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
}

function CardItem({ card, onEdit, onDelete }: CardItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-gray-4 bg-gray-3 overflow-hidden relative h-22">
      <div className="absolute top-0 right-0 h-full flex w-32 z-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card);
          }}
          className="flex-1 bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors rounded-r-lg z-2 -mr-4"
        >
          <Trash2 className="h-5 w-5 text-white ml-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(card);
            setIsOpen(false);
          }}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors rounded-r-lg"
        >
          <Pencil className="h-5 w-5 text-white ml-3" />
        </button>
      </div>

      <div
        className={`relative bg-gray-3 rounded-lg z-10 transition-all duration-300 ease-in-out overflow-hidden h-full flex items-center ${
          isOpen ? "w-[calc(100%-7rem)]" : "w-full"
        }`}
      >
        <div
          className="w-full h-full p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
          style={{ borderLeft: `10px solid ${card.color}` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex flex-1 items-center gap-4 pr-8">
            <CreditCard className="h-6 w-6 text-zinc-400" />
            <div>
              <div className="font-semibold text-lg">{card.bank_name}</div>
              {card.description && (
                <div className="text-sm text-zinc-500">{card.description}</div>
              )}
            </div>
            <div className="ml-auto text-sm text-zinc-400">
              Vence dia {card.due_day}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
