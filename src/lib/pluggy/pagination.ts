export interface CursorPage<T> {
  results: T[];
  next: string | null;
}

// Pluggy v2 cursor pagination: `next` is a ready-made query string to append
export async function collectCursorPages<T>(
  fetchPage: (query: string) => Promise<CursorPage<T>>,
  initialQuery: string,
): Promise<T[]> {
  const results: T[] = [];
  let query: string | null = initialQuery;
  while (query) {
    const page: CursorPage<T> = await fetchPage(query);
    results.push(...page.results);
    query = page.next;
  }
  return results;
}
