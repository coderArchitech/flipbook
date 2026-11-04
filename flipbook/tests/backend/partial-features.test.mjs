import { test, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import * as fontkit from "fontkit";
import { renderPDF } from "../../server/pdf-render.mjs";
import {
  makeDocument,
  makePage,
  uid,
  validateDocument,
  fontIds,
} from "../../shared/document.mjs";
import {
  upgradeDocument,
  newElement,
  snappedMove,
  alignSelection,
} from "../../shared/editor-commands.mjs";
import {
  layoutWarnings,
  marginBox,
  productImageBoxes,
} from "../../shared/design.mjs";
import {
  renderBlockHTML,
  fontFamily,
  fontFaceCSS,
} from "../../shared/editor-render.mjs";
import { ICONS, ICON_NAMES } from "../../shared/icons.mjs";
import {
  CUSTOM_WOFF,
  CUSTOM_POSTSCRIPT,
  woffToTtf,
  pdfOperators,
} from "../font-fixture.mjs";

const fonts = {};
for (const [name, family, weight, style] of [
  ["sans", "dm-sans", 400, "normal"],
  ["sans-bold", "dm-sans", 700, "normal"],
  ["sans-italic", "dm-sans", 400, "italic"],
  ["sans-bold-italic", "dm-sans", 700, "italic"],
  ["serif", "instrument-serif", 400, "normal"],
  ["serif-italic", "instrument-serif", 400, "italic"],
])
  fonts[name + ".woff2"] = resolve(
    `node_modules/@fontsource/${family}/files/${family}-latin-${weight}-${style}.woff2`,
  );
let dir, assets;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "flipbook-partial-"));
  assets = {};
  for (const [id, color] of [
    ["a", "#aa3311"],
    ["b", "#11aa33"],
    ["c", "#3311aa"],
  ]) {
    const path = join(dir, id + ".png");
    await sharp({
      create: { width: 600, height: 600, channels: 3, background: color },
    })
      .png()
      .toFile(path);
    assets[id] = { path, width: 600, height: 600 };
  }
});
afterAll(() => rm(dir, { recursive: true, force: true }));
const doc = () => {
  const d = upgradeDocument(makeDocument("Partial features"));
  d.pages = [makePage("blank")];
  return d;
};
const errors = (d) => validateDocument(d).map((f) => f.message);

test("custom fonts validate by ID shape and are collected from brand, styles, pages and masters", () => {
  const id = uid(),
    other = uid(),
    d = doc();
  d.brand = { headingFont: "custom:" + id, bodyFont: "sans" };
  d.styles = [{ id: "s1", name: "Lead", font: "custom:" + other }];
  const text = newElement("text", [0, 0, 6, 4]);
  text.text = "Hello";
  text.textStyle = { font: "custom:" + id };
  d.pages[0].blocks.push(text);
  d.masters = [
    {
      id: "m1",
      name: "Footer",
      blocks: [
        { ...newElement("text", [0, 33, 12, 2]), textStyle: { font: "serif" } },
      ],
    },
  ];
  expect(errors(d)).toEqual([]);
  expect(fontIds(d).sort()).toEqual([id, other].sort());
  d.brand.headingFont = "custom:../../etc/passwd";
  expect(errors(d)).toContain("Choose an approved brand font.");
  expect(fontFamily("custom:" + id)).toBe(`'ff-${id}','DM Sans',sans-serif`);
  expect(fontFamily("serif")).toContain("Instrument Serif");
  const css = fontFaceCSS([id, "bad id"], (x) => "/fonts/" + x);
  expect(css).toContain(`font-family:'ff-${id}'`);
  expect(css).not.toContain("bad id");
});

test("master margins validate, snap, align and warn only for page content outside them", () => {
  const d = doc(),
    page = d.pages[0],
    master = {
      id: "m1",
      name: "Margins",
      margins: { left: 1, right: 1, top: 2, bottom: 2 },
      blocks: [{ ...newElement("text", [0, 0, 12, 1]), text: "Header" }],
    };
  d.masters = [master];
  page.masterId = "m1";
  const inside = { ...newElement("text", [1, 2, 3, 4]), text: "In" },
    outside = { ...newElement("text", [0, 30, 4, 6]), text: "Out" };
  page.blocks.push(inside, outside);
  expect(errors(d)).toEqual([]);
  expect(marginBox(d, page)).toEqual([1, 2, 10, 32]);
  const warned = layoutWarnings(d).filter((w) =>
    w.message.includes("master page margins"),
  );
  // The master header sits in the margin by design and is not flagged.
  expect(warned.map((w) => w.blockId)).toEqual([outside.id]);

  const snap = snappedMove(page, [outside.id], 0.9, -0.1, {
    margins: marginBox(d, page),
  });
  expect(snap.dx).toBe(1);
  expect(snap.guides).toContainEqual({ axis: "x", position: 1 });
  alignSelection(page, [outside.id], "bottom", marginBox(d, page));
  expect(outside.rect[1]).toBe(28);
  alignSelection(page, [outside.id], "right", marginBox(d, page));
  expect(outside.rect[0]).toBe(7);

  master.margins = { left: 5, right: 0, top: 0, bottom: 0 };
  expect(errors(d)).toContain("Invalid master page margins.");
  master.margins = { left: 1, right: 1, top: 1, bottom: 1, gutter: 1 };
  expect(errors(d)).toContain("Invalid master page margins.");
});

test("icons validate against the library and render stroked paths with an optional accessible name", () => {
  expect(ICON_NAMES.length).toBeGreaterThanOrEqual(40);
  for (const name of ICON_NAMES) expect(ICONS[name].length).toBeGreaterThan(0);
  const d = doc(),
    icon = { ...newElement("icon", [0, 0, 2, 4]), icon: "leaf" };
  d.pages[0].blocks.push(icon);
  expect(errors(d)).toEqual([]);
  let html = renderBlockHTML(icon, d, (x) => x);
  expect(html.match(/<path /g)).toHaveLength(ICONS.leaf.length);
  expect(html).toContain('aria-hidden="true"');
  icon.label = "Eco friendly";
  icon.color = "#336633";
  icon.strokeWidth = 3;
  html = renderBlockHTML(icon, d, (x) => x);
  expect(html).toContain('role="img" aria-label="Eco friendly"');
  expect(html).toContain('stroke="#336633"');
  expect(html).toContain('stroke-width="3"');
  icon.icon = "not-an-icon";
  expect(errors(d)).toContain(
    "Choose a supported icon, color and line weight.",
  );
  icon.icon = "leaf";
  icon.strokeWidth = 9;
  expect(errors(d)).toContain(
    "Choose a supported icon, color and line weight.",
  );
});

test("product image layouts tile several images and fall back to one image", () => {
  expect(productImageBoxes(["a"], "grid")).toHaveLength(1);
  const thumbs = productImageBoxes(["a", "b", "c", "d", "e"], "thumbnails");
  expect(thumbs.map((t) => t.assetId)).toEqual(["a", "b", "c", "d"]);
  expect(thumbs[0]).toMatchObject({ x: 0, y: 0, width: 1 });
  const grid = productImageBoxes(["a", "b", "c"], "grid");
  expect(grid).toHaveLength(3);
  for (const box of [...thumbs, ...grid]) {
    expect(box.x + box.width).toBeLessThanOrEqual(1 + 1e-9);
    expect(box.y + box.height).toBeLessThanOrEqual(1 + 1e-9);
  }
  const d = doc(),
    product = newElement("product", [0, 0, 6, 14]);
  product.product = {
    ...product.product,
    name: "Vase",
    summary: "Glazed.",
    images: ["a", "b", "c"],
  };
  product.presentation = {
    fields: ["image", "name"],
    imageLayout: "thumbnails",
  };
  d.pages[0].blocks.push(product);
  expect(errors(d)).toEqual([]);
  const html = renderBlockHTML(product, d, (x) => "/img/" + x);
  expect(html.match(/class="product-tile"/g)).toHaveLength(3);
  expect(html).toContain('alt="Vase view 2"');
  product.presentation.imageLayout = "carousel";
  expect(errors(d)).toContain("Invalid product image layout.");
});

test("uploaded font fixtures parse like real TTF/WOFF files and carry licence flags", () => {
  const ttf = woffToTtf();
  expect(fontkit.create(ttf).postscriptName).toBe(CUSTOM_POSTSCRIPT);
  const restricted = fontkit.create(woffToTtf(undefined, { fsType: 2 }));
  expect(restricted["OS/2"].fsType.noEmbedding).toBe(true);
});

test("PDF embeds an uploaded font and draws icons and every product tile", async () => {
  const d = doc(),
    id = uid(),
    page = d.pages[0];
  d.brand = { headingFont: "custom:" + id };
  const text = newElement("text", [0, 0, 12, 4]);
  text.text = "Uploaded typeface";
  text.textStyle = { font: "custom:" + id, bold: true };
  const product = newElement("product", [0, 6, 6, 18]);
  product.product = {
    ...product.product,
    name: "Vase",
    summary: "Glazed.",
    images: ["a", "b", "c"],
  };
  product.presentation = { fields: ["image", "name"], imageLayout: "grid" };
  const icon = {
    ...newElement("icon", [8, 6, 2, 4]),
    icon: "circle-check",
    color: "#112233",
    strokeWidth: 2,
  };
  page.blocks.push(text, product, icon);
  const bytes = await renderPDF({
    document: d,
    assets,
    fonts,
    customFonts: { [id]: CUSTOM_WOFF },
  });
  const raw = bytes.toString("latin1");
  expect(raw).toMatch(new RegExp(`/FontName /[A-Z]{6}\\+${CUSTOM_POSTSCRIPT}`));
  const ops = pdfOperators(bytes);
  // Three product tiles plus no other images on the page.
  expect(ops.match(/\/I\d+ Do/g)).toHaveLength(3);
  // Icon strokes use round caps/joins in the icon color (#112233).
  expect(ops).toMatch(
    /2 w\s+1 J\s+1 j\s+\/DeviceRGB CS\s+0\.0666\d* 0\.1333\d* 0\.2 SCN/,
  );
  expect(ops.match(/\nS\n/g)?.length).toBeGreaterThanOrEqual(2);
});

test("letter-spaced PDF text keeps word gaps like CSS letter-spacing", async () => {
  const d = doc(),
    text = newElement("text", [0, 0, 12, 3]);
  text.text = "SLOW LIVING";
  text.size = 20;
  text.textStyle = { font: "sans", letterSpacing: 4 };
  d.pages[0].blocks.push(text);
  const ops = pdfOperators(await renderPDF({ document: d, assets, fonts }));
  // Each word is drawn at its own text matrix; read the x of "SLOW" and "LIVING".
  const xs = [...ops.matchAll(/1 0 0 1 ([\d.]+) [-\d.]+ Tm/g)].map(
    (m) => +m[1],
  );
  const [slow, , living] = xs;
  const PDFDocument = (await import("pdfkit")).default;
  const probe = new PDFDocument();
  probe.registerFont("sans", fonts["sans.woff2"].replace(/woff2$/, "woff"));
  probe.font("sans").fontSize(20);
  // CSS adds 4px after each of the five glyphs in "SLOW " before "LIVING".
  const expected = probe.widthOfString("SLOW ") + 4 * 5;
  expect(living - slow).toBeCloseTo(expected, 1);
});
