"use client";

import { differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { syncCardsAction } from "@/app/actions/sync";
import { triggerTransactionUpdate } from "@/lib/events";
import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/types";

const CONSENT_WARNING_DAYS = 30;

interface SyncStatusBarProps {
  status: SyncStatus | null;
}

export function SyncStatusBar({ status }: SyncStatusBarProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncCardsAction();
    setSyncing(false);
    if (result.success) {
      toast.success("Cartões sincronizados!");
    } else {
      toast.error(result.error || "Erro ao sincronizar");
    }
    triggerTransactionUpdate();
    router.refresh();
  };

  const lastSuccess = status?.lastSuccessAt
    ? parseISO(status.lastSuccessAt)
    : null;
  const lastError = status?.lastErrorAt ? parseISO(status.lastErrorAt) : null;
  const hasRecentError =
    !!lastError && (!lastSuccess || lastError > lastSuccess);
  const consentExpires = status?.consentExpiresAt
    ? parseISO(status.consentExpiresAt)
    : null;
  const consentExpiring =
    !!consentExpires &&
    differenceInDays(consentExpires, new Date()) <= CONSENT_WARNING_DAYS;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm text-zinc-500">
        <span>
          {lastSuccess
            ? `Atualizado em ${format(lastSuccess, "dd/MM 'às' HH:mm", { locale: ptBR })}`
            : "Ainda não sincronizado"}
        </span>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 text-zinc-300 hover:text-white disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          {syncing ? "Sincronizando..." : "Sincronizar agora"}
        </button>
      </div>
      {hasRecentError && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          Falha na última sincronização: {status?.lastError}
        </p>
      )}
      {consentExpiring && consentExpires && (
        <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          Autorização da Pluggy expira em {format(consentExpires, "dd/MM/yyyy")}
          . Reautorize em dashboard.pluggy.ai.
        </p>
      )}
    </div>
  );
}
