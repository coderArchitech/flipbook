// Page 1 is the front cover. Interior spreads are 2–3, 4–5, … .
export function visiblePages(index, count, single = false) {
  if (!count) return [];
  const n = Math.max(0, Math.min(count - 1, Number(index) || 0));
  if (single || n === 0) return [n];
  const first = n % 2 ? n : n - 1;
  return [first, first + 1].filter(i => i < count);
}
export function adjacentPage(index, count, direction, single = false) {
  const spread = visiblePages(index, count, single);
  return Math.max(0, Math.min(count - 1, direction > 0 ? spread.at(-1) + 1 : spread[0] - 1));
}
