// @vitest-environment jsdom
import React, { useState } from "react";
import { test, expect, afterEach, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import {
  RichTextEditor,
  LayersPanel,
  ExtendedBlockFields,
} from "../../client/components/editor/EditorTools.jsx";
import {
  ImportDialog,
  PageDesign,
} from "../../client/components/editor/EditorDialogs.jsx";
import { makeDocument, makePage } from "../../shared/document.mjs";
import { upgradeDocument, newElement } from "../../shared/editor-commands.mjs";
import { api } from "../../client/api.js";
vi.mock("../../client/api.js", () => ({
  api: vi.fn(),
  imageUrl: (id) => "/assets/" + id,
}));
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function documentFixture() {
  const d = upgradeDocument(makeDocument());
  d.pages = [makePage("blank"), makePage("blank")];
  d.pages[0].blocks = [newElement("text")];
  return d;
}
test("selected text formatting survives a subsequent plain-text edit", () => {
  function Harness() {
    const [d, set] = useState(documentFixture);
    const change = (fn) =>
      set((old) => {
        const next = structuredClone(old);
        fn(next);
        return next;
      });
    return (
      <RichTextEditor
        doc={d}
        block={d.pages[0].blocks[0]}
        change={change}
        editBlock={(fn) => change((d) => fn(d.pages[0].blocks[0]))}
      />
    );
  }
  render(<Harness />);
  const words = screen.getByLabelText("Your words");
  fireEvent.change(words, { target: { value: "Bold and normal" } });
  words.focus();
  words.setSelectionRange(0, 4);
  fireEvent.select(words);
  fireEvent.click(screen.getByText("Bold selection"));
  fireEvent.change(words, { target: { value: "Bold and normal!" } });
  expect(words.value).toBe("Bold and normal!");
  // Selecting a different run and clearing marks must not alter any text.
  words.setSelectionRange(5, 15);
  fireEvent.select(words);
  fireEvent.click(screen.getByText("Clear selection marks"));
  expect(words.value).toBe("Bold and normal!");
});
test("layer selection passes additive intent and lock/hide are independent", () => {
  const p = documentFixture().pages[0],
    b = p.blocks[0];
  b.name = "Headline";
  const select = vi.fn();
  render(
    <LayersPanel
      page={p}
      ids={[]}
      select={select}
      changePage={(fn) => fn(p)}
    />,
  );
  fireEvent.click(screen.getByLabelText("Select layer Headline"), {
    shiftKey: true,
  });
  expect(select).toHaveBeenCalledWith(b.id, true);
  fireEvent.click(screen.getByLabelText("Lock layer Headline"));
  expect(b.locked).toBe(true);
  expect(b.hidden).toBeUndefined();
  fireEvent.click(screen.getByLabelText("Hide layer Headline"));
  expect(b.hidden).toBe(true);
});
test("product presentation updates all embedded cards without altering catalog content", () => {
  const d = documentFixture();
  d.pages.forEach((p) => (p.blocks = [newElement("product")]));
  const b = d.pages[0].blocks[0];
  b.product.name = "Original";
  b.presentation = { fields: ["name", "price"], priceColor: "#a12233" };
  render(
    <ExtendedBlockFields
      block={b}
      doc={d}
      editBlock={(fn) => fn(b)}
      change={(fn) => fn(d)}
      pick={() => {}}
    />,
  );
  fireEvent.click(screen.getByText("Apply presentation to all products"));
  expect(d.pages[1].blocks[0].presentation).toEqual(b.presentation);
  expect(d.pages[1].blocks[0].presentation).not.toBe(b.presentation);
  expect(b.product.name).toBe("Original");
});
test("CSV preview exposes bad rows and never submits an invalid catalog", async () => {
  const onError = vi.fn();
  render(
    <ImportDialog
      assets={[]}
      change={() => {}}
      onProducts={() => {}}
      onClose={() => {}}
      onError={onError}
    />,
  );
  fireEvent.change(screen.getByLabelText("CSV data"), {
    target: { value: "Name,Summary,Image\nCup,A cup,missing.png" },
  });
  fireEvent.click(screen.getByText("Preview CSV"));
  expect(screen.getByLabelText("Map name").value).toBe("0");
  expect(screen.getByRole("button", { name: "Import products" }).disabled).toBe(
    true,
  );
  expect(
    screen
      .getAllByRole("alert")
      .map((e) => e.textContent)
      .join(" "),
  ).toContain("Upload the image first");
  expect(api).not.toHaveBeenCalled();
});
test("valid CSV mapping imports independent products and can generate pages", async () => {
  api.mockResolvedValue({ products: [{ content: { name: "Cup" } }], count: 1 });
  const changed = vi.fn(),
    onProducts = vi.fn();
  render(
    <ImportDialog
      assets={[{ id: "image-a", name: "cup.png" }]}
      change={changed}
      onProducts={onProducts}
      onClose={() => {}}
      onError={(e) => {
        throw e;
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText("CSV data"), {
    target: { value: "Name,Summary,Image\nCup,Handmade,cup.png" },
  });
  fireEvent.click(screen.getByText("Preview CSV"));
  fireEvent.click(screen.getByText("Import products"));
  await waitFor(() => expect(onProducts).toHaveBeenCalledTimes(1));
  expect(api.mock.calls[0][1].body.products[0].images).toEqual(["image-a"]);
  fireEvent.click(screen.getByText("Generate product pages"));
  expect(changed).toHaveBeenCalledTimes(1);
});
test("a master is assigned to all pages and editing it remains one shared source", () => {
  function Harness() {
    const [d, set] = useState(documentFixture);
    return (
      <>
        <PageDesign
          doc={d}
          pageIndex={0}
          change={(fn) =>
            set((old) => {
              const next = structuredClone(old);
              fn(next);
              return next;
            })
          }
          pick={() => {}}
          onClose={() => {}}
        />
        <output data-testid="document">{JSON.stringify(d)}</output>
      </>
    );
  }
  render(<Harness />);
  fireEvent.click(screen.getByText("Create master"));
  fireEvent.change(screen.getByLabelText("Master text 1"), {
    target: { value: "Page {{page}} of {{pages}}" },
  });
  fireEvent.click(screen.getByText("Apply master to all pages"));
  const d = JSON.parse(screen.getByTestId("document").textContent);
  expect(d.masters).toHaveLength(1);
  expect(d.pages[0].masterId).toBe(d.pages[1].masterId);
  expect(d.masters[0].blocks[0].text).toBe("Page {{page}} of {{pages}}");
});
