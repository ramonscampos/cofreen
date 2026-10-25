import type { CardBillView } from "@/lib/cards/bill-view";
import type { SyncStatus } from "@/types";
import { CardBillItem } from "./card-bill-item";
import { SyncStatusBar } from "./sync-status-bar";

interface CardBillsSectionProps {
  bills: CardBillView[];
  syncStatus: SyncStatus | null;
}

export function CardBillsSection({ bills, syncStatus }: CardBillsSectionProps) {
  return (
    <section className="space-y-3" aria-labelledby="cards-heading">
      <h2 id="cards-heading" className="text-lg font-bold text-zinc-100">
        Cartões
      </h2>
      <SyncStatusBar status={syncStatus} />
      {bills.length === 0 ? (
        <div className="rounded-md bg-[#29292e] px-4 py-6 text-center text-sm text-zinc-500">
          Nenhum cartão sincronizado.
        </div>
      ) : (
        <div className="grid gap-2">
          {bills.map((bill) => (
            <CardBillItem key={bill.card.id} bill={bill} />
          ))}
        </div>
      )}
    </section>
  );
}
