"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { deleteTemplateAction } from "@/app/actions/templates";
import { TemplateForm } from "@/components/templates/template-form";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { Modal } from "@/components/ui/modal";
import type { RecurringTemplate } from "@/types";

interface TemplateManagerProps {
  initialTemplates: RecurringTemplate[];
}

export function TemplateManager({ initialTemplates }: TemplateManagerProps) {
  const _router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<RecurringTemplate | null>(null);

  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] =
    useState<RecurringTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = (template: RecurringTemplate) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const handleDelete = (template: RecurringTemplate) => {
    setTemplateToDelete(template);
    setConfirmationOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);

    const result = await deleteTemplateAction(templateToDelete.id);

    if (result.success) {
      toast.success("Modelo excluído com sucesso!");
      setConfirmationOpen(false);
    } else {
      toast.error(result.error || "Erro ao excluir modelo");
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Modelos Fixos / Recorrentes</h1>
        <Button
          type="button"
          onClick={() => {
            setEditingTemplate(null);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo Fixo
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {initialTemplates.length === 0 && (
          <div className="col-span-full text-center py-10 text-zinc-500">
            Nenhum modelo cadastrado. Crie um para gerar previsões mensais
            automáticas.
          </div>
        )}
        {initialTemplates.map((template) => (
          <div
            key={template.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${template.kind === "incoming" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}
                >
                  {template.kind === "incoming" ? "Entrada" : "Despesa"}
                </span>
                Dia {template.dayOfMonth}
              </div>
              <div className="font-semibold text-lg">
                {template.description}
              </div>
              <div className="text-xl font-bold mt-1 text-zinc-200">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(Number(template.defaultAmount))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-800">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleEdit(template)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-400"
                onClick={() => handleDelete(template)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTemplate ? "Editar Modelo" : "Novo Recorrente"}
      >
        <TemplateForm
          onClose={() => setModalOpen(false)}
          initialData={editingTemplate}
        />
      </Modal>

      <ConfirmationModal
        isOpen={confirmationOpen}
        onClose={() => setConfirmationOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir modelo"
        description={`Tem certeza que deseja excluir o modelo "${templateToDelete?.description}"? Isso não afetará transações passadas.`}
        confirmText={isDeleting ? "Excluindo..." : "Excluir"}
        variant="danger"
      />
    </div>
  );
}
