export const PAPER_WIDTH = 794,
  PAPER_HEIGHT = 1123;
export const clamp = (n, low = 0, high = 1) =>
  Math.max(low, Math.min(high, Number(n) || 0));

/** Arc-length-preserving cylindrical bend, with a small corner-dependent twist. */
export function paperPoint(
  u,
  v,
  progress,
  { direction = 1, hard = false, corner = 0.5 } = {},
) {
  const p = clamp(progress),
    envelope = Math.sin(Math.PI * p);
  const bend = hard ? 0 : 1.35 * envelope * (1 + 0.35 * (v - clamp(corner)));
  const angle =
    Math.PI * p + (hard ? 0 : 0.42 * envelope * (v - 0.5) * (corner - 0.5) * 2);
  let x, z;
  if (Math.abs(bend) < 0.00001) {
    x = PAPER_WIDTH * u * Math.cos(angle);
    z = PAPER_WIDTH * u * Math.sin(angle);
  } else {
    const start = angle - bend * 0.6,
      end = start + bend * u;
    x = (PAPER_WIDTH * (Math.sin(end) - Math.sin(start))) / bend;
    z = (PAPER_WIDTH * (Math.cos(start) - Math.cos(end))) / bend;
  }
  return { x: x * direction, y: (v - 0.5) * PAPER_HEIGHT, z: Math.max(0, z) };
}

export function releaseTarget(progress, velocity = 0, cancelled = false) {
  return !cancelled &&
    (progress >= 0.32 || (progress > 0.05 && velocity > 0.45))
    ? 1
    : 0;
}
export function turnDuration(from, to) {
  return Math.max(140, Math.round(720 * Math.abs(to - from)));
}
export function bookOffset(visible, count, rtl = false, single = false) {
  if (single) return (-PAPER_WIDTH / 2) * (rtl ? -1 : 1);
  if (visible.length !== 1) return 0;
  return (((visible[0] === 0 ? -1 : 1) * PAPER_WIDTH) / 2) * (rtl ? -1 : 1);
}
