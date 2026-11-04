// @vitest-environment jsdom
import React from "react";
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BookPreview } from "../../client/components/BookPreview.jsx";
import { Modal } from "../../client/components/Modal.jsx";
import { makeDocument, makePage } from "../../shared/document.mjs";
import { browserMocks } from "./browser-mocks.js";
let doc;
beforeEach(() => {
  browserMocks({ reducedMotion: true });
  doc = makeDocument();
  doc.pages.push(makePage("grid"), makePage("story"));
  const product = doc.pages[1].blocks.find((b) => b.type === "product").product;
  Object.assign(product, {
    name: "Draft product",
    description: "Current draft description",
    images: ["image-a", "image-b"],
    url: "https://example.com/product",
  });
});
afterEach(cleanup);
test("Escape closes only the top product dialog and preserves its parent preview", () => {
  const closePreview = vi.fn();
  render(
    <Modal title="Book preview" onClose={closePreview}>
      <BookPreview doc={doc} />
    </Modal>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Next preview page" }));
  fireEvent.click(
    screen.getByRole("button", { name: "View Draft product details" }),
  );
  fireEvent(
    screen.getByRole("dialog", { name: "Draft product" }),
    new Event("cancel", { cancelable: true, bubbles: false }),
  );
  expect(screen.queryByRole("dialog", { name: "Draft product" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Book preview" }).open).toBe(true);
  expect(closePreview).not.toHaveBeenCalled();
});
test("preview renders current draft and switches between spreads and scroll mode", () => {
  const { container } = render(<BookPreview doc={doc} />);
  fireEvent.click(screen.getByRole("button", { name: "Next preview page" }));
  expect(container.querySelector(".book-viewer").dataset.visiblePages).toBe(
    "2,3",
  );
  fireEvent.click(screen.getByRole("button", { name: "Scroll view" }));
  expect(
    container.querySelector(".book-viewer").classList.contains("flow"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Book view" }));
  expect(container.querySelector(".book-viewer").dataset.visiblePages).toBe(
    "2,3",
  );
});
test("preview product dialog exposes the draft description and switches gallery images", () => {
  render(<BookPreview doc={doc} />);
  fireEvent.click(screen.getByRole("button", { name: "Next preview page" }));
  fireEvent.click(
    screen.getByRole("button", { name: "View Draft product details" }),
  );
  expect(screen.getByRole("dialog", { name: "Draft product" }).open).toBe(true);
  expect(screen.getByText("Current draft description")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "View image 2" }));
  expect(
    document.querySelector(".preview-product > img").getAttribute("src"),
  ).toBe("/api/assets/image-b");
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
test("preview sound control persists without allocating audio until a page turn", () => {
  const Audio = vi.fn();
  vi.stubGlobal("AudioContext", Audio);
  render(<BookPreview doc={doc} />);
  fireEvent.click(screen.getByRole("button", { name: "Mute flip sound" }));
  expect(localStorage.getItem("flipbook-sound")).toBe("off");
  fireEvent.click(screen.getByRole("button", { name: "Next preview page" }));
  expect(Audio).not.toHaveBeenCalled();
  expect(
    screen
      .getByRole("button", { name: "Enable flip sound" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});
