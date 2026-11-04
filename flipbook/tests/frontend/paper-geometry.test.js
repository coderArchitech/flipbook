import { test, expect } from "vitest";
import {
  paperPoint,
  releaseTarget,
  turnDuration,
  bookOffset,
  PAPER_WIDTH as W,
  PAPER_HEIGHT as H,
} from "../../public/paper-geometry.js";

test("paper starts and ends flat with a fixed spine and no discontinuity at the endpoints", () => {
  for (const hard of [true, false])
    for (const v of [0, 0.25, 0.5, 1]) {
      for (const p of [0, 0.1, 0.5, 0.9, 1]) {
        const spine = paperPoint(0, v, p, { hard, corner: 0.85 });
        expect(spine.x).toBeCloseTo(0);
        expect(spine.z).toBeCloseTo(0);
        expect(spine.y).toBeCloseTo((v - 0.5) * H);
      }
      expect(paperPoint(1, v, 0, { hard }).x).toBeCloseTo(W);
      expect(paperPoint(1, v, 1, { hard }).x).toBeCloseTo(-W);
      expect(paperPoint(1, v, 1, { hard }).z).toBeCloseTo(0);
      expect(paperPoint(1, v, 0.99999, { hard }).x).toBeCloseTo(-W, 2);
    }
});
test("soft paper bends while a hard cover stays planar; RTL mirrors the geometry", () => {
  const point = (u, hard) => paperPoint(u, 0.8, 0.4, { hard, corner: 0.85 });
  const rigid = point(1, true),
    rigidMid = point(0.5, true);
  expect(rigid.x).toBeCloseTo(rigidMid.x * 2);
  expect(rigid.z).toBeCloseTo(rigidMid.z * 2);
  const flexible = point(1, false),
    flexibleMid = point(0.5, false);
  expect(Math.abs(flexible.x - flexibleMid.x * 2)).toBeGreaterThan(50);
  const mirrored = paperPoint(1, 0.8, 0.4, { direction: -1, corner: 0.85 });
  expect(mirrored.x).toBe(-flexible.x);
  expect(mirrored.z).toBe(flexible.z);
});
test("geometry stays finite and within one paper length for sampled drag progress", () => {
  for (let p = 0; p <= 1; p += 0.05)
    for (let u = 0; u <= 1; u += 0.1)
      for (const v of [0, 0.5, 1]) {
        const { x, y, z } = paperPoint(u, v, p, { corner: 1 });
        expect([x, y, z].every(Number.isFinite)).toBe(true);
        expect(Math.hypot(x, z)).toBeLessThanOrEqual(W + 0.01);
        expect(z).toBeGreaterThanOrEqual(0);
      }
});
test("release respects distance, flick velocity, cancellations and minimum settle time", () => {
  expect(releaseTarget(0.4)).toBe(1);
  expect(releaseTarget(0.2, 0)).toBe(0);
  expect(releaseTarget(0.1, 0.6)).toBe(1);
  expect(releaseTarget(0.01, 5)).toBe(0);
  expect(releaseTarget(0.9, 2, true)).toBe(0);
  expect(turnDuration(0, 1)).toBe(720);
  expect(turnDuration(0.95, 1)).toBe(140);
  expect(turnDuration(0.4, 0)).toBe(288);
});
test("covers center on either side of the spine and spreads remain centered", () => {
  expect(bookOffset([0], 6)).toBe(-W / 2);
  expect(bookOffset([5], 6)).toBe(W / 2);
  expect(bookOffset([0], 6, true)).toBe(W / 2);
  expect(bookOffset([1, 2], 6)).toBe(0);
});
