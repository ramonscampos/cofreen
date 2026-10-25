import { formatCurrency } from "@/lib/format";

interface CategoryChartProps {
  categories: { category: string; amount: number }[];
  color: string;
}

const MAX_CATEGORIES = 6;

export function CategoryChart({ categories, color }: CategoryChartProps) {
  if (categories.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Sem gastos para categorizar.</p>
    );
  }

  const top = categories.slice(0, MAX_CATEGORIES);
  const rest = categories.slice(MAX_CATEGORIES);
  const rows =
    rest.length > 0
      ? [
          ...top,
          {
            category: "Outros",
            amount: rest.reduce((sum, c) => sum + c.amount, 0),
          },
        ]
      : top;
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const max = Math.max(...rows.map((row) => row.amount));

  return (
    <figure className="space-y-2" aria-label="Gastos por categoria">
      {rows.map((row) => {
        const share = total > 0 ? Math.round((row.amount / total) * 100) : 0;
        return (
          <div
            key={row.category}
            className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 text-sm"
            title={`${row.category}: ${formatCurrency(row.amount)} (${share}%)`}
          >
            <span className="truncate text-zinc-300">{row.category}</span>
            <div className="h-2 rounded-full bg-zinc-800">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${(row.amount / max) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
            <span className="tabular-nums text-zinc-400 whitespace-nowrap">
              {formatCurrency(row.amount)}{" "}
              <span className="text-zinc-500">· {share}%</span>
            </span>
          </div>
        );
      })}
    </figure>
  );
}
