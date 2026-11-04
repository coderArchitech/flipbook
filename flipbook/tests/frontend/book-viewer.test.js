// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { BookViewer } from "../../public/book-viewer.js";
import { browserMocks, finishTurn } from "./browser-mocks.js";
let viewer, root;
beforeEach(() => {
  browserMocks();
  document.body.innerHTML =
    '<div style="padding:0"><main>' +
    Array.from(
      { length: 6 },
      (_, i) =>
        `<section class="mag-page" data-page-id="${i}"><button>Product ${i}</button><img src="/${i}.png"></section>`,
    ).join("") +
    "</main></div>";
  root = document.querySelector("main");
});
afterEach(() => {
  viewer?.destroy();
  document.body.replaceChildren();
});

test("cover is alone, adjacent images preload, initial render makes no sound", () => {
  const onTurn = vi.fn();
  viewer = new BookViewer(root, { onTurn });
  expect(viewer.visible).toEqual([0]);
  expect(root.dataset.visiblePages).toBe("1");
  expect(viewer.pages[1].querySelector("img").loading).toBe("eager");
  expect(viewer.pages[3].hidden).toBe(true);
  expect(onTurn).not.toHaveBeenCalled();
});
test("interior turn retains the old stationary page until the two-sided leaf lands", async () => {
  viewer = new BookViewer(root, { initialIndex: 1 });
  const oldLeft = viewer.pages[1],
    newLeft = viewer.pages[3];
  viewer.next();
  expect(oldLeft.hidden).toBe(false);
  expect(newLeft.hidden).toBe(true);
  expect(root.querySelectorAll(".book-leaf-face")).toHaveLength(2);
  expect(root.querySelector(".book-leaf").inert).toBe(true);
  expect(viewer.animation.options.duration).toBe(420);
  expect(
    viewer.animation.frames.every((frame) =>
      Object.keys(frame).every((key) => key === "transform"),
    ),
  ).toBe(true);
  await finishTurn(viewer);
  expect(oldLeft.hidden).toBe(true);
  expect(newLeft.hidden).toBe(false);
  expect(newLeft.inert).toBe(false);
  expect(root.querySelector(".book-leaf")).toBeNull();
});
test("rapid next presses coalesce to the latest bounded destination", async () => {
  const onTurn = vi.fn();
  viewer = new BookViewer(root, { initialIndex: 1, onTurn });
  viewer.next();
  viewer.next();
  viewer.next();
  expect(viewer.requestedIndex).toBe(5);
  expect(viewer.state.canNext).toBe(false);
  await finishTurn(viewer);
  await finishTurn(viewer);
  expect(viewer.visible).toEqual([5]);
  expect(viewer.busy).toBe(false);
  expect(onTurn).toHaveBeenCalledTimes(2);
});
test("reversing direction during a turn preserves the latest requested page", async () => {
  viewer = new BookViewer(root, { initialIndex: 1 });
  viewer.next();
  viewer.previous();
  await finishTurn(viewer);
  await finishTurn(viewer);
  expect(viewer.visible).toEqual([1, 2]);
});
test("reduced motion changes pages instantly and bounds do not trigger sound", () => {
  browserMocks({ reducedMotion: true });
  const onTurn = vi.fn();
  viewer = new BookViewer(root, { onTurn });
  viewer.previous();
  expect(onTurn).not.toHaveBeenCalled();
  viewer.next();
  expect(viewer.visible).toEqual([1, 2]);
  expect(viewer.busy).toBe(false);
  expect(root.querySelector(".book-leaf")).toBeNull();
  expect(onTurn).toHaveBeenCalledTimes(1);
});
test("keyboard navigation ignores interactive descendants", () => {
  browserMocks({ reducedMotion: true });
  viewer = new BookViewer(root);
  root
    .querySelector("button")
    .dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
  expect(viewer.index).toBe(0);
  root.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true }),
  );
  expect(viewer.index).toBe(5);
  root.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
  );
  expect(viewer.index).toBe(0);
});
test("single-page mode, reflow and resize preserve the requested destination", () => {
  browserMocks({ width: 400 });
  viewer = new BookViewer(root, { initialIndex: 1 });
  expect(viewer.visible).toEqual([1]);
  viewer.next();
  viewer.next();
  viewer.resize();
  expect(viewer.index).toBe(3);
  expect(viewer.busy).toBe(false);
  viewer.setFlow(true);
  expect(viewer.pages.every((p) => !p.hidden)).toBe(true);
  viewer.next();
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  viewer.setFlow(false);
  expect(viewer.visible).toEqual([4]);
});
test("vertical swipes and gestures on products do not turn pages", () => {
  browserMocks({ reducedMotion: true });
  viewer = new BookViewer(root);
  const pointer = (node, type, x, y) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1 });
    node.dispatchEvent(event);
  };
  pointer(root, "pointerdown", 300, 100);
  pointer(root, "pointerup", 200, 400);
  expect(viewer.index).toBe(0);
  const product = root.querySelector("button");
  pointer(product, "pointerdown", 300, 100);
  pointer(product, "pointerup", 100, 100);
  expect(viewer.index).toBe(0);
  pointer(root, "pointerdown", 300, 100);
  pointer(root, "pointerup", 100, 100);
  expect(viewer.visible).toEqual([1, 2]);
});
test("destroy cancels animation, removes clones and detaches navigation listeners", () => {
  viewer = new BookViewer(root, { initialIndex: 1 });
  viewer.next();
  const cancel = viewer.animation.cancel;
  viewer.destroy();
  expect(cancel).toHaveBeenCalled();
  expect(root.querySelector(".book-leaf")).toBeNull();
  expect(root.children).toHaveLength(6);
  const index = viewer.index;
  root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home" }));
  expect(viewer.index).toBe(index);
});
