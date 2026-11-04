export const PAGE = {
  width: 794,
  height: 1123,
  padding: 45,
  gap: 7,
  columns: 12,
  rows: 36,
};
export function rectangle(rect) {
  const cw = (PAGE.width - 2 * PAGE.padding + PAGE.gap) / PAGE.columns,
    rh = (PAGE.height - 2 * PAGE.padding + PAGE.gap) / PAGE.rows;
  return {
    x: PAGE.padding + rect[0] * cw,
    y: PAGE.padding + rect[1] * rh,
    width: rect[2] * cw - PAGE.gap,
    height: rect[3] * rh - PAGE.gap,
  };
}
