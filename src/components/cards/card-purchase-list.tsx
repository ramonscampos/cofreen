import { format, parse } from "date-fns";
import type { CardPurchaseView } from "@/lib/cards/bill-view";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CardPurchaseListProps {
  purchases: CardPurchaseView[];
}

const formatDay = (date: string | null) =>
  date ? format(parse(date, "yyyy-MM-dd", new Date()), "dd/MM") : "-";

export function CardPurchaseList({ purchases }: CardPurchaseListProps) {
  if (purchases.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Nenhuma compra nesta fatura.</p>
    );
  }

  return (
    <div className="text-sm">
      <div className="grid grid-cols-[4fr_1fr_2fr_2fr] gap-4 px-2 pb-2 text-zinc-500">
        <span>Descrição</span>
        <span>Data</span>
        <span>Categoria</span>
        <span className="text-right">Valor</span>
      </div>
      <ul className="divide-y divide-zinc-800">
        {purchases.map((purchase) => (
          <li
            key={purchase.id}
            className={cn(
              "grid grid-cols-[4fr_1fr_2fr_2fr] gap-4 px-2 py-2 items-center",
              purchase.isForecast && "text-zinc-500",
            )}
          >
            <span className="flex items-center gap-2 overflow-hidden">
              <span
                className={cn(
                  "truncate",
                  purchase.isForecast ? "text-zinc-400" : "text-zinc-200",
                )}
              >
                {purchase.description}
              </span>
              {purchase.installmentTotal && purchase.installmentTotal > 1 && (
                <span className="shrink-0 text-xs text-zinc-500">
                  {purchase.installmentCurrent}/{purchase.installmentTotal}
                </span>
              )}
              {purchase.isForecast && (
                <span className="shrink-0 rounded border border-dashed border-zinc-600 px-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
                  previsto
                </span>
              )}
            </span>
            <span className="text-zinc-500">{formatDay(purchase.date)}</span>
            <span className="truncate text-zinc-400">{purchase.category}</span>
            <span
              className={cn(
                "text-right tabular-nums",
                purchase.amount < 0 ? "text-[#00b37e]" : "text-zinc-200",
                purchase.isForecast && "text-zinc-400",
              )}
            >
              {formatCurrency(purchase.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
