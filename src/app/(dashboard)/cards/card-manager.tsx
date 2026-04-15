"use client";

import { ChevronLeft, CreditCard, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteCardAction } from "@/app/actions/cards";
import { CardForm } from "@/components/cards/card-form";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Modal } from "@/components/ui/modal";
import type { Card } from "@/types";

interface CardManagerProps {
  initialCards: Card[];
}

export function CardManager({ initialCards }: CardManagerProps) {
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<Card | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (card: Card) => {
    setCardToDelete(card);
    setConfirmationOpen(true);
  };

  const confirmDelete = async () => {
    if (!cardToDelete) return;
    setIsDeleting(true);

    const result = await deleteCardAction(cardToDelete.id);

    if (result.success) {
      setConfirmationOpen(false);
      toast.success("Cartão excluído com sucesso!");
    } else {
      toast.error(result.error || "Erro ao excluir o cartão.");
    }

    setIsDeleting(false);
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
        {initialCards.length === 0 && (
          <div className="text-zinc-500 text-center py-6">
            Você ainda não possui cartões cadastrados.
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCard ? "Editar Cartão" : "Novo Cartão"}
        className="bg-[#202024] border-none"
      >
        <CardForm
          onClose={() => setModalOpen(false)}
          initialData={editingCard}
        />
      </Modal>

      <ConfirmationModal
        isOpen={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir cartão"
        description={`Tem certeza que deseja excluir o cartão "${cardToDelete?.bankName}"?`}
        confirmText={isDeleting ? "Excluindo..." : "Excluir"}
        variant="danger"
      />
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
              <div className="font-semibold text-lg">{card.bankName}</div>
              {card.description && (
                <div className="text-sm text-zinc-500">{card.description}</div>
              )}
            </div>
            Vence dia {card.dueDay}
          </div>
        </div>
      </div>
    </div>
  );
}
