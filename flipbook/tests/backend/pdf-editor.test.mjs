import { test, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { renderPDF } from "../../server/pdf-render.mjs";
import { makeDocument, makePage, uid } from "../../shared/document.mjs";
import { upgradeDocument, newElement } from "../../shared/editor-commands.mjs";
const fonts = Object.fromEntries(
  [
    ["sans", "dm-sans", "700-normal"],
    ["sans", "dm-sans", "400-normal"],
  ]
    .slice(1)
    .map(([n, p, f]) => [
      n + ".woff2",
      resolve(`node_modules/@fontsource/${p}/files/${p}-latin-${f}.woff2`),
    ]),
);
for (const [name, family, weight, style] of [
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
  dir = await mkdtemp(join(tmpdir(), "flipbook-pdf-unit-"));
  const path = join(dir, "photo.png");
  await sharp({
    create: { width: 600, height: 800, channels: 3, background: "#ad6233" },
  })
    .png()
    .toFile(path);
  assets = { photo: { path, width: 600, height: 800 } };
});
afterAll(() => rm(dir, { recursive: true, force: true }));
function fixture() {
  const d = upgradeDocument(makeDocument("Expanded editor PDF"));
  d.pages = [makePage("blank"), makePage("blank")];
  return d;
}
test("PDF renders rich runs, shapes, gallery, masters, gradient, crop and internal/media links", async () => {
  const d = fixture(),
    p = d.pages[0],
    q = d.pages[1];
  p.background = {
    type: "gradient",
    color: "#eeddbb",
    color2: "#ccddbb",
    angle: 130,
  };
  const text = newElement("text", [0, 0, 12, 4]);
  text.text = "Rich print\nA linked line";
  text.richText = [
    {
      kind: "bullet",
      runs: [
        { text: "Rich print", bold: true, italic: true, color: "#995533" },
      ],
    },
    {
      kind: "paragraph",
      runs: [
        {
          text: "A linked line",
          href: "https://example.com/text",
          underline: true,
        },
      ],
    },
  ];
  p.blocks.push(text);
  p.blocks.push({
    ...newElement("image", [0, 5, 6, 12]),
    assetId: "photo",
    crop: { x: 60, y: 40, zoom: 1.4 },
    appearance: { frame: "circle", rotation: 5, opacity: 0.8, flipX: true },
  });
  p.blocks.push({
    ...newElement("gallery", [6, 5, 6, 12]),
    images: [
      { assetId: "photo", alt: "One" },
      { assetId: "photo", alt: "Two" },
    ],
    columns: 2,
    gap: 8,
  });
  p.blocks.push({ ...newElement("shape", [0, 18, 3, 5]), shape: "heart" });
  p.blocks.push({
    ...newElement("hotspot", [4, 18, 6, 3]),
    label: "Next",
    action: { kind: "page", pageId: q.id },
    showLabel: true,
  });
  q.blocks.push({
    ...newElement("media", [0, 0, 12, 25]),
    url: "https://example.com/movie.mp4",
    title: "Film",
    description: "A short film.",
    posterId: "photo",
  });
  const master = {
    id: uid(),
    name: "Footer",
    blocks: [
      {
        ...newElement("text", [0, 33, 12, 2]),
        text: "Edition {{page}} / {{pages}}",
        size: 14,
      },
    ],
  };
  d.masters = [master];
  d.pages.forEach((p) => (p.masterId = master.id));
  const bytes = await renderPDF({ document: d, assets, fonts });
  const pdf = bytes.toString("latin1");
  expect(pdf.startsWith("%PDF-")).toBe(true);
  expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(2);
  expect(pdf).toContain("https://example.com/text");
  expect(pdf).toContain("https://example.com/movie.mp4");
  expect(pdf).toContain("/S /GoTo");
  expect(pdf).toContain(q.id);
});
test("rich-text overflow rejects the export with the affected page and block", async () => {
  const d = fixture(),
    b = newElement("text", [0, 0, 2, 1]);
  b.text = "Too much text ".repeat(100);
  d.pages[0].blocks = [b];
  await expect(
    renderPDF({ document: d, assets: {}, fonts }),
  ).rejects.toMatchObject({
    findings: [{ pageId: d.pages[0].id, blockId: b.id }],
  });
});
test("hidden layers do not introduce links into exported PDF", async () => {
  const d = fixture();
  d.pages[0].blocks = [
    {
      ...newElement("button"),
      url: "https://example.com/private",
      hidden: true,
    },
  ];
  const pdf = (await renderPDF({ document: d, assets: {}, fonts })).toString(
    "latin1",
  );
  expect(pdf).not.toContain("https://example.com/private");
});
