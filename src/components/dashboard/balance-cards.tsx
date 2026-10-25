import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Landmark, PiggyBank } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { summarizeBalances } from "@/lib/pluggy/balances";
import type { Balance } from "@/types";

interface BalanceCardsProps {
  balances: Balance[];
}

interface BalanceCardProps {
  title: string;
  icon: ReactNode;
  total: number;
  byInstitution: { institution: string; amount: number }[];
  emptyText: string;
  updatedLabel: string | null;
}

function BalanceCard({
  title,
  icon,
  total,
  byInstitution,
  emptyText,
  updatedLabel,
}: BalanceCardProps) {
  return (
    <Card className="bg-[#323238] border-none text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-normal text-zinc-300">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-3xl font-bold text-white">
          {formatCurrency(total)}
        </div>
        {byInstitution.length === 0 ? (
          <p className="text-sm text-zinc-500">{emptyText}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {byInstitution.map((row) => (
              <li key={row.institution} className="flex justify-between gap-4">
                <span className="text-zinc-400">{row.institution}</span>
                <span className="tabular-nums text-zinc-300">
                  {formatCurrency(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {updatedLabel && (
          <p className="text-xs text-zinc-500">{updatedLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

// Balances are today's, independent of the selected month
export function BalanceCards({ balances }: BalanceCardsProps) {
  const { accounts, investments } = summarizeBalances(balances);
  const lastUpdate = balances
    .map((b) => b.updatedAt)
    .sort()
    .at(-1);
  const updatedLabel = lastUpdate
    ? `Atualizado em ${format(parseISO(lastUpdate), "dd/MM 'às' HH:mm", { locale: ptBR })}`
    : null;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <BalanceCard
        title="Em conta"
        icon={<Landmark className="h-8 w-8 text-zinc-300" />}
        total={accounts.total}
        byInstitution={accounts.byInstitution}
        emptyText="Nenhum saldo em conta."
        updatedLabel={updatedLabel}
      />
      <BalanceCard
        title="Investido"
        icon={<PiggyBank className="h-8 w-8 text-[#00b37e]" />}
        total={investments.total}
        byInstitution={investments.byInstitution}
        emptyText="Nenhum investimento ativo."
        updatedLabel={updatedLabel}
      />
    </div>
  );
}
