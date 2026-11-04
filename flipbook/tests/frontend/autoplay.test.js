// @vitest-environment jsdom
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoPlay } from "../../public/reader-navigation.js";
let viewer, play;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  viewer = { state: { canNext: true }, busy: false, next: vi.fn() };
  play = new AutoPlay(viewer);
});
afterEach(() => {
  play.stop();
  vi.useRealTimers();
});
test("autoplay is opt-in, skips busy turns and stops at the end", () => {
  vi.advanceTimersByTime(8000);
  expect(viewer.next).not.toHaveBeenCalled();
  play.start();
  play.start();
  viewer.busy = true;
  vi.advanceTimersByTime(4000);
  expect(viewer.next).not.toHaveBeenCalled();
  viewer.busy = false;
  vi.advanceTimersByTime(4000);
  expect(viewer.next).toHaveBeenCalledTimes(1);
  viewer.state.canNext = false;
  vi.advanceTimersByTime(4000);
  expect(play.running).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
test("hidden tabs and explicit stop cancel future advances", () => {
  play.start();
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  vi.advanceTimersByTime(4000);
  expect(play.running).toBe(false);
  expect(viewer.next).not.toHaveBeenCalled();
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  play.start();
  play.stop();
  vi.advanceTimersByTime(8000);
  expect(viewer.next).not.toHaveBeenCalled();
});
