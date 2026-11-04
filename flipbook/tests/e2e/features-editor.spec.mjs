// One acceptance case per implemented editor feature (EDITOR_DELIVERY.md).
// Each case drives the real editor controls, then checks the persisted draft,
// the published reader and, where the feature has a PDF form, the export.
import sharp from "sharp";
import { test, expect, waitJob } from "./fixtures.mjs";
import { upgradeDocument, newElement } from "../../shared/editor-commands.mjs";
import { makePage } from "../../shared/document.mjs";
import { ICONS } from "../../shared/icons.mjs";
import {
  CUSTOM_WOFF,
  CUSTOM_WOFF2,
  CUSTOM_POSTSCRIPT,
} from "../font-fixture.mjs";

const saved = (page) =>
  expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
const close = (page) =>
  page
    .getByRole("button", { name: "Close dialog", exact: true })
    .last()
    .click();
const add = (page, type) =>
  page
    .locator(".insert-toolbar")
    .getByRole("button", { name: type, exact: true })
    .click();
const layer = (page, name) =>
  page.getByRole("button", { name: `Select layer ${name}`, exact: true });
const goToPage = (page, n) =>
  page.getByRole("button", { name: `Select page ${n}`, exact: true }).click();
const selectedCount = (page) => page.locator(".selection-tools > span").first();
const el = (type, rect, extra = {}) => ({
  ...newElement(type, rect),
  ...extra,
});
const text = (name, rect, extra = {}) =>
  el("text", rect, { name, text: name, ...extra });

async function seed(studio, publication, pages) {
  const document = upgradeDocument(publication.document);
  document.pages = pages.map((blocks) => {
    const p = makePage("blank");
    p.blocks = blocks;
    return p;
  });
  await studio.mutate(
    `/api/publications/${publication.id}/draft`,
    { document, revision: publication.revision },
    "put",
  );
  return document;
}
async function current(studio, publication) {
  return (
    await (await studio.api.get(`/api/publications/${publication.id}`)).json()
  ).document;
}
async function publishLive(studio, publication) {
  const pub = await (
    await studio.api.get(`/api/publications/${publication.id}`)
  ).json();
  const job = await studio.mutate(
    `/api/publications/${publication.id}/publish`,
    { revision: pub.revision },
  );
  await waitJob(studio, job.id);
}
async function exportPdf(studio, publication) {
  const job = await studio.mutate(
    `/api/publications/${publication.id}/export`,
    {},
  );
  await waitJob(studio, job.id);
  const bytes = await (
    await studio.api.get("/api/jobs/" + job.id + "/download")
  ).body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  return bytes.toString("latin1");
}
async function openReader(page, publication) {
  const reader = await page.context().newPage();
  await reader.goto("/m/" + publication.slug);
  await expect(reader.locator("#magazine")).toBeVisible();
  return reader;
}
async function selectWords(page, start, end) {
  const box = page.getByLabel("Your words");
  await box.evaluate(
    (node, [s, e]) => {
      node.focus();
      node.setSelectionRange(s, e);
    },
    [start, end],
  );
  await box.press("Shift");
}
async function setRange(locator, value) {
  await locator.evaluate((node, v) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(node, String(v));
    node.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}
async function assets(studio) {
  return (await studio.api.get("/api/assets")).json();
}

test("E01 rich text: inline marks, colors, links, lists and spacing reach editor, reader and PDF", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [text("Copy", [0, 0, 12, 10], { text: "Alpha beta gamma\nDelta" })],
  ]);
  const id = doc.pages[0].blocks[0].id;
  await page.goto("/#/edit/" + publication.id);
  await layer(page, "Copy").click();
  await selectWords(page, 6, 10);
  await page
    .getByRole("button", { name: "Italic selection", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Underline selection", exact: true })
    .click();
  await selectWords(page, 11, 16);
  await page.getByLabel("Selection color", { exact: true }).fill("#aa2200");
  await selectWords(page, 17, 22);
  await page
    .getByLabel("Selection link (HTTPS)", { exact: true })
    .fill("https://example.com/delta");
  await page
    .getByRole("button", { name: "Link selected words", exact: true })
    .click();
  await page
    .getByLabel("Paragraph style", { exact: true })
    .selectOption("bullet");
  await page.getByLabel("Line spacing", { exact: true }).fill("1.8");
  await page.getByLabel("Letter spacing", { exact: true }).fill("2");

  const canvas = page.locator(
    `.canvas-native [data-block-id="${id}"] .mag-text`,
  );
  await expect(canvas.locator("em u, u em").first()).toHaveText("beta");
  await expect(canvas.locator('span[style*="color:#aa2200"]')).toHaveText(
    "gamma",
  );
  await expect(canvas.locator("ul li a")).toHaveAttribute(
    "href",
    "https://example.com/delta",
  );
  await expect(canvas).toHaveAttribute("style", /line-height:1\.8/);
  await expect(canvas).toHaveAttribute("style", /letter-spacing:2px/);
  // Plain words outside the selections stay unformatted.
  await expect(canvas.locator("p").first()).toContainText("Alpha");
  await expect(canvas.locator("em")).toHaveCount(1);

  await saved(page);
  await page.reload();
  const persisted = (await current(studio, publication)).pages[0].blocks[0];
  expect(persisted.text).toBe("Alpha beta gamma\nDelta");
  expect(persisted.richText[1].kind).toBe("bullet");
  expect(
    persisted.richText[0].runs.find((r) => r.text === "beta"),
  ).toMatchObject({ italic: true, underline: true });

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  const live = reader.locator(`#magazine [data-block-id="${id}"] .mag-text`);
  await expect(live.locator("em").first()).toHaveText("beta");
  await expect(live.locator("ul li a")).toHaveAttribute(
    "href",
    "https://example.com/delta",
  );
  expect(await exportPdf(studio, publication)).toContain(
    "https://example.com/delta",
  );
});

test("E02 layers: reorder, rename, lock and hide change editing, paint order and publishing", async ({
  page,
  studio,
  publication,
}) => {
  const shape = (name, fill) =>
    el("shape", [2, 2, 6, 6], { name, appearance: { fill, borderWidth: 0 } });
  const doc = await seed(studio, publication, [
    [
      shape("Back", "#aa0000"),
      shape("Middle", "#00aa00"),
      shape("Front", "#0000aa"),
      text("Secret", [0, 20, 6, 4]),
    ],
  ]);
  const [back, middle, , secret] = doc.pages[0].blocks.map((b) => b.id);
  await page.goto("/#/edit/" + publication.id);

  // Panel lists the topmost layer first.
  await expect(page.locator(".layer-row .layer-select").first()).toHaveText(
    "Secret",
  );
  await layer(page, "Back").click();
  await page.getByLabel("Layer order").selectOption("front");
  await expect(page.locator(".layer-row .layer-select").first()).toHaveText(
    "Back",
  );
  await expect(
    page.locator(".canvas-native .mag-block").last(),
  ).toHaveAttribute("data-block-id", back);

  await page.getByLabel("Layer name").fill("Hero shape");
  await expect(layer(page, "Hero shape")).toBeVisible();

  await page
    .getByRole("button", { name: "Lock layer Middle", exact: true })
    .click();
  await layer(page, "Middle").click();
  await expect(page.getByLabel("Shape", { exact: true })).toBeDisabled();
  await page.keyboard.press("Delete");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(layer(page, "Middle")).toBeVisible();

  await page
    .getByRole("button", { name: "Hide layer Secret", exact: true })
    .click();
  await expect(
    page.locator(`.canvas-native [data-block-id="${secret}"]`),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Show layer Secret", exact: true }),
  ).toBeVisible();

  await saved(page);
  await page.reload();
  const blocks = (await current(studio, publication)).pages[0].blocks;
  expect(blocks.at(-1)).toMatchObject({ id: back, name: "Hero shape" });
  const locked = blocks.find((b) => b.id === middle);
  expect(locked.locked).toBe(true);
  expect(locked.rect).toEqual([2, 2, 6, 6]);
  expect(blocks.find((b) => b.id === secret).hidden).toBe(true);

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  await expect(
    reader.locator(`#magazine [data-block-id="${secret}"]`),
  ).toHaveCount(0);
  await expect(
    reader.locator("#magazine .mag-page").first().locator(".mag-block").last(),
  ).toHaveAttribute("data-block-id", back);
});

test("E03 multi-select and groups: shift-select, grouped selection, move together, ungroup and select all", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [
      text("A", [0, 0, 3, 3]),
      text("B", [4, 0, 3, 3]),
      text("C", [0, 10, 3, 3]),
    ],
  ]);
  const [a, b, c] = doc.pages[0].blocks.map((x) => x.id);
  await page.goto("/#/edit/" + publication.id);
  await layer(page, "A").click();
  await layer(page, "B").click({ modifiers: ["Shift"] });
  await expect(selectedCount(page)).toHaveText("2 selected");
  await page.getByRole("button", { name: "Group", exact: true }).click();

  // Selecting one member of a group selects the whole group.
  await layer(page, "C").click();
  await expect(selectedCount(page)).toHaveText("1 selected");
  await layer(page, "A").click();
  await expect(selectedCount(page)).toHaveText("2 selected");

  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  const zone = await page
    .locator(`.canvas-native [data-block-id="${a}"]`)
    .boundingBox();
  await page.mouse.move(zone.x + zone.width / 2, zone.y + zone.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    zone.x + zone.width / 2,
    zone.y + zone.height / 2 + 150,
    {
      steps: 8,
    },
  );
  await page.mouse.up();
  await saved(page);
  let blocks = (await current(studio, publication)).pages[0].blocks;
  const at = (id) => blocks.find((x) => x.id === id);
  expect(at(a).rect[0]).toBe(2);
  expect(at(b).rect[0]).toBe(6);
  expect(at(a).rect[1]).toBeGreaterThan(0);
  expect(at(b).rect[1]).toBe(at(a).rect[1]);
  expect(at(c).rect).toEqual([0, 10, 3, 3]);
  expect(at(a).groupId).toBeTruthy();
  expect(at(b).groupId).toBe(at(a).groupId);

  await page.getByRole("button", { name: "Ungroup", exact: true }).click();
  await page.locator(".canvas-toolbar").click();
  await page.keyboard.press("ControlOrMeta+A");
  await expect(selectedCount(page)).toHaveText("3 selected");
  await saved(page);
  await page.reload();
  blocks = (await current(studio, publication)).pages[0].blocks;
  expect(blocks.every((x) => !x.groupId)).toBeTruthy();
});

test("E04 alignment and guides: align edges, centre on page, distribute gaps and show snap guides", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [
      text("A", [0, 0, 3, 3]),
      text("B", [5, 4, 3, 3]),
      text("C", [9, 12, 3, 3]),
    ],
  ]);
  const [a, b, c] = doc.pages[0].blocks.map((x) => x.id);
  await page.goto("/#/edit/" + publication.id);
  await page.locator(".canvas-toolbar").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.getByLabel("Align selection").selectOption("left");
  await page.getByLabel("Distribute selection").selectOption("y");
  await saved(page);
  let blocks = (await current(studio, publication)).pages[0].blocks;
  const rect = (id) => blocks.find((x) => x.id === id).rect;
  expect([rect(a)[0], rect(b)[0], rect(c)[0]]).toEqual([0, 0, 0]);
  // Span 0..15 with three 3-row blocks leaves two equal 3-row gaps.
  expect(rect(b)[1]).toBe(6);

  // A single selection aligns to the page.
  await layer(page, "C").click();
  await page.getByLabel("Align selection").selectOption("center");
  await page.getByLabel("Align selection").selectOption("bottom");
  await saved(page);
  blocks = (await current(studio, publication)).pages[0].blocks;
  expect(rect(c)).toEqual([4.5, 33, 3, 3]);

  // Dragging near another element's edge shows a guide and snaps to it.
  const box = await page
    .locator(`.canvas-native [data-block-id="${c}"]`)
    .boundingBox();
  // Logical grid: 59.25-unit columns, 7-unit gutter; a 3-column block is 170.75 units wide.
  const column = (box.width / 170.75) * 59.25;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 - column * 4.4,
    box.y + box.height / 2,
    { steps: 10 },
  );
  await expect(page.locator(".snap-guide").first()).toBeVisible();
  await page.mouse.up();
  await saved(page);
  blocks = (await current(studio, publication)).pages[0].blocks;
  expect(rect(c)[0]).toBe(0);
});

test("E05 image editing: drag crop, zoom, rotate, flip, opacity, border, radius and frame", async ({
  page,
  studio,
  publication,
}) => {
  const [asset] = await assets(studio);
  const doc = await seed(studio, publication, [
    [
      el("image", [0, 0, 8, 12], {
        name: "Photo",
        assetId: asset.id,
        alt: "Bowl",
      }),
    ],
  ]);
  const id = doc.pages[0].blocks[0].id;
  await page.goto("/#/edit/" + publication.id);
  await layer(page, "Photo").click();
  await setRange(page.getByLabel("Horizontal focus"), 20);
  await setRange(page.getByLabel("Crop / zoom"), 2);
  const crop = page.getByRole("img", {
    name: "Image crop preview: drag to pan",
  });
  await crop.scrollIntoViewIfNeeded();
  const box = await crop.boundingBox();
  await page.mouse.move(box.x + 120, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 80, { steps: 5 });
  await page.mouse.up();
  await page.getByText("Appearance & transforms", { exact: true }).click();
  await page.getByLabel("Rotation", { exact: true }).fill("15");
  await page.getByLabel("Opacity", { exact: true }).fill("0.6");
  await page.getByLabel("Flip vertically").check();
  await page.getByLabel("Border width", { exact: true }).fill("4");
  await page.getByLabel("Corner radius", { exact: true }).fill("20");
  await page.getByLabel("Image frame").selectOption("ellipse");

  const check = async (block) => {
    await expect(block).toHaveAttribute(
      "style",
      /rotate\(15deg\) scale\(1,-1\)/,
    );
    await expect(block).toHaveAttribute("style", /opacity:0\.6/);
    await expect(block).toHaveAttribute("style", /border:4px solid/);
    await expect(block).toHaveAttribute("style", /border-radius:20px/);
    await expect(block.locator(".image-frame")).toHaveAttribute(
      "style",
      /clip-path:ellipse/,
    );
    await expect(block.locator("img")).toHaveAttribute("style", /scale\(2\)/);
    await expect(block.locator("img")).toHaveAttribute(
      "style",
      /object-position:35% 50%/,
    );
  };
  await check(page.locator(`.canvas-native [data-block-id="${id}"]`));
  await saved(page);
  await page.reload();
  const image = (await current(studio, publication)).pages[0].blocks[0];
  expect(image.crop).toEqual({ x: 35, y: 50, zoom: 2 });
  expect(image.appearance).toMatchObject({
    rotation: 15,
    opacity: 0.6,
    flipY: true,
    borderWidth: 4,
    radius: 20,
    frame: "ellipse",
  });

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  await check(reader.locator(`#magazine [data-block-id="${id}"]`));
  await exportPdf(studio, publication);
});

test("E06 cross-page clipboard: copy, paste, duplicate and cut keep styles and create fresh IDs", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [
      text("Headline", [0, 0, 8, 4], { size: 30 }),
      el("shape", [0, 6, 4, 4], { name: "Star", shape: "star" }),
    ],
    [text("Other", [0, 20, 6, 4])],
  ]);
  const [headline, star] = doc.pages[0].blocks.map((b) => b.id);
  await page.goto("/#/edit/" + publication.id);
  await layer(page, "Headline").click();
  await page.keyboard.press("ControlOrMeta+C");
  await goToPage(page, 2);
  await page.locator(".canvas-toolbar").click();
  await page.keyboard.press("ControlOrMeta+V");
  await expect(layer(page, "Headline")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+D");
  await expect(layer(page, "Headline")).toHaveCount(2);

  await goToPage(page, 1);
  await layer(page, "Star").click();
  await page.keyboard.press("ControlOrMeta+X");
  await expect(layer(page, "Star")).toHaveCount(0);
  await goToPage(page, 2);
  await page.locator(".canvas-toolbar").click();
  await page.keyboard.press("ControlOrMeta+V");
  await expect(layer(page, "Star")).toHaveCount(1);

  await saved(page);
  await page.reload();
  const d = await current(studio, publication);
  const all = d.pages.flatMap((p) => p.blocks);
  expect(new Set(all.map((b) => b.id)).size).toBe(all.length);
  expect(d.pages[0].blocks.map((b) => b.name)).toEqual(["Headline"]);
  const copies = d.pages[1].blocks.filter((b) => b.name === "Headline");
  expect(copies).toHaveLength(2);
  for (const copy of copies) {
    expect(copy.id).not.toBe(headline);
    expect(copy).toMatchObject({ text: "Headline", size: 30 });
  }
  const pastedStar = d.pages[1].blocks.find((b) => b.name === "Star");
  expect(pastedStar).toMatchObject({ type: "shape", shape: "star" });
  expect(pastedStar.id).not.toBe(star);
});

test("E08 page backgrounds: solid with overlay, gradient and cropped image render in reader and PDF", async ({
  page,
  studio,
  publication,
}) => {
  await seed(studio, publication, [
    [text("One", [0, 0, 6, 4])],
    [text("Two", [0, 0, 6, 4])],
    [text("Three", [0, 0, 6, 4])],
  ]);
  await page.goto("/#/edit/" + publication.id);
  const design = () =>
    page
      .getByRole("button", { name: "Page design & brand", exact: true })
      .click();

  await design();
  await page.getByLabel("Background color", { exact: true }).fill("#223344");
  await page.getByLabel("Overlay color", { exact: true }).fill("#ffffff");
  await page.getByLabel("Overlay opacity", { exact: true }).fill("0.3");
  await close(page);

  await goToPage(page, 2);
  await design();
  await page.getByLabel("Background type").selectOption("gradient");
  await page.getByLabel("Background color", { exact: true }).fill("#eee4d2");
  await page.getByLabel("Gradient end color").fill("#c1cfb7");
  await page.getByLabel("Gradient angle").fill("110");
  await close(page);

  await goToPage(page, 3);
  await design();
  await page.getByLabel("Background type").selectOption("image");
  await page
    .getByRole("button", { name: "Choose background image", exact: true })
    .click();
  await page.locator(".asset-grid button").first().click();
  await page.getByLabel("Background zoom", { exact: true }).fill("1.5");
  await close(page);
  await expect(
    page.locator(".canvas-native .page-background img"),
  ).toHaveAttribute("style", /scale\(1\.5\)/);

  await saved(page);
  await page.reload();
  const d = await current(studio, publication);
  expect(d.pages[0].background).toMatchObject({
    type: "solid",
    color: "#223344",
    overlayColor: "#ffffff",
    overlayOpacity: 0.3,
  });
  expect(d.pages[1].background).toMatchObject({
    type: "gradient",
    color2: "#c1cfb7",
    angle: 110,
  });
  expect(d.pages[2].background.assetId).toBeTruthy();

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  const backgrounds = reader.locator("#magazine .mag-page .page-background");
  await expect(backgrounds).toHaveCount(3);
  await expect(backgrounds.nth(0)).toHaveAttribute("style", /#223344/);
  await expect(
    backgrounds.nth(0).locator(".background-overlay"),
  ).toHaveAttribute("style", /opacity:0\.3/);
  await expect(backgrounds.nth(1)).toHaveAttribute(
    "style",
    /linear-gradient\(110deg,#eee4d2,#c1cfb7\)/,
  );
  await expect(backgrounds.nth(2).locator("img")).toHaveCount(1);
  await exportPdf(studio, publication);
});

test("E11 product presentation: field toggles and card styles apply to every product card", async ({
  page,
  studio,
  publication,
}) => {
  const [asset] = await assets(studio);
  const product = (name, sku) =>
    el("product", [0, 0, 6, 14], {
      product: {
        name,
        summary: "Handmade in small batches.",
        description: "",
        price: "20.00",
        currency: "USD",
        sku,
        category: "",
        badge: "New",
        url: "https://example.com/" + sku,
        images: [asset.id],
      },
    });
  const doc = await seed(studio, publication, [
    [
      product("Lamp", "LAMP-1"),
      { ...product("Vase", "VASE-2"), rect: [6, 0, 6, 14] },
    ],
  ]);
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByRole("button", { name: "Select product block", exact: true })
    .first()
    .click();
  await page.getByText("Product presentation", { exact: true }).click();
  await expect(page.getByLabel("Show price", { exact: true })).toBeChecked();
  await page.getByLabel("Show price", { exact: true }).uncheck();
  await page.getByLabel("Show sku", { exact: true }).check();
  await page.getByLabel("Badge color", { exact: true }).fill("#112233");
  await page.getByLabel("Card background", { exact: true }).fill("#fafafa");
  await page
    .getByRole("button", { name: "Apply presentation to all products" })
    .click();
  const cards = page.locator(".canvas-native .product-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.locator(".price")).toHaveCount(0);
  await expect(cards.locator(".product-sku")).toHaveCount(2);

  await saved(page);
  await page.reload();
  const products = (await current(studio, publication)).pages[0].blocks;
  for (const b of products) {
    expect(b.presentation.fields).toContain("sku");
    expect(b.presentation.fields).not.toContain("price");
    expect(b.presentation.badgeColor).toBe("#112233");
  }
  // Presentation is copied; each product keeps its own data.
  expect(products.map((b) => b.product.sku)).toEqual(["LAMP-1", "VASE-2"]);

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  const live = reader.locator("#magazine .product-card");
  await expect(live.locator(".price")).toHaveCount(0);
  await expect(live.locator(".product-sku")).toHaveText([
    "SKU: LAMP-1",
    "SKU: VASE-2",
  ]);
  await expect(live.first()).toHaveAttribute("style", /background:#fafafa/);
  await expect(live.locator(".product-badge").first()).toHaveAttribute(
    "style",
    /background:#112233/,
  );
  await exportPdf(studio, publication);
  expect(doc.pages[0].blocks).toHaveLength(2);
});

test("E12 bulk catalog: invalid rows block import, valid CSV imports atomically and generates pages", async ({
  page,
  studio,
  publication,
}) => {
  const [first, second] = await assets(studio);
  await seed(studio, publication, [[text("Intro", [0, 0, 6, 4])]]);
  const before = (await (await studio.api.get("/api/products")).json()).length;
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByRole("button", { name: "Import catalog", exact: true })
    .click();
  const csv = (middle) =>
    `Title,Summary,Price,SKU,Image\nOak tray,Serving tray,40.00,TRAY,${first.id}\n${middle}\n"Linen cloth, natural",Table linen,18.00,LINEN,${second.id}`;
  await page.getByLabel("CSV data").fill(csv(",Missing a name,12.00,NONAME,"));
  await page.getByRole("button", { name: "Preview CSV", exact: true }).click();
  await page.getByLabel("Map name", { exact: true }).selectOption("0");
  await expect(
    page.getByRole("alert").filter({ hasText: "Row 3: Add a product name" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Import products", exact: true }),
  ).toBeDisabled();

  await page
    .getByLabel("CSV data")
    .fill(csv(`Clay cup,Stoneware cup,9.50,CUP,${first.id}`));
  await page.getByRole("button", { name: "Preview CSV", exact: true }).click();
  await page.getByLabel("Map name", { exact: true }).selectOption("0");
  await expect(page.getByText("3 products ready for preview")).toBeVisible();
  await expect(
    page.locator(".import-table td", { hasText: "Linen cloth, natural" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Import products", exact: true })
    .click();
  await expect(
    page.getByText("Imported 3 products into your catalog."),
  ).toBeVisible();
  await page.getByLabel("Generated page layout").selectOption("feature");
  await page
    .getByRole("button", { name: "Generate product pages", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select page 4", exact: true }),
  ).toBeVisible();

  await saved(page);
  await page.reload();
  const d = await current(studio, publication);
  expect(d.pages).toHaveLength(4);
  const generated = d.pages
    .slice(1)
    .map((p) => p.blocks.filter((b) => b.type === "product"));
  expect(generated.map((g) => g.length)).toEqual([1, 1, 1]);
  expect(generated.map((g) => g[0].product.sku)).toEqual([
    "TRAY",
    "CUP",
    "LINEN",
  ]);
  const catalog = await (await studio.api.get("/api/products")).json();
  expect(catalog.length).toBe(before + 3);
});

test("E14 hotspots: URL, product and page hotspots over an image work in reader and PDF", async ({
  page,
  studio,
  publication,
}) => {
  const [asset] = await assets(studio);
  const lamp = el("product", [6, 20, 6, 14], {
    name: "Lamp card",
    product: {
      name: "Desk lamp",
      summary: "Warm light.",
      description: "A brass desk lamp.",
      price: "80.00",
      currency: "USD",
      sku: "LAMP",
      category: "",
      badge: "",
      url: "https://example.com/lamp",
      images: [asset.id],
    },
  });
  const doc = await seed(studio, publication, [
    [
      el("image", [0, 0, 12, 18], {
        name: "Hero",
        assetId: asset.id,
        alt: "Room",
      }),
      lamp,
    ],
    [text("Story", [0, 0, 6, 4])],
    [text("Chapter", [0, 0, 6, 4])],
  ]);
  await page.goto("/#/edit/" + publication.id);
  const placeOverHero = async (row) => {
    await page.getByLabel("Column", { exact: true }).fill("1");
    await page.getByLabel("Row", { exact: true }).fill(String(row));
  };
  await add(page, "hotspot");
  await page.getByLabel("Hotspot label", { exact: true }).fill("Shop the room");
  await page.getByLabel("Hotspot URL").fill("https://example.com/shop");
  await placeOverHero(1);
  await add(page, "hotspot");
  await page.getByLabel("Hotspot label", { exact: true }).fill("See the lamp");
  await page.getByLabel("Hotspot destination").selectOption("product");
  await page.getByLabel("Hotspot target").selectOption(lamp.id);
  await placeOverHero(7);
  await add(page, "hotspot");
  await page.getByLabel("Hotspot label", { exact: true }).fill("Read chapter");
  await page.getByLabel("Hotspot destination").selectOption("page");
  await page.getByLabel("Hotspot target").selectOption(doc.pages[2].id);
  await placeOverHero(12);
  await saved(page);

  const hotspots = (await current(studio, publication)).pages[0].blocks.filter(
    (b) => b.type === "hotspot",
  );
  expect(hotspots.map((h) => h.action.kind)).toEqual([
    "url",
    "product",
    "page",
  ]);
  // Hotspots overlap the hero image intentionally.
  for (const h of hotspots)
    expect(h.rect[1] + h.rect[3]).toBeLessThanOrEqual(18);

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  await expect(
    reader.getByRole("link", { name: "Shop the room", exact: true }),
  ).toHaveAttribute("href", "https://example.com/shop");
  await reader
    .getByRole("button", { name: "See the lamp", exact: true })
    .click();
  await expect(reader.locator("#product-dialog")).toBeVisible();
  await expect(reader.locator("#product-dialog")).toContainText("Desk lamp");
  await reader.locator("#close-dialog").click();
  await reader.getByRole("link", { name: "Read chapter", exact: true }).click();
  await expect(reader.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    /3/,
  );
  const pdf = await exportPdf(studio, publication);
  expect(pdf).toContain("https://example.com/shop");
});

test("E15 layout warnings: low resolution, missing description, rotation overflow and text overflow focus the layer", async ({
  page,
  studio,
  publication,
}) => {
  await page.goto("/#/assets");
  const tiny = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#c9b9a0" },
  })
    .png()
    .toBuffer();
  await page.locator("input[type=file]").setInputFiles({
    name: "tiny-warning.png",
    mimeType: "image/png",
    buffer: tiny,
  });
  await expect(
    page.getByRole("heading", { name: "tiny-warning.png" }),
  ).toBeVisible();
  const small = (await assets(studio)).find((a) => a.width === 8);
  const [large] = (await assets(studio)).filter((a) => a.width > 1000);
  await seed(studio, publication, [
    [
      el("image", [0, 0, 6, 8], {
        name: "Tiny photo",
        assetId: small.id,
        alt: "Swatch",
      }),
      el("image", [6, 0, 6, 8], {
        name: "Undescribed",
        assetId: (large || small).id,
        alt: "",
      }),
      text("Tilted", [10, 20, 2, 10], { appearance: { rotation: 45 } }),
      text("Long copy", [0, 12, 3, 2], {
        text: "Overflowing words. ".repeat(60),
      }),
    ],
  ]);
  await page.goto("/#/edit/" + publication.id);
  const findings = page.locator(".live-findings");
  await findings.locator("summary").click();
  const finding = (message) =>
    findings.getByRole("button", { name: message, exact: true }).first();
  await expect(
    finding(
      "This image may look soft in print. Use a higher-resolution image.",
    ),
  ).toBeVisible();
  await expect(
    finding("Add an image and description, or mark it decorative."),
  ).toBeVisible();
  await expect(
    finding("Rotated element extends beyond the page."),
  ).toBeVisible();
  await expect(
    finding("Text may overflow. Enlarge the layer or shorten the copy."),
  ).toBeVisible();

  await finding(
    "This image may look soft in print. Use a higher-resolution image.",
  ).click();
  await expect(page.getByLabel("Layer name")).toHaveValue("Tiny photo");
  await finding("Rotated element extends beyond the page.").click();
  await expect(page.getByLabel("Layer name")).toHaveValue("Tilted");

  // Fixing the problem clears its warning.
  await page.getByText("Appearance & transforms", { exact: true }).click();
  await page.getByLabel("Rotation", { exact: true }).fill("0");
  await expect(
    findings.getByRole("button", {
      name: "Rotated element extends beyond the page.",
    }),
  ).toHaveCount(0);
});

test("E16 version history: browse, preview and restore an older revision without losing the newer draft", async ({
  page,
  studio,
  publication,
}) => {
  await page.goto("/#/edit/" + publication.id);
  const title = page.getByLabel("Publication title");
  await title.fill("Version A");
  await saved(page);
  const revA = (
    await (await studio.api.get(`/api/publications/${publication.id}`)).json()
  ).revision;
  await title.fill("Version B");
  await saved(page);
  const revB = (
    await (await studio.api.get(`/api/publications/${publication.id}`)).json()
  ).revision;
  expect(revB).toBeGreaterThan(revA);

  await page
    .getByRole("button", { name: "Draft history", exact: true })
    .click();
  await page
    .getByRole("button", { name: new RegExp(`^Revision ${revA} ·`) })
    .click();
  await expect(
    page.getByRole("heading", { name: `Version A · revision ${revA}` }),
  ).toBeVisible();
  await expect(
    page.locator(".history-preview .mag-block").first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: new RegExp(`^Revision ${revB} ·`) })
    .click();
  await expect(
    page.getByRole("heading", { name: `Version B · revision ${revB}` }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: new RegExp(`^Revision ${revA} ·`) })
    .click();
  await page
    .getByRole("button", { name: `Restore revision ${revA}`, exact: true })
    .click();
  await expect(title).toHaveValue("Version A");
  await saved(page);
  await page.reload();
  await expect(title).toHaveValue("Version A");

  const after = await (
    await studio.api.get(`/api/publications/${publication.id}`)
  ).json();
  expect(after.revision).toBeGreaterThan(revB);
  const history = await (
    await studio.api.get(`/api/publications/${publication.id}/history`)
  ).json();
  const revisions = history.map((r) => r.revision);
  expect(revisions).toEqual(
    expect.arrayContaining([revA, revB, after.revision]),
  );
  const kept = await (
    await studio.api.get(`/api/publications/${publication.id}/history/${revB}`)
  ).json();
  expect(kept.document.title).toBe("Version B");
});

test("E17 custom templates: save a group and a page, then reuse them in this and another publication", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [
      text("Kicker", [0, 0, 6, 3]),
      el("shape", [0, 4, 3, 3], { name: "Badge", shape: "badge" }),
      text("Body", [0, 20, 8, 6]),
    ],
  ]);
  const originals = new Set(doc.pages[0].blocks.map((b) => b.id));
  await page.goto("/#/edit/" + publication.id);
  await layer(page, "Kicker").click();
  await layer(page, "Badge").click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Group", exact: true }).click();
  const library = () =>
    page.getByRole("button", { name: "Reusable designs", exact: true }).click();
  await library();
  await page.getByLabel("Design type").selectOption("group");
  await page.getByLabel("Reusable design name").fill("Kicker pair");
  await page
    .getByRole("button", { name: "Save reusable design", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Apply Kicker pair", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Design type").selectOption("page");
  await page.getByLabel("Reusable design name").fill("Full layout");
  await page
    .getByRole("button", { name: "Save reusable design", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply Full layout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select page 2", exact: true }),
  ).toBeVisible();
  await saved(page);
  let d = await current(studio, publication);
  const sourceGroup = d.pages[0].blocks[0].groupId;
  expect(d.pages).toHaveLength(2);
  expect(d.pages[1].blocks.map((b) => b.name)).toEqual([
    "Kicker",
    "Badge",
    "Body",
  ]);
  expect(d.pages[1].blocks.some((b) => originals.has(b.id))).toBe(false);

  // The library belongs to the account, so another publication can reuse it.
  const other = await studio.mutate(
    `/api/publications/${studio.seed.id}/duplicate`,
    {},
  );
  await page.goto("/#/edit/" + other.id);
  await expect(page.getByLabel("Publication title")).toBeVisible();
  await library();
  await page
    .getByRole("button", { name: "Apply Kicker pair", exact: true })
    .click();
  await expect(layer(page, "Kicker")).toBeVisible();
  await expect(layer(page, "Badge")).toBeVisible();
  await saved(page);
  d = (await (await studio.api.get(`/api/publications/${other.id}`)).json())
    .document;
  const pasted = d.pages[0].blocks.filter((b) =>
    ["Kicker", "Badge"].includes(b.name),
  );
  expect(pasted).toHaveLength(2);
  expect(pasted[0].groupId).toBeTruthy();
  expect(pasted[1].groupId).toBe(pasted[0].groupId);
  expect(pasted[0].groupId).not.toBe(sourceGroup);
  expect(pasted.some((b) => originals.has(b.id))).toBe(false);
});

test("E18 comments and review: element-pinned notes navigate, resolve, reopen and stay private", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [text("Cover title", [0, 0, 8, 4])],
    [text("Inside", [0, 0, 6, 4])],
  ]);
  const anchor = doc.pages[0].blocks[0].id;
  await page.goto("/#/edit/" + publication.id);
  await layer(page, "Cover title").click();
  const review = () =>
    page
      .getByRole("button", { name: "Review & approval", exact: true })
      .click();
  await review();
  await expect(
    page.getByText("New note: page 1 · selected element"),
  ).toBeVisible();
  await page.getByLabel("Review note").fill("Shorten the cover title");
  await page
    .getByRole("button", { name: "Add review note", exact: true })
    .click();
  await expect(
    page.getByText("Shorten the cover title", { exact: true }),
  ).toBeVisible();
  const comments = await (
    await studio.api.get(`/api/publications/${publication.id}/comments`)
  ).json();
  expect(comments[0]).toMatchObject({
    page_id: doc.pages[0].id,
    block_id: anchor,
  });
  await close(page);

  await goToPage(page, 2);
  await review();
  await page.getByRole("button", { name: "Go to note", exact: true }).click();
  await expect(page.getByLabel("Layer name")).toHaveValue("Cover title");
  await expect(page.locator(".page-thumbnail").first()).toHaveClass(/selected/);

  await review();
  await page.getByRole("button", { name: "Resolve note", exact: true }).click();
  await expect(page.locator(".review-note small")).toContainText("Resolved");
  await page.getByRole("button", { name: "Reopen note", exact: true }).click();
  await expect(page.locator(".review-note small")).toContainText("Open");
  await page.getByRole("button", { name: "Resolve note", exact: true }).click();
  await page.getByLabel("Require approval before publishing").check();
  await page
    .getByRole("button", { name: "Approve saved revision", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /Revision \d+ approved/ }),
  ).toBeVisible();
  await close(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open publication" }),
  ).toBeVisible({
    timeout: 30000,
  });
  const reader = await openReader(page, publication);
  await expect(reader.locator("body")).not.toContainText(
    "Shorten the cover title",
  );
});

test("E19 video and audio: native players without autoplay in the reader, poster and link in the PDF", async ({
  page,
  studio,
  publication,
}) => {
  await seed(studio, publication, [[text("Watch", [0, 30, 6, 4])]]);
  await page.goto("/#/edit/" + publication.id);
  await add(page, "media");
  await page
    .getByLabel("Media URL (HTTPS)")
    .fill("http://example.com/film.mp4");
  await page.getByLabel("Media title").fill("Studio film");
  await page.getByLabel("Media description").fill("Inside the workshop.");
  await page
    .getByRole("button", { name: "Choose media poster", exact: true })
    .click();
  await page.locator(".asset-grid button").first().click();
  // An insecure URL is rejected as invalid content, not retried as a network failure.
  await expect(
    page.getByText("Not saved — fix the highlighted issue", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open publication" }),
  ).toHaveCount(0);
  expect(
    (await current(studio, publication)).pages[0].blocks.some(
      (b) => b.type === "media",
    ),
  ).toBe(false);
  await page
    .getByLabel("Media URL (HTTPS)")
    .fill("https://example.com/film.mp4");
  await expect(page.locator(".canvas-native video")).toHaveAttribute(
    "src",
    "https://example.com/film.mp4",
  );
  await saved(page);

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  const video = reader.locator("#magazine video").first();
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).not.toHaveAttribute("autoplay", /.*/);
  await expect(video).toHaveAttribute("poster", /.+/);
  await expect(video).toHaveAttribute("aria-label", "Studio film");
  expect(await video.evaluate((v) => v.paused)).toBe(true);
  await expect(
    reader.locator("#magazine .media-caption").first(),
  ).toContainText("Inside the workshop.");
  expect(await exportPdf(studio, publication)).toContain(
    "https://example.com/film.mp4",
  );
});

async function familyLoaded(target, family) {
  return target.evaluate(async (family) => {
    await document.fonts.load(`20px '${family}'`);
    return [...document.fonts].some(
      (f) => f.family.replace(/["']/g, "") === family && f.status === "loaded",
    );
  }, family);
}
const fontLoaded = (target, id) => familyLoaded(target, "ff-" + id);

test("E07 custom fonts: upload, reject WOFF2, use in brand and text, load in reader and embed in PDF", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [text("Headline", [0, 0, 12, 4], { text: "Typeset by the brand" })],
  ]);
  const id = doc.pages[0].blocks[0].id;
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByRole("button", { name: "Page design & brand", exact: true })
    .click();
  const input = page.getByLabel("Upload font (TTF, OTF or WOFF)");
  await input.setInputFiles(CUSTOM_WOFF2);
  await expect(
    page.getByRole("alert").filter({ hasText: "WOFF2" }),
  ).toBeVisible();
  await input.setInputFiles(CUSTOM_WOFF);
  await expect(
    page.getByText("Instrument Serif Italic is ready to use."),
  ).toBeVisible();
  const [font] = await (await studio.api.get("/api/fonts")).json();
  await page
    .getByLabel("Heading font")
    .selectOption({ label: "Instrument Serif Italic (uploaded)" });
  await close(page);

  await layer(page, "Headline").click();
  await page
    .getByLabel("Text font")
    .selectOption({ label: "Instrument Serif Italic (uploaded)" });
  const canvasText = page.locator(
    `.canvas-native [data-block-id="${id}"] .mag-text`,
  );
  await expect(canvasText).toHaveAttribute(
    "style",
    new RegExp(`ff-${font.id}`),
  );
  expect(await fontLoaded(page, font.id)).toBe(true);
  await saved(page);
  await page.reload();
  const d = await current(studio, publication);
  expect(d.brand.headingFont).toBe(font.value);
  expect(d.pages[0].blocks[0].textStyle.font).toBe(font.value);

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  await expect(
    reader.locator(`#magazine [data-block-id="${id}"] .mag-text`),
  ).toHaveAttribute("style", new RegExp(`ff-${font.id}`));
  expect(await fontLoaded(reader, font.id)).toBe(true);
  expect(await exportPdf(studio, publication)).toMatch(
    new RegExp(`/FontName /[A-Z]{6}\\+${CUSTOM_POSTSCRIPT}`),
  );
});

test("E07 built-in fonts: grouped picker, brand and text fonts load in editor and reader and embed in PDF", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [text("Headline", [0, 0, 12, 4], { text: "Slow mornings" })],
  ]);
  const id = doc.pages[0].blocks[0].id;
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByRole("button", { name: "Page design & brand", exact: true })
    .click();
  const heading = page.getByLabel("Heading font");
  // The worker's studio may also hold fonts uploaded by other tests.
  expect(
    await heading
      .locator("optgroup:not([label=Uploaded])")
      .evaluateAll((groups) =>
        groups.map((g) => [g.label, g.querySelectorAll("option").length]),
      ),
  ).toEqual([
    ["Sans serif", 5],
    ["Serif", 5],
    ["Display", 2],
    ["Handwriting", 1],
    ["Monospace", 1],
  ]);
  await heading.selectOption({ label: "Lora" });
  await page.getByLabel("Body font").selectOption({ label: "Inter" });
  await close(page);

  await layer(page, "Headline").click();
  await page
    .getByLabel("Text font")
    .selectOption({ label: "Playfair Display" });
  const canvasText = page.locator(
    `.canvas-native [data-block-id="${id}"] .mag-text`,
  );
  await expect(canvasText).toHaveAttribute("style", /'Playfair Display'/);
  expect(await familyLoaded(page, "Playfair Display")).toBe(true);
  await saved(page);
  await page.reload();
  const d = await current(studio, publication);
  expect([d.brand.headingFont, d.brand.bodyFont]).toEqual(["lora", "inter"]);
  expect(d.pages[0].blocks[0].textStyle.font).toBe("playfair");

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  await expect(
    reader.locator(`#magazine [data-block-id="${id}"] .mag-text`),
  ).toHaveAttribute("style", /'Playfair Display'/);
  expect(await familyLoaded(reader, "Playfair Display")).toBe(true);
  expect(await familyLoaded(reader, "Inter")).toBe(true);
  expect(await exportPdf(studio, publication)).toMatch(
    /\/FontName \/[A-Z]{6}\+PlayfairDisplay-Regular/,
  );
});

test("E09 master margins: guides, out-of-margin warning, margin alignment and non-printing output", async ({
  page,
  studio,
  publication,
}) => {
  const doc = await seed(studio, publication, [
    [text("Inside", [2, 4, 4, 4]), text("Stray", [0, 30, 4, 6])],
  ]);
  const stray = doc.pages[0].blocks[1].id;
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByRole("button", { name: "Page design & brand", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create master", exact: true })
    .click();
  for (const [side, value] of [
    ["left", "1"],
    ["right", "1"],
    ["top", "2"],
    ["bottom", "2"],
  ])
    await page.getByLabel(`Margin ${side}`, { exact: true }).fill(value);
  await close(page);

  const guide = page.locator(".canvas-native .margin-guide");
  await expect(guide).toBeVisible();
  const findings = page.locator(".live-findings");
  await findings.locator("summary").click();
  const warning = findings.getByRole("button", {
    name: "Element is outside the master page margins.",
    exact: true,
  });
  await expect(warning).toHaveCount(1);
  await warning.click();
  await expect(page.getByLabel("Layer name")).toHaveValue("Stray");

  await page.getByLabel("Align selection").selectOption("left");
  await page.getByLabel("Align selection").selectOption("bottom");
  await expect(warning).toHaveCount(0);
  await saved(page);
  await page.reload();
  const d = await current(studio, publication);
  expect(d.masters[0].margins).toEqual({
    left: 1,
    right: 1,
    top: 2,
    bottom: 2,
  });
  expect(d.pages[0].blocks.find((b) => b.id === stray).rect).toEqual([
    1, 28, 4, 6,
  ]);

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  await expect(reader.locator(".margin-guide")).toHaveCount(0);
  await exportPdf(studio, publication);
});

test("E10 icon library: search, choose, colour and weight an icon that renders in reader and PDF", async ({
  page,
  studio,
  publication,
}) => {
  await seed(studio, publication, [[text("Care", [0, 20, 6, 4])]]);
  await page.goto("/#/edit/" + publication.id);
  await add(page, "icon");
  await page.getByLabel("Search icons").fill("zzz");
  await expect(page.getByText("No icons match.")).toBeVisible();
  await page.getByLabel("Search icons").fill("lea");
  await page
    .getByRole("button", { name: "Use leaf icon", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Use leaf icon", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Icon color", { exact: true }).fill("#336633");
  await page.getByLabel("Line weight", { exact: true }).fill("3");
  await page
    .getByLabel("Icon description (optional)", { exact: true })
    .fill("Eco friendly");
  const icon = page.locator(".canvas-native svg.mag-icon");
  await expect(icon.locator("path")).toHaveCount(ICONS.leaf.length);
  await expect(icon).toHaveAttribute("stroke", "#336633");
  await expect(icon).toHaveAttribute("stroke-width", "3");
  await saved(page);
  await page.reload();
  const block = (await current(studio, publication)).pages[0].blocks.find(
    (b) => b.type === "icon",
  );
  expect(block).toMatchObject({
    icon: "leaf",
    color: "#336633",
    strokeWidth: 3,
    label: "Eco friendly",
  });

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  const live = reader
    .locator("#magazine")
    .getByRole("img", { name: "Eco friendly", exact: true });
  await expect(live).toBeVisible();
  await expect(live.locator("path")).toHaveCount(ICONS.leaf.length);
  await exportPdf(studio, publication);
});

test("E13 multi-image product cards: thumbnails and grid layouts show several images in editor, reader and PDF", async ({
  page,
  studio,
  publication,
}) => {
  const ids = (await assets(studio)).map((a) => a.id);
  const pick = (i) => ids[i % ids.length];
  const product = (name, images, rect) =>
    el("product", rect, {
      product: {
        name,
        summary: "Hand thrown.",
        description: "",
        price: "30.00",
        currency: "USD",
        sku: name.toUpperCase(),
        category: "",
        badge: "",
        url: "https://example.com/" + name,
        images,
      },
    });
  await seed(studio, publication, [
    [
      product("Jug", [pick(0), pick(1), pick(2)], [0, 0, 6, 18]),
      product("Bowl", [pick(1), pick(2)], [6, 0, 6, 18]),
    ],
  ]);
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByRole("button", { name: "Select product block", exact: true })
    .first()
    .click();
  await page.getByText("Product presentation", { exact: true }).click();
  const layout = page.getByLabel("Product image layout");
  await expect(layout).toHaveValue("single");
  const cards = page.locator(".canvas-native .product-card");
  await expect(cards.first().locator(".product-tile")).toHaveCount(0);
  await layout.selectOption("thumbnails");
  await expect(cards.first().locator(".product-tile")).toHaveCount(3);
  await layout.selectOption("grid");
  await expect(cards.first().locator(".product-tile")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Apply presentation to all products" })
    .click();
  await expect(cards.nth(1).locator(".product-tile")).toHaveCount(2);
  // Tiles sit side by side inside the photo area.
  const [a, b] = await Promise.all(
    [0, 1].map((i) =>
      cards.first().locator(".product-tile").nth(i).boundingBox(),
    ),
  );
  expect(b.x).toBeGreaterThan(a.x + a.width - 1);
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);

  await saved(page);
  await page.reload();
  const blocks = (await current(studio, publication)).pages[0].blocks;
  expect(blocks.map((x) => x.presentation.imageLayout)).toEqual([
    "grid",
    "grid",
  ]);

  await publishLive(studio, publication);
  const reader = await openReader(page, publication);
  await expect(
    reader.locator("#magazine .product-card .product-tile"),
  ).toHaveCount(5);
  await expect(
    reader.locator("#magazine .product-tile img").nth(1),
  ).toHaveAttribute("alt", "Jug view 2");
  await exportPdf(studio, publication);
});
