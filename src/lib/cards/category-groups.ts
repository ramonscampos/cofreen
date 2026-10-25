export interface CategoryGroup {
  label: string;
  amount: number;
  // Purchase categories this row stands for (several for "Outros")
  members: string[];
}

const OTHERS_LABEL = "Outros";

export function groupCategories(
  categories: { category: string; amount: number }[],
  maxRows: number,
): CategoryGroup[] {
  const top = categories.slice(0, maxRows);
  const rest = categories.slice(maxRows);
  const rows = top.map(({ category, amount }) => ({
    label: category,
    amount,
    members: [category],
  }));
  if (rest.length === 0) return rows;

  // A real "Outros" category in the top rows joins the folded row
  const ownOthers = rows.find((row) => row.label === OTHERS_LABEL);
  const kept = rows.filter((row) => row !== ownOthers);
  const folded = [
    ...(ownOthers ? [ownOthers] : []),
    ...rest.map((c) => ({
      label: c.category,
      amount: c.amount,
      members: [c.category],
    })),
  ];
  return [
    ...kept,
    {
      label: OTHERS_LABEL,
      amount: folded.reduce((sum, row) => sum + row.amount, 0),
      members: folded.flatMap((row) => row.members),
    },
  ];
}
