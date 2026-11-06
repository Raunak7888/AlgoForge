import type { PageMeta } from "@algoforge/contracts";

/**
 * Cursor pagination helper. Fetch `limit + 1` rows; the extra row only proves another page exists.
 * `nextCursor` is derived from the last row that is actually returned.
 */
export function paginate<T>(rows: readonly T[], limit: number, cursorOf: (row: T) => string): { items: T[]; meta: PageMeta } {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, meta: { hasMore, nextCursor: hasMore && last !== undefined ? cursorOf(last) : null } };
}
