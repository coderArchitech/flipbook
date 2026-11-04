import { test, expect } from "vitest";
import {
  makeDocument,
  makePage,
  block,
  validateDocument,
  assetIds,
  emptyProduct,
} from "../../shared/document.mjs";
import {
  upgradeDocument,
  moveSelection,
  resizeSelection,
  groupSelection,
  ungroupSelection,
  selectionIds,
  reorderLayers,
  alignSelection,
  distributeSelection,
  snappedMove,
  pasteBlocks,
  copyPage,
  copyDocument,
  generateProductPages,
  newElement,
  bounds,
} from "../../shared/editor-commands.mjs";
import {
  paragraphsFromText,
  plainText,
  applyMark,
  replacePlainText,
  setParagraphKind,
} from "../../shared/rich-text.mjs";
import {
  effectivePage,
  styleOf,
  galleryBoxes,
  layoutWarnings,
} from "../../shared/design.mjs";
const page = () => ({
  id: "page",
  title: "Page",
  blocks: [
    block("text", [0, 0, 2, 4], { text: "A" }),
    block("text", [4, 5, 2, 4], { text: "B" }),
    block("text", [9, 10, 3, 4], { text: "C" }),
  ],
});
const doc = () => ({ ...upgradeDocument(makeDocument()), pages: [page()] });

test("schema upgrade is a copy and permits intentional overlap without weakening bounds or legacy checks", () => {
  const original = makeDocument(),
    upgraded = upgradeDocument(original);
  expect(original.schemaVersion).toBe(1);
  expect(upgraded.schemaVersion).toBe(2);
  upgraded.pages[0].blocks[1].rect = [0, 0, 6, 5];
  expect(validateDocument(upgraded)).toEqual([]);
  original.pages[0].blocks[1].rect = [0, 0, 6, 5];
  expect(
    validateDocument(original).some((f) => f.message.includes("overlap")),
  ).toBe(true);
  upgraded.pages[0].blocks[0].rect = [11, 0, 2, 2];
  expect(
    validateDocument(upgraded).some((f) => f.message.includes("inside")),
  ).toBe(true);
});
test("partial formatting preserves text and untouched marks across multiple paragraphs", () => {
  let rich = paragraphsFromText("Hello world\nSecond paragraph");
  rich = applyMark(rich, 6, 18, "bold", true);
  expect(plainText(rich)).toBe("Hello world\nSecond paragraph");
  expect(rich[0].runs).toEqual([
    { text: "Hello " },
    { text: "world", bold: true },
  ]);
  expect(rich[1].runs[0]).toEqual({ text: "Second", bold: true });
  rich = applyMark(rich, 8, 10, "color", "#112233");
  expect(rich[0].runs.find((r) => r.color).text).toBe("rl");
  const edited = replacePlainText(rich, "Hello brave world\nSecond paragraph");
  expect(plainText(edited)).toBe("Hello brave world\nSecond paragraph");
  expect(
    edited[0].runs.some((r) => r.color === "#112233" && r.text === "rl"),
  ).toBe(true);
  expect(setParagraphKind(edited, 0, 5, "bullet").map((p) => p.kind)).toEqual([
    "bullet",
    "paragraph",
  ]);
});
test("group movement clamps as one unit and locked members prevent accidental edits", () => {
  const p = page(),
    ids = p.blocks.slice(0, 2).map((b) => b.id);
  groupSelection(p, ids);
  expect(selectionIds(p, [ids[0]])).toEqual(ids);
  moveSelection(p, [ids[0]], 100, -100);
  expect(p.blocks[1].rect[0] - p.blocks[0].rect[0]).toBe(4);
  expect(bounds(p.blocks.slice(0, 2))).toEqual([6, 0, 6, 9]);
  p.blocks[1].locked = true;
  expect(() => moveSelection(p, [ids[0]], -1, 0)).toThrow("Unlock");
  p.blocks[1].locked = false;
  ungroupSelection(p, [ids[0]]);
  expect(p.blocks.slice(0, 2).every((b) => !b.groupId)).toBe(true);
});
test("group resizing preserves relative position and enforces minimum dimensions", () => {
  const p = page(),
    ids = p.blocks.slice(0, 2).map((b) => b.id);
  resizeSelection(p, ids, 12, 18);
  expect(p.blocks[0].rect).toEqual([0, 0, 4, 8]);
  expect(p.blocks[1].rect).toEqual([8, 10, 4, 8]);
  resizeSelection(p, ids, 0.1, 0.1);
  expect(p.blocks.every((b) => b.rect[2] >= 1 && b.rect[3] >= 1)).toBe(true);
  expect(() => resizeSelection(p, ids, Infinity, 4)).toThrow("finite");
});
test("layer reordering keeps selected order and alignment/distribution follow geometry", () => {
  const p = page(),
    [a, b, c] = p.blocks.map((b) => b.id);
  reorderLayers(p, [a, b], "front");
  expect(p.blocks.map((b) => b.id)).toEqual([c, a, b]);
  reorderLayers(p, [c], "forward");
  expect(p.blocks.map((b) => b.id)).toEqual([a, c, b]);
  alignSelection(p, [b], "center", true);
  expect(p.blocks.find((x) => x.id === b).rect[0]).toBe(5);
  const q = page();
  distributeSelection(
    q,
    q.blocks.map((b) => b.id),
    "x",
  );
  expect(q.blocks[1].rect[0]).toBe(4.5);
  const move = snappedMove(q, [q.blocks[0].id], 4.55, 0);
  expect(move.dx).toBe(4.5);
  expect(move.guides.some((g) => g.axis === "x")).toBe(true);
});
test("paste and page duplication remap IDs, groups and internal destinations without changing originals", () => {
  const p = page();
  groupSelection(
    p,
    p.blocks.slice(0, 2).map((b) => b.id),
  );
  const product = block("product", [0, 20, 6, 10], { product: emptyProduct() });
  p.blocks.push(product, newElement("hotspot", [0, 20, 6, 10]));
  p.blocks.at(-1).action = { kind: "product", blockId: product.id };
  const target = { id: "target", blocks: [] };
  const ids = pasteBlocks(target, p.blocks, { offset: 0 });
  expect(new Set(ids).size).toBe(p.blocks.length);
  expect(ids.some((id) => p.blocks.some((b) => b.id === id))).toBe(false);
  expect(target.blocks.at(-1).action.blockId).toBe(target.blocks.at(-2).id);
  expect(target.blocks[0].groupId).toBe(target.blocks[1].groupId);
  expect(target.blocks[0].groupId).not.toBe(p.blocks[0].groupId);
  p.blocks.at(-1).action = { kind: "page", pageId: p.id };
  const copied = copyPage(p);
  expect(copied.blocks.at(-1).action.pageId).toBe(copied.id);
  expect(p.blocks.at(-1).action.pageId).toBe("page");
});
test("whole publication copies remap cross-page hotspots and master references", () => {
  const d = doc();
  d.pages.push({ ...page(), id: "second" });
  d.masters = [
    {
      id: "m",
      name: "Master",
      blocks: [block("text", [0, 0, 2, 2], { text: "{{page}}" })],
    },
  ];
  d.pages[0].masterId = "m";
  d.pages[0].blocks.push({
    ...newElement("hotspot"),
    action: { kind: "page", pageId: "second" },
  });
  const copy = copyDocument(d);
  expect(copy.pages[0].blocks.at(-1).action.pageId).toBe(copy.pages[1].id);
  expect(copy.pages[0].masterId).toBe(copy.masters[0].id);
  expect(copy.masters[0].id).not.toBe("m");
});
test("style and master edits propagate without mutating the persisted page; hidden layers are omitted", () => {
  const d = doc();
  d.styles = [{ id: "heading", name: "Heading", size: 40, color: "#112233" }];
  const b = d.pages[0].blocks[0];
  b.styleId = "heading";
  b.textStyle = { italic: true };
  expect(styleOf(b, d)).toMatchObject({
    size: 40,
    color: "#112233",
    italic: true,
  });
  d.styles[0].size = 44;
  expect(styleOf(b, d).size).toBe(44);
  d.masters = [
    {
      id: "master",
      name: "Brand",
      blocks: [
        block("text", [0, 32, 12, 2], {
          text: "{{publisher}} · {{page}} / {{pages}}",
        }),
      ],
    },
  ];
  d.pages[0].masterId = "master";
  d.pages[0].blocks[1].hidden = true;
  const effective = effectivePage(d.pages[0], d, 0);
  expect(effective.blocks[0].text).toBe("My studio · 1 / 1");
  expect(effective.blocks).toHaveLength(3);
  expect(d.masters[0].blocks[0].text).toContain("{{page}}");
});
test("asset discovery includes masters, backgrounds, logos, galleries and media posters", () => {
  const d = doc();
  d.brand.logoAssetId = "logo";
  d.pages[0].background = { type: "image", assetId: "background" };
  d.pages[0].blocks.push(
    {
      ...newElement("gallery"),
      images: [{ assetId: "gallery", alt: "Image" }],
    },
    { ...newElement("media"), posterId: "poster" },
  );
  d.masters = [
    {
      id: "m",
      name: "Master",
      blocks: [block("image", [0, 0, 2, 2], { assetId: "master" })],
    },
  ];
  expect(assetIds(d).sort()).toEqual([
    "background",
    "gallery",
    "logo",
    "master",
    "poster",
  ]);
});
test("gallery geometry and quality warnings use the rendered element size", () => {
  const b = {
    ...newElement("gallery"),
    images: [
      { assetId: "a", alt: "A" },
      { assetId: "b", alt: "B" },
      { assetId: "c", alt: "C" },
    ],
  };
  expect(galleryBoxes(b, 200, 100)).toMatchObject([
    { x: 0, y: 0, width: 96, height: 46 },
    { x: 104, y: 0 },
    { x: 0, y: 54 },
  ]);
  const d = doc();
  d.pages[0].blocks = [
    block("image", [0, 0, 12, 36], {
      assetId: "tiny",
      appearance: { rotation: 45 },
    }),
  ];
  const findings = layoutWarnings(d, [{ id: "tiny", width: 100, height: 100 }]);
  expect(findings.some((f) => f.message.includes("resolution"))).toBe(true);
  expect(findings.some((f) => f.message.includes("Rotated"))).toBe(true);
});
test("product page generation is atomic at the page limit and copies independent product values", () => {
  const d = doc(),
    products = Array.from({ length: 5 }, (_, i) => ({
      content: { ...emptyProduct(), name: "Product " + i },
    }));
  generateProductPages(d, products, "grid");
  expect(d.pages).toHaveLength(3);
  expect(d.pages[2].blocks.filter((b) => b.type === "product")).toHaveLength(1);
  d.pages[1].blocks.find((b) => b.type === "product").product.name = "Changed";
  expect(products[0].content.name).toBe("Product 0");
  d.pages = Array.from({ length: 100 }, () => makePage("blank"));
  expect(() => generateProductPages(d, products)).toThrow("100-page");
  expect(d.pages).toHaveLength(100);
});
test("invalid extensions and unsafe rich links return findings instead of being accepted", () => {
  const d = doc();
  const b = d.pages[0].blocks[0];
  b.richText = [
    { kind: "paragraph", runs: [{ text: "A", href: "javascript:alert(1)" }] },
  ];
  expect(validateDocument(d).some((f) => f.message.includes("rich"))).toBe(
    true,
  );
  delete b.richText;
  b.appearance = { opacity: 5, fill: "red;position:fixed" };
  expect(validateDocument(d).length).toBeGreaterThan(0);
  delete b.appearance;
  d.brand.headingFont = "url(https://evil.test)";
  expect(validateDocument(d).some((f) => f.message.includes("font"))).toBe(
    true,
  );
});

test("malformed extension payloads produce findings without throwing in draft or publish validation", () => {
  const variants = [
    { masters: [null] },
    { masters: "bad" },
    { styles: [null] },
    { brand: 42 },
  ];
  for (const variant of variants)
    for (const complete of [false, true])
      expect(
        validateDocument({ ...doc(), ...variant }, complete).length,
      ).toBeGreaterThan(0);
  for (const patch of [
    { type: "gallery", images: "wrong" },
    { type: "gallery", images: [{ alt: 42 }] },
    { type: "media", title: 42, description: 42 },
    { richText: [null] },
    { richText: [{ kind: "paragraph", runs: [null] }] },
  ]) {
    const d = doc();
    Object.assign(d.pages[0].blocks[0], patch);
    for (const complete of [false, true])
      expect(validateDocument(d, complete).length).toBeGreaterThan(0);
  }
});
