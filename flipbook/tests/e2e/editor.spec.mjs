import { test, expect, waitJob } from "./fixtures.mjs";
import { upgradeDocument, newElement } from "../../shared/editor-commands.mjs";
import { makePage } from "../../shared/document.mjs";
const saved = (page) =>
  expect(page.getByText("All changes saved", { exact: true })).toBeVisible();
const close = (page) =>
  page
    .getByRole("button", { name: "Close dialog", exact: true })
    .last()
    .click();
async function blank(studio, publication) {
  const document = upgradeDocument(publication.document);
  document.pages = [makePage("blank"), makePage("blank")];
  await studio.mutate(
    `/api/publications/${publication.id}/draft`,
    { document, revision: publication.revision },
    "put",
  );
}
async function current(studio, pub) {
  return (await (await studio.api.get(`/api/publications/${pub.id}`)).json())
    .document;
}
const add = (page, type) =>
  page
    .locator(".insert-toolbar")
    .getByRole("button", { name: type, exact: true })
    .click();

test("rich formatting, shared styles, layers, groups, geometry and cross-page clipboard persist", async ({
  page,
  studio,
  publication,
}) => {
  await blank(studio, publication);
  await page.goto("/#/edit/" + publication.id);
  await add(page, "text");
  await page.getByLabel("Your words").fill("A beautiful story");
  await page.getByLabel("Your words").press("ControlOrMeta+A");
  await page
    .getByRole("button", { name: "Bold selection", exact: true })
    .click();
  await expect(page.locator(".canvas-native .mag-text strong")).toHaveText(
    "A beautiful story",
  );
  await page.getByLabel("Layer name").fill("Headline");
  await page.getByText("Named styles", { exact: true }).click();
  await page.getByLabel("New style name").fill("Collection title");
  await page
    .getByRole("button", { name: "Save named style", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplicate selection", exact: true })
    .click();
  await page.getByLabel("Layer name").fill("Subhead");
  await page.getByLabel("Text size", { exact: true }).fill("26");
  await page.getByText("Named styles", { exact: true }).click();
  await page.getByRole("button", { name: "Update shared style" }).click();
  await page
    .getByRole("button", { name: "Select layer Headline", exact: true })
    .click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Group", exact: true }).click();
  await page.getByLabel("Align selection").selectOption("left");
  await page.getByLabel("Layer order").selectOption("front");
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await page
    .getByRole("button", { name: "Select page 2", exact: true })
    .click();
  await page.locator(".canvas-toolbar").click();
  await page.keyboard.press("ControlOrMeta+V");
  await expect(page.locator(".selection-zone")).toHaveCount(2);
  await page.getByRole("button", { name: "Ungroup", exact: true }).click();
  await page
    .getByRole("button", { name: "Lock layer Headline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select layer Headline", exact: true })
    .click();
  await expect(page.getByLabel("Your words")).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock layer Headline", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Hide layer Subhead", exact: true })
    .click();
  await expect(page.locator(".selection-zone")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Show layer Subhead", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select layer Subhead", exact: true })
    .click();
  await page.getByLabel("Column", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await saved(page);
  await page.reload();
  await page
    .getByRole("button", { name: "Select page 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select layer Subhead", exact: true })
    .click();
  await expect(page.getByLabel("Column", { exact: true })).toHaveValue("4");
  const d = await current(studio, publication);
  expect(d.schemaVersion).toBe(2);
  expect(d.pages[0].blocks.every((b) => b.groupId)).toBeTruthy();
  expect(d.pages[1].blocks.every((b) => !b.groupId)).toBeTruthy();
  expect(d.styles[0].size).toBe(26);
  expect(new Set(d.pages.flatMap((p) => p.blocks).map((b) => b.id)).size).toBe(
    4,
  );
});

test("backgrounds, brand, shared masters, reusable templates and library replacement", async ({
  page,
  studio,
  publication,
}) => {
  await blank(studio, publication);
  await page.goto("/#/edit/" + publication.id);
  await add(page, "text");
  await page.getByLabel("Your words").fill("The collection");
  await page
    .getByRole("button", { name: "Page design & brand", exact: true })
    .click();
  await page.getByLabel("Background type").selectOption("gradient");
  await page.getByLabel("Background color", { exact: true }).fill("#eee4d2");
  await page.getByLabel("Gradient end color").fill("#c1cfb7");
  await page.getByLabel("Gradient angle").fill("110");
  await page.getByLabel("Brand accent").fill("#995533");
  await page.getByLabel("Heading font").selectOption("sans");
  await page
    .getByRole("button", { name: "Create master", exact: true })
    .click();
  await page
    .getByLabel("Master text 1", { exact: true })
    .fill("EDITIONS · {{page}} of {{pages}}");
  await page.getByLabel("Master 1 Row").fill("33");
  await page.getByRole("button", { name: "Apply master to all pages" }).click();
  await close(page);
  await expect(
    page
      .locator(".canvas-native .mag-text")
      .filter({ hasText: "EDITIONS · 1 of 2" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reusable designs", exact: true })
    .click();
  await page.getByLabel("Reusable design name").fill("Gradient collection");
  await page
    .getByRole("button", { name: "Save reusable design", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Apply Gradient collection",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Replace Gradient collection", exact: true })
    .click();
  await expect(
    page.getByText("page · revision 2", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Apply Gradient collection", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select page 3", exact: true }),
  ).toBeVisible();
  await saved(page);
  await page.reload();
  const d = await current(studio, publication);
  expect(d.pages).toHaveLength(3);
  expect(d.masters).toHaveLength(2);
  expect(d.pages[2].background.color).toBe("#eee4d2");
  expect(d.brand.accent).toBe("#995533");
});

test("image crop, frame, gallery, shapes, media and internal hotspots publish with PDF", async ({
  page,
  studio,
  publication,
}, info) => {
  await blank(studio, publication);
  await page.goto("/#/edit/" + publication.id);
  const assets = await (await studio.api.get("/api/assets")).json();
  const choose = async (label) => {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.locator(".asset-grid button").first().click();
  };
  await add(page, "image");
  await choose("Choose image");
  await page
    .getByLabel("Image description", { exact: true })
    .fill("Warm ceramic collection");
  await page.getByText("Appearance & transforms", { exact: true }).click();
  await page.getByLabel("Image frame").selectOption("circle");
  await page.getByLabel("Rotation", { exact: true }).fill("8");
  await page.getByLabel("Opacity", { exact: true }).fill("0.9");
  await page.getByLabel("Flip horizontally").check();
  const crop = page.getByRole("img", {
    name: "Image crop preview: drag to pan",
  });
  // The inspector scrolls while editing transforms; raw mouse input needs the preview on screen.
  await crop.scrollIntoViewIfNeeded();
  const box = await crop.boundingBox();
  await page.mouse.move(box.x + 100, box.y + 60);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 80, { steps: 5 });
  await page.mouse.up();
  await add(page, "gallery");
  await choose("Add gallery image");
  await page.getByLabel("Gallery image 1 description").fill("First view");
  await choose("Add gallery image");
  await page.getByLabel("Gallery image 2 description").fill("Second view");
  await page.getByLabel("Gallery columns").fill("2");
  await add(page, "shape");
  await page.getByLabel("Shape", { exact: true }).selectOption("star");
  await page.getByLabel("Layer name").fill("Accent star");
  await add(page, "hotspot");
  await page.getByLabel("Hotspot label", { exact: true }).fill("Go to story");
  await page.getByLabel("Show hotspot label").check();
  await page.getByLabel("Hotspot destination").selectOption("page");
  const d = await current(studio, publication);
  await page.getByLabel("Hotspot target").selectOption(d.pages[1].id);
  await page
    .getByRole("button", { name: "Select page 2", exact: true })
    .click();
  await add(page, "media");
  await page.getByLabel("Media type").selectOption("audio");
  await page.getByLabel("Media title").fill("Studio conversation");
  await page
    .getByLabel("Media description")
    .fill("Listen to the story of the collection.");
  await page
    .getByLabel("Media URL (HTTPS)")
    .fill("https://example.com/story.mp3");
  await choose("Choose media poster");
  await saved(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Open publication" }),
  ).toBeVisible({ timeout: 30000 });
  const doc = await current(studio, publication);
  expect(
    doc.pages[0].blocks.find((b) => b.type === "image").crop.x,
  ).toBeGreaterThan(50);
  expect(
    doc.pages[0].blocks.find((b) => b.type === "gallery").images,
  ).toHaveLength(2);
  const reader = await page.context().newPage();
  await reader.goto("/m/" + publication.slug);
  await reader
    .getByRole("button", { name: "Open gallery image 1: First view" })
    .click();
  await expect(reader.locator("#product-dialog")).toBeVisible();
  await reader.locator("#close-dialog").click();
  await reader.getByRole("link", { name: "Go to story", exact: true }).click();
  await expect(reader.locator("#magazine")).toHaveAttribute(
    "data-visible-pages",
    "2",
  );
  await expect(reader.locator("audio")).toHaveAttribute("preload", "none");
  const job = await studio.mutate(
    `/api/publications/${publication.id}/export`,
    {},
  );
  await waitJob(studio, job.id);
  const response = await studio.api.get("/api/jobs/" + job.id + "/download");
  const bytes = await response.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.toString("latin1")).toContain("https://example.com/story.mp3");
  await page.screenshot({
    path: info.outputPath("expanded-editor.png"),
    fullPage: true,
  });
});

test("CSV mapping, preview, atomic import, generated pages and product presentation persist", async ({
  page,
  studio,
  publication,
}) => {
  await blank(studio, publication);
  await page.goto("/#/edit/" + publication.id);
  const assets = await (await studio.api.get("/api/assets")).json();
  await page
    .getByRole("button", { name: "Import catalog", exact: true })
    .click();
  await page
    .getByLabel("CSV data")
    .fill(
      `Title,Summary,Price,SKU,Image\nStudio bowl,Handmade bowl,24.50,BOWL,${assets[0].id}\nStudio cup,Handmade cup,12.00,CUP,${assets[1].id}`,
    );
  await page.getByRole("button", { name: "Preview CSV", exact: true }).click();
  await page.getByLabel("Map name", { exact: true }).selectOption("0");
  await expect(page.getByText("2 products ready for preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Import products", exact: true })
    .click();
  await expect(
    page.getByText("Imported 2 products into your catalog."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Generate product pages", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select page 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select product block", exact: true })
    .first()
    .click();
  await page.getByText("Product presentation", { exact: true }).click();
  await page.getByLabel("Show sku", { exact: true }).check();
  await page.getByLabel("Show summary", { exact: true }).uncheck();
  await page.getByLabel("Price color", { exact: true }).fill("#a14422");
  await page
    .getByRole("button", { name: "Apply presentation to all products" })
    .click();
  await saved(page);
  await page.reload();
  const d = await current(studio, publication);
  const products = d.pages[2].blocks.filter((b) => b.type === "product");
  expect(products).toHaveLength(2);
  expect(
    products.every(
      (b) =>
        b.presentation.fields.includes("sku") &&
        !b.presentation.fields.includes("summary"),
    ),
  ).toBeTruthy();
  expect(products[0].presentation.priceColor).toBe("#a14422");
});

test("review notes gate publishing, approval expires on edit, and history restores a new draft", async ({
  page,
  studio,
  publication,
}) => {
  await page.goto("/#/edit/" + publication.id);
  await page
    .getByRole("button", { name: "Review & approval", exact: true })
    .click();
  await page.getByLabel("Require approval before publishing").check();
  await page.getByLabel("Review note").fill("Check the cover headline");
  await page
    .getByRole("button", { name: "Add review note", exact: true })
    .click();
  await expect(
    page.getByText("Check the cover headline", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Approve saved revision", exact: true })
    .click();
  await expect(
    page.getByText("Resolve open review notes before approving."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resolve note", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve saved revision", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: /Revision \d+ approved/ }),
  ).toBeVisible();
  await close(page);
  const before = await (
    await studio.api.get(`/api/publications/${publication.id}`)
  ).json();
  await page.getByLabel("Publication title").fill("Changed after approval");
  await saved(page);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByText(
      "Resolve review notes and approve this saved revision before publishing.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Draft history", exact: true })
    .click();
  await page
    .getByRole("button", { name: new RegExp(`^Revision ${before.revision} ·`) })
    .click();
  await page
    .getByRole("button", {
      name: `Restore revision ${before.revision}`,
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Publication title")).toHaveValue(
    before.document.title,
  );
  await saved(page);
  const after = await (
    await studio.api.get(`/api/publications/${publication.id}`)
  ).json();
  expect(after.revision).toBeGreaterThan(before.revision);
  expect(after.liveVersion).toBeNull();
  expect(
    (
      await (
        await studio.api.get(`/api/publications/${publication.id}/approval`)
      ).json()
    ).approved,
  ).toBe(false);
});

test('drag previews snap guides, grouped resizing stays bounded, and live overflow checks focus the layer', async({page,studio,publication})=>{
 const doc=upgradeDocument(publication.document);doc.pages=[makePage('blank')];doc.pages[0].blocks=[1,5,9].map((x,i)=>({...newElement('text',[x,3,3,4]),name:['One','Two','Three'][i],text:['One','Two','Three'][i]}));
 await studio.mutate(`/api/publications/${publication.id}/draft`,{document:doc,revision:publication.revision},'put');await page.goto('/#/edit/'+publication.id);
 const first=page.getByRole('button',{name:'Select text block',exact:true}).first();const box=await first.boundingBox();await page.mouse.move(box.x+30,box.y+35);await page.mouse.down();await page.mouse.move(box.x+30+59.25*.55*2,box.y+35,{steps:10});await expect(page.locator('.snap-guide').first()).toBeVisible();await page.mouse.up();
 await page.getByRole('button',{name:'Select layer Two',exact:true}).click({modifiers:['Shift']});await page.getByRole('button',{name:'Group',exact:true}).click();const handle=page.getByRole('button',{name:'Resize selected block',exact:true}).last();const hb=await handle.boundingBox();await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x+hb.width/2+30,hb.y+hb.height/2+30,{steps:8});await page.mouse.up();await saved(page);const resized=await current(studio,publication);expect(resized.pages[0].blocks[0].rect[3]).toBeGreaterThan(4);expect(resized.pages[0].blocks[1].rect[3]).toBeGreaterThan(4);
 await page.getByRole('button',{name:'Ungroup',exact:true}).click();await page.locator('.canvas-toolbar').click();await page.keyboard.press('ControlOrMeta+A');await page.getByLabel('Distribute selection').selectOption('x');
 await page.getByRole('button',{name:'Select layer One',exact:true}).click();await page.getByLabel('Your words').fill('A deliberately overflowing paragraph. '.repeat(80));await page.locator('.live-findings summary').click();await expect(page.getByRole('button',{name:'Text may overflow. Enlarge the layer or shorten the copy.',exact:true})).toBeVisible();await page.getByRole('button',{name:'Text may overflow. Enlarge the layer or shorten the copy.',exact:true}).click();await expect(page.getByLabel('Layer name')).toHaveValue('One');await page.getByRole('button',{name:'Undo',exact:true}).click();await saved(page);await page.reload();expect((await current(studio,publication)).pages[0].blocks[0].text).toBe('One');
});
