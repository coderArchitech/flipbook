// @vitest-environment jsdom
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { BookViewer } from "../../public/book-viewer.js";
import { browserMocks, finishTurn } from "./browser-mocks.js";
let root, viewer, paper, prepared;
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
beforeEach(() => {
  browserMocks();
  document.body.innerHTML =
    "<div><main>" +
    Array.from(
      { length: 6 },
      (_, i) =>
        `<section class="mag-page" data-page-id="${i}">Page ${i}</section>`,
    ).join("") +
    "</main></div>";
  root = document.querySelector("main");
  paper = {
    prepare: vi.fn(
      () =>
        new Promise((resolve) => {
          prepared = resolve;
        }),
    ),
    warm: vi.fn(),
    hide: vi.fn(),
    render: vi.fn(),
    destroy: vi.fn(),
    animate: vi.fn(() => {
      let finish;
      const finished = new Promise((resolve) => {
        finish = resolve;
      });
      return { finished, finish, cancel: vi.fn(finish) };
    }),
  };
  viewer = new BookViewer(root, {
    initialIndex: 1,
    rendererFactory: () => paper,
    onTurn: vi.fn(),
  });
});
afterEach(() => {
  viewer.destroy();
  document.body.replaceChildren();
});
function pointer(type, x, y = 400, extra = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, ...extra });
  root.dispatchEvent(event);
}
test("preparation keeps the original DOM readable, then switches to canvas and commits the queued destination", async () => {
  viewer.next();
  viewer.next();
  expect(viewer.pages[1].hidden).toBe(false);
  expect(viewer.stage.style.visibility).toBe("");
  expect(viewer.requestedIndex).toBe(5);
  prepared();
  await flush();
  expect(viewer.stage.style.visibility).toBe("hidden");
  await finishTurn(viewer);
  prepared();
  await flush();
  await finishTurn(viewer);
  expect(viewer.visible).toEqual([5]);
  expect(viewer.busy).toBe(false);
  expect(viewer.stage.style.visibility).toBe("");
  expect(viewer.pages[5].inert).toBe(false);
});
test("a released drag waits for textures and then commits with one sound", async () => {
  pointer("pointerdown", 700);
  pointer("pointermove", 450);
  expect(viewer.drag.progress).toBeGreaterThan(0.32);
  pointer("pointerup", 450);
  expect(paper.animate).not.toHaveBeenCalled();
  prepared();
  await flush();
  expect(paper.animate).toHaveBeenCalledWith(expect.any(Number), 1);
  await finishTurn(viewer);
  expect(viewer.visible).toEqual([3, 4]);
  expect(viewer.onTurn).toHaveBeenCalledTimes(1);
});
test("pointer cancellation returns to the original spread without a flip sound", async () => {
  pointer("pointerdown", 700);
  pointer("pointermove", 450);
  prepared();
  await flush();
  pointer("pointercancel", 450);
  expect(paper.animate).toHaveBeenCalledWith(expect.any(Number), 0);
  await finishTurn(viewer);
  expect(viewer.visible).toEqual([1, 2]);
  expect(viewer.onTurn).not.toHaveBeenCalled();
});
test("stale texture preparation cannot revive a turn after resize or destroy", async () => {
  viewer.next();
  viewer.next();
  viewer.resize();
  prepared();
  await flush();
  expect(paper.animate).not.toHaveBeenCalled();
  expect(viewer.index).toBe(5);
  expect(viewer.stage.style.visibility).toBe("");
  viewer.go(1);
  viewer.destroy();
  prepared();
  await flush();
  expect(paper.animate).not.toHaveBeenCalled();
  expect(paper.destroy).toHaveBeenCalled();
});
test("context loss restores interactive DOM and subsequent navigation uses the fallback", async () => {
  viewer.next();
  prepared();
  await flush();
  paper.lost = true;
  viewer.lose3D();
  expect(viewer.busy).toBe(false);
  expect(root.dataset.renderer).toBe("css");
  viewer.previous();
  expect(root.querySelector(".book-leaf")).not.toBeNull();
  await finishTurn(viewer);
  expect(viewer.visible).toEqual([1, 2]);
});
test("view configuration preserves the page, mirrors RTL and bounds zoom", () => {
  viewer.configure({
    mode: "2d",
    direction: "rtl",
    binding: "spiral",
    layout: "spread",
  });
  expect(viewer.pages[1].style.left).toBe("794px");
  expect(viewer.pages[2].style.left).toBe("0px");
  root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
  viewer.resize();
  expect(viewer.visible).toEqual([3, 4]);
  viewer.configure({ layout: "single" });
  expect(viewer.visible).toEqual([3]);
  viewer.setZoom(99);
  expect(viewer.zoom).toBe(3);
  viewer.setZoom(-2);
  expect(viewer.zoom).toBe(1);
  viewer.configure({ mode: "scroll" });
  expect(viewer.pages.every((p) => !p.hidden)).toBe(true);
});
test("snapshot failure restores the DOM and performs one fallback turn without replaying sound", async () => {
  paper.prepare.mockRejectedValueOnce(new Error("snapshot failed"));
  viewer.next();
  await flush();
  await flush();
  expect(viewer.state.renderer).toBe("css");
  expect(viewer.stage.style.visibility).toBe("");
  await finishTurn(viewer);
  expect(viewer.visible).toEqual([3, 4]);
  expect(viewer.onTurn).toHaveBeenCalledTimes(1);
});
