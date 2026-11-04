// Records every scene of the demo plan against a live Flipbook server.
// Frames come from the Chrome DevTools screencast (crisp 1080p JPEGs);
// timeline.json records scene segments, narration starts and page-turn sounds.
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { OUT, FONT } from "./paths.mjs";
import { startServer, waitJob } from "./lib.mjs";
import { seed } from "./build.mjs";
import { launch, routes, devices, CURSOR_SCRIPT } from "./browser.mjs";
import { SCENES } from "./script.mjs";

const durations = JSON.parse(readFileSync(OUT + "/voice/durations.json", "utf8"));
const only = process.argv.find((a) => a.startsWith("--until="))?.slice(8);
const now = () => Date.now() / 1000;
const timeline = { segments: [], voice: [], sfx: [], captures: {} };
const state = {};

class Capture {
  constructor(name) {
    this.name = name;
    this.dir = `${OUT}/frames/${name}`;
    this.frames = [];
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    timeline.captures[name] = this.frames;
  }
  async start(page, size = { maxWidth: 1920, maxHeight: 1080 }) {
    this.cdp = await page.context().newCDPSession(page);
    this.cdp.on("Page.screencastFrame", (f) => {
      const file = `${this.dir}/${String(this.frames.length).padStart(6, "0")}.jpg`;
      writeFileSync(file, Buffer.from(f.data, "base64"));
      this.frames.push({ t: now(), file });
      this.cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1, ...size });
  }
  stop() {
    return this.cdp.send("Page.stopScreencast").catch(() => {});
  }
}

// Human-paced pointer: eased movement, a visible cursor, short pauses.
class Hand {
  constructor(page) {
    this.page = page;
    this.x = 960;
    this.y = 540;
  }
  async point(target, { pause = 250 } = {}) {
    let x, y;
    if (target && typeof target.x === "number" && !target.boundingBox) ({ x, y } = target);
    else {
      await target.scrollIntoViewIfNeeded().catch(() => {});
      const b = await target.boundingBox();
      if (!b) throw Error("No box for target " + target);
      x = b.x + b.width / 2;
      y = b.y + b.height / 2;
    }
    const steps = Math.max(10, Math.min(36, Math.round(Math.hypot(x - this.x, y - this.y) / 22)));
    const sx = this.x, sy = this.y;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps, e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      await this.page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
      await sleep(14);
    }
    this.x = x;
    this.y = y;
    await sleep(pause);
  }
  async click(target, opts = {}) {
    await this.point(target, opts);
    await this.page.mouse.down();
    await sleep(70);
    await this.page.mouse.up();
    await sleep(opts.after ?? 450);
  }
  async type(target, text, { clear = true, delay = 28 } = {}) {
    await this.click(target, { after: 150 });
    if (clear) await target.fill("");
    await this.page.keyboard.type(text, { delay });
    await sleep(300);
  }
  async setNumber(target, value) {
    await this.click(target, { after: 120 });
    await target.fill(String(value));
    await sleep(450);
  }
  async select(target, option) {
    await this.point(target);
    await target.selectOption(option);
    await sleep(600);
  }
  async drag(from, to, { steps = 40, hold = 0, holdAt } = {}) {
    await this.point(from, { pause: 150 });
    await this.page.mouse.down();
    const sx = this.x, sy = this.y;
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      await this.page.mouse.move(sx + (to.x - sx) * k, sy + (to.y - sy) * k);
      if (holdAt && Math.abs(k - holdAt) < 1 / steps / 2) await sleep(hold);
      await sleep(22);
    }
    this.x = to.x;
    this.y = to.y;
    await sleep(250);
    await this.page.mouse.up();
    await sleep(500);
  }
}

let current;
async function scene(id, source, fn) {
  const seg = { id, source, start: now() };
  timeline.segments.push(seg);
  current = id;
  console.log("scene", id);
  await fn();
  await sleep(900);
  seg.end = now();
  writeFileSync(OUT + "/timeline.json", JSON.stringify(timeline));
}
async function beat(i, fn = async () => {}) {
  const key = `${current}_${i}`,
    t = now();
  timeline.voice.push({ key, t });
  await fn();
  const remaining = durations[key] + 0.35 - (now() - t);
  if (remaining > 0) await sleep(remaining * 1000);
}
const flip = (delay = 0.05) => timeline.sfx.push({ t: now() + delay });

const server = await startServer(4312);
const s = await seed(server.url);
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, acceptDownloads: true });
await routes(context, state);
await context.route("https://example.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<title>Shop</title>" }));
await context.addInitScript(CURSOR_SCRIPT);
const [cookieName, ...cookieValue] = s.api.cookie.split("=");
await context.addCookies([{ name: cookieName, value: cookieValue.join("="), url: server.url }]);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("pageerror:", e.message));
const hand = new Hand(page);
const main = new Capture("main");
const role = (name, r = "button") => page.getByRole(r, { name, exact: true });
const label = (name) => page.getByLabel(name, { exact: true });
const layer = (name) => role("Select layer " + name);
const goToPage = (n) => hand.click(role("Select page " + n), { after: 600 });
const saved = () => page.getByText("All changes saved", { exact: true }).waitFor({ timeout: 15000 });
const closeDialog = async () => {
  await hand.click(role("Close dialog").last(), { after: 500 });
};
async function selectWords(text) {
  const box = label("Your words");
  const value = await box.inputValue(),
    start = value.indexOf(text);
  if (start < 0) throw Error("Text not found: " + text);
  await hand.point(box, { pause: 100 });
  await box.evaluate((node, [a, b]) => { node.focus(); node.setSelectionRange(a, b); }, [start, start + text.length]);
  await box.press("Shift");
  await sleep(500);
}
async function setRange(loc, value) {
  await hand.point(loc);
  await loc.evaluate((node, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(node, String(v));
    node.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  await sleep(500);
}
const done = (id) => only && id === only;

try {
  await page.goto(server.url + "/#/");
  await page.getByText("Your publications").waitFor();
  await main.start(page);
  await sleep(800);

  await scene("s02", "main", async () => {
    await beat(0, async () => {
      await hand.point(page.getByRole("button", { name: "Edit Slow Living — The Autumn Edit" }).first(), { pause: 700 });
      await hand.point(role("New publication"));
    });
    await beat(1, async () => {
      await hand.click(role("New publication"));
      await hand.type(page.locator("dialog[open]").getByLabel("Publication title"), "Autumn draft");
      await hand.click(page.locator("dialog[open]").getByRole("button", { name: /Create publication/ }), { after: 1500 });
      for (const t of ["Product grid", "Editorial"]) {
        await hand.click(page.getByRole("button", { name: "Add page", exact: true }).first(), { after: 700 });
        await hand.click(page.locator(".template-picker button").filter({ hasText: t }), { after: 700 });
      }
    });
    await beat(2, async () => {
      await hand.click(role("Move page 3 up"), { after: 700 });
      await hand.click(role("Duplicate page").first(), { after: 700 });
      await hand.click(role("Undo"), { after: 700 });
    });
    await beat(3, async () => {
      await hand.click(role("Back to publications"), { after: 1000 });
      await hand.click(page.getByRole("button", { name: "Edit Slow Living — The Autumn Edit" }).first(), { after: 1500 });
    });
  });
  if (done("s02")) throw "stop";

  await scene("s03", "main", async () => {
    await beat(0, async () => {
      await hand.click(role("Page design & brand"), { after: 600 });
      const upload = page.getByLabel("Upload font (TTF, OTF or WOFF)");
      await hand.point(upload);
      await upload.setInputFiles({ name: "Fraunces-SemiBoldItalic.woff", mimeType: "font/woff", buffer: readFileSync(FONT) });
      await page.getByText("is ready to use.").waitFor();
      await sleep(600);
      await hand.select(label("Heading font"), { label: "Fraunces SemiBold Italic (uploaded)" });
    });
    await beat(1, async () => {
      await closeDialog();
      await hand.point(page.locator(".canvas-native .mag-text").filter({ hasText: "Slow Living" }).first(), { pause: 900 });
    });
    await beat(2, async () => {
      await hand.click(role("Page design & brand"), { after: 600 });
      await hand.select(label("Page master"), { label: "Edition" });
      await hand.point(label("Master name"), { pause: 600 });
    });
    await beat(3, async () => {
      for (const [k, v] of [["left", "0.5"], ["right", "0.5"], ["top", "2"], ["bottom", "2"]])
        await hand.setNumber(label("Margin " + k), v);
      await hand.click(role("Apply master to all pages"), { after: 600 });
      await closeDialog();
      await goToPage(3);
      await hand.point(page.locator(".canvas-native .mag-text").filter({ hasText: "/" }).last(), { pause: 800 });
    });
  });
  // Off camera: keep the cover and closing pages full-bleed.
  for (const n of [1, 9]) {
    await goToPage(n);
    await hand.click(role("Page design & brand"));
    await label("Page master").selectOption("");
    await closeDialog();
  }
  if (done("s03")) throw "stop";

  await goToPage(2);
  await scene("s04", "main", async () => {
    await beat(0, async () => {
      await hand.click(layer("Letter"), { after: 500 });
      await selectWords("properly");
      await hand.click(role("Italic selection"));
      await selectWords("slows down");
      await hand.point(label("Selection color"));
      await label("Selection color").fill("#a24f2f");
      await sleep(400);
      await selectWords("repair promise");
      await hand.type(label("Selection link (HTTPS)"), "https://example.com/repair", { delay: 18 });
      await hand.click(role("Link selected words"));
    });
    await beat(1, async () => {
      await selectWords("Inside this edition");
      await hand.click(role("Bold selection"));
      await selectWords("Objects for the everyday table\nLight for slow evenings\nLinen, naturally");
      await hand.select(label("Paragraph style"), "bullet");
    });
    await beat(2, async () => {
      await hand.click(page.getByText("Named styles", { exact: true }), { after: 400 });
      await hand.type(label("New style name"), "Letter body");
      await hand.click(role("Save named style"));
      await hand.click(layer("Sign-off"), { after: 500 });
      await hand.click(page.getByText("Named styles", { exact: true }), { after: 400 });
      await hand.select(label("Named text style"), { label: "Letter body" });
      await hand.click(layer("Letter"), { after: 500 });
      await hand.setNumber(label("Text size"), "15");
      await hand.click(page.getByText("Named styles", { exact: true }), { after: 400 });
      await hand.click(role("Update shared style"), { after: 700 });
    });
    await beat(3, async () => {
      await hand.click(page.locator(".insert-toolbar").getByRole("button", { name: "icon", exact: true }), { after: 600 });
      await hand.type(label("Search icons"), "leaf", { delay: 70 });
      await hand.click(role("Use leaf icon"));
      await hand.setNumber(label("Column"), "1");
      await hand.setNumber(label("Row"), "26");
    });
  });
  if (done("s04")) throw "stop";

  await scene("s05", "main", async () => {
    await beat(0, async () => {
      await hand.point(page.locator(".canvas-native .mag-icon").first(), { pause: 600 });
    });
    await beat(1, async () => {
      await hand.click(layer("icon"), { after: 300 });
      for (const n of ["Icon truck", "Icon award", "Icon recycle"]) {
        await hand.point(layer(n), { pause: 150 });
        await page.keyboard.down("Shift");
        await page.mouse.down();
        await page.mouse.up();
        await page.keyboard.up("Shift");
        await sleep(350);
      }
      await hand.select(page.getByLabel("Distribute selection"), "x");
      await hand.select(page.getByLabel("Align selection"), "top");
    });
    await beat(2, async () => {
      for (const n of [1, 2, 3, 4]) {
        await hand.point(layer("Caption " + n), { pause: 150 });
        await page.keyboard.down("Shift");
        await page.mouse.down();
        await page.mouse.up();
        await page.keyboard.up("Shift");
        await sleep(250);
      }
      await hand.click(role("Group"), { after: 500 });
      const icon = page.locator(".canvas-native .mag-icon").first();
      const box = await icon.boundingBox();
      const row = box.height / 3.76;
      await hand.drag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: box.x + box.width / 2, y: box.y + box.height / 2 + row * 0.42 }, { steps: 45, holdAt: 0.98, hold: 700 });
    });
    await beat(3, async () => {
      await hand.click(role("Lock layer Headline"), { after: 400 });
      await hand.click(layer("Headline"), { after: 300 });
      await hand.point(page.getByText("This layer is locked. Unlock it in Layers to edit."), { pause: 600 });
    });
  });
  if (done("s05")) throw "stop";

  await goToPage(6);
  await scene("s06", "main", async () => {
    await beat(0, async () => {
      await hand.click(layer("Room"), { after: 500 });
      const crop = page.getByRole("img", { name: "Image crop preview: drag to pan" });
      await crop.scrollIntoViewIfNeeded();
      const b = await crop.boundingBox();
      await hand.drag({ x: b.x + b.width * 0.55, y: b.y + b.height / 2 }, { x: b.x + b.width * 0.47, y: b.y + b.height / 2 }, { steps: 25 });
      await setRange(label("Crop / zoom"), 1.12);
      await hand.click(page.getByText("Appearance & transforms", { exact: true }), { after: 300 });
      await hand.setNumber(label("Rotation"), "-2");
      await hand.setNumber(label("Corner radius"), "16");
    });
    await beat(1, async () => {
      await hand.click(role("Hide layer Lookbook caption"), { after: 900 });
      await hand.click(role("Show layer Lookbook caption"), { after: 500 });
    });
    await beat(2, async () => {
      await hand.click(page.locator(".insert-toolbar").getByRole("button", { name: "hotspot", exact: true }), { after: 600 });
      await hand.type(label("Hotspot label"), "Arc table light details", { delay: 20 });
      await hand.select(label("Hotspot destination"), "product");
      await hand.select(label("Hotspot target"), { label: "Arc table light" });
      for (const [k, v] of [["Column", "2.5"], ["Row", "9.5"], ["Width", "2.5"], ["Height", "4"]]) await hand.setNumber(label(k), v);
    });
    await beat(3, async () => {
      await hand.click(layer("Star badge"), { after: 300 });
      await page.keyboard.press("ControlOrMeta+C");
      await goToPage(4);
      await hand.click(page.locator(".canvas-toolbar"), { after: 200 });
      await page.keyboard.press("ControlOrMeta+V");
      await sleep(400);
      await hand.point(page.locator(".canvas-native .mag-shape").first(), { pause: 600 });
    });
  });
  if (done("s06")) throw "stop";

  await scene("s07", "main", async () => {
    const csv = (f) => readFileSync(`${OUT}/assets/${f}`, "utf8");
    await beat(0, async () => {
      await hand.click(role("Import catalog"), { after: 500 });
      await hand.click(label("CSV data"), { after: 100 });
      await label("CSV data").fill(csv("textiles-missing-image.csv"));
      await sleep(500);
      await hand.click(role("Preview CSV"), { after: 600 });
    });
    await beat(1, async () => {
      await hand.point(page.getByRole("alert").filter({ hasText: /^Row/ }).first(), { pause: 700 });
      await hand.point(role("Import products"), { pause: 500 });
    });
    await beat(2, async () => {
      await hand.click(label("CSV data"), { after: 100 });
      await label("CSV data").fill(csv("textiles.csv"));
      await sleep(400);
      await hand.click(role("Preview CSV"), { after: 700 });
      await hand.point(page.getByText("4 products ready for preview"), { pause: 500 });
      await hand.click(role("Import products"), { after: 900 });
      await page.getByText("Imported 4 products into your catalog.").waitFor();
      await hand.select(label("Generated page layout"), "grid");
      await hand.click(role("Generate product pages"), { after: 800 });
      await goToPage(10);
    });
  });
  // Off camera: move the generated page into position 8 and title it.
  await role("Move page 10 up").click();
  await sleep(300);
  await role("Move page 9 up").click();
  await sleep(300);
  await role("Select page 8").click();
  await layer("text").click();
  await label("Your words").fill("Linen, naturally.");
  await saved();
  if (done("s07")) throw "stop";

  await goToPage(5);
  await scene("s08", "main", async () => {
    await beat(0, async () => {
      await hand.click(layer("Vessel"), { after: 500 });
      await hand.click(page.getByText("Product presentation", { exact: true }), { after: 400 });
    });
    await beat(1, async () => {
      await hand.click(label("Show sku"), { after: 400 });
      await hand.point(label("Price color"));
      await label("Price color").fill("#a24f2f");
      await sleep(400);
      await hand.click(role("Apply presentation to all products"), { after: 900 });
      await hand.point(page.locator(".canvas-native .product-sku").nth(1), { pause: 600 });
    });
    await beat(2, async () => {
      await goToPage(4);
      await hand.click(layer("Vessel card"), { after: 400 });
      await hand.click(page.getByText("Product presentation", { exact: true }), { after: 400 });
      await hand.select(label("Product image layout"), "thumbnails");
      await hand.point(page.locator(".canvas-native .product-tile").first(), { pause: 900 });
      await hand.select(label("Product image layout"), "grid");
      await hand.point(page.locator(".canvas-native .product-tile").nth(3), { pause: 900 });
    });
  });
  await saved();
  if (done("s08")) throw "stop";

  await scene("s09", "main", async () => {
    await beat(0, async () => {
      await hand.click(page.locator(".live-findings summary"), { after: 500 });
    });
    await beat(1, async () => {
      await hand.click(layer("Feature notes"), { after: 300 });
      for (let i = 0; i < 2; i++) { await page.keyboard.press("Shift+ArrowRight"); await sleep(350); }
      await goToPage(2);
      await hand.click(layer("Vessel photo"), { after: 400 });
      await hand.click(role("Replace image"), { after: 600 });
      await hand.click(page.locator(".asset-grid button").filter({ hasText: "vessel-thumbnail-small" }).first(), { after: 900 });
      await hand.point(page.locator(".live-findings button").filter({ hasText: "soft in print" }).first(), { pause: 400 });
      await hand.click(page.locator(".live-findings button").filter({ hasText: "outside the master page margins" }).first(), { after: 900 });
      for (let i = 0; i < 3; i++) await hand.click(role("Undo"), { after: 400 });
    });
    await beat(2, async () => {
      await saved();
      await page.reload();
      await page.getByText("All changes saved", { exact: true }).waitFor();
      await sleep(600);
      await hand.point(page.getByText("All changes saved", { exact: true }), { pause: 400 });
    });
    await beat(3, async () => {
      await hand.click(role("Draft history"), { after: 700 });
      const rows = page.locator("dialog[open] .history-layout section").first().getByRole("button");
      await hand.click(rows.nth(6), { after: 1200 });
      await hand.point(page.getByRole("button", { name: /^Restore revision/ }), { pause: 700 });
      await closeDialog();
    });
  });
  if (done("s09")) throw "stop";

  await goToPage(1);
  await scene("s10", "main", async () => {
    await beat(0, async () => {
      await hand.click(layer("Cover title"), { after: 300 });
      await hand.click(role("Review & approval"), { after: 600 });
      await hand.type(label("Review note"), "Could the title sit a little larger?", { delay: 22 });
      await hand.click(role("Add review note"), { after: 700 });
    });
    await beat(1, async () => {
      await hand.click(role("Resolve note"), { after: 600 });
      await hand.click(page.getByLabel("Require approval before publishing"), { after: 500 });
      await hand.click(role("Approve saved revision"), { after: 900 });
      await page.getByRole("status").filter({ hasText: /approved/ }).waitFor();
      await sleep(600);
      await closeDialog();
    });
    await beat(2, async () => {
      await hand.click(role("Publish"), { after: 300 });
      await page.getByRole("link", { name: "Open publication" }).waitFor({ timeout: 60000 });
      await hand.point(page.getByRole("link", { name: "Open publication" }), { pause: 900 });
    });
  });
  if (done("s10")) throw "stop";

  const pub = await s.api.call("/api/publications/" + s.pubId);
  const pageIds = pub.document.pages.map((p) => p.id);
  const reader = server.url + "/m/" + pub.slug;
  await page.goto(reader);
  await page.locator("#magazine").waitFor();
  await sleep(1500);
  await scene("s11", "main", async () => {
    await beat(0, async () => {
      await hand.click(role("Next page"), { after: 0 });
      flip(0);
      await sleep(1300);
    });
    await beat(1, async () => {
      await hand.click(role("Show thumbnails"), { after: 900 });
      await hand.click(role("Search publication"), { after: 500 });
      await hand.type(page.locator("#search-query"), "LIN-SAGE", { delay: 90 });
      await sleep(600);
      await hand.click(page.locator("#search-results .search-result").first(), { after: 0 });
      flip(0.2);
      await sleep(1500);
    });
    await beat(2, async () => {
      await hand.click(page.locator('#magazine [data-product][role="button"]:visible').filter({ has: page.locator("img") }).nth(1), { after: 1300 });
      await hand.click(page.locator("#close-dialog"), { after: 600 });
      await hand.click(role("Previous page"), { after: 0 });
      flip(0);
      await sleep(1400);
      await hand.click(page.getByRole("button", { name: /^Open gallery image 2/ }).first(), { after: 1400 });
      await hand.click(page.locator("#close-dialog"), { after: 500 });
    });
    await beat(3, async () => {
      await hand.click(page.getByRole("link", { name: "Meet the maker of the lounge chair" }).first(), { after: 0 });
      flip(0.2);
      await sleep(1600);
      const video = page.locator("#magazine video:visible").first();
      await hand.click(video, { after: 300 });
      await video.evaluate((v) => v.paused && v.play().catch(() => {}));
      await sleep(3200);
    });
    await beat(4, async () => {
      await hand.click(role("Zoom in"), { after: 500 });
      await hand.click(role("Zoom in"), { after: 700 });
      await hand.drag({ x: 900, y: 500 }, { x: 760, y: 420 }, { steps: 30 });
      await hand.click(role("Fit book"), { after: 700 });
      await hand.click(role("View options"), { after: 600 });
      for (const mode of ["2d", "slide", "scroll"]) await hand.select(page.locator("#view-mode"), mode);
      await hand.click(role("Close view options"), { after: 800 });
      await page.mouse.wheel(0, 900);
      await sleep(900);
    });
  });
  // Off camera: return the reader to its default 3D book for later scenes.
  await page.evaluate(() => localStorage.removeItem("flipbook-reader-settings"));
  if (done("s11")) throw "stop";

  // Phone: a separate Pixel 7 context, composited onto the 1080p frame later.
  {
    const phoneContext = await browser.newContext({ ...devices["Pixel 7"] });
    await routes(phoneContext, state);
    await phoneContext.addInitScript("window.__demoTouch = true;" + CURSOR_SCRIPT);
    const phone = await phoneContext.newPage();
    await phone.goto(reader);
    await phone.locator("#magazine").waitFor();
    await sleep(1200);
    const phoneCapture = new Capture("phone");
    await phoneCapture.start(phone, { maxWidth: 1920, maxHeight: 1080 });
    const touch = await phoneContext.newCDPSession(phone);
    const swipe = async (x1, y1, x2, y2) => {
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1 }] });
      for (let i = 1; i <= 12; i++) {
        await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + ((x2 - x1) * i) / 12, y: y1 + ((y2 - y1) * i) / 12 }] });
        await sleep(18);
      }
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await sleep(600);
    await scene("s12", "phone", async () => {
      await beat(0, async () => {
        for (let i = 0; i < 2; i++) {
          await swipe(330, 450, 70, 460);
          flip(0.1);
          await sleep(1500);
        }
      });
      await beat(1, async () => {
        await phone.getByRole("button", { name: "Scroll view" }).tap();
        await sleep(900);
        for (let i = 0; i < 3; i++) { await swipe(200, 650, 200, 250); await sleep(700); }
      });
    });
    await phoneCapture.stop();
    await phoneContext.close();
  }

  // Off camera: export the PDF for the viewer.
  const exportJob = await s.api.call(`/api/publications/${s.pubId}/export`, { method: "POST", body: {} });
  const pdfJob = await waitJob(s.api, exportJob.id);
  const pdfBytes = Buffer.from(await (await fetch(server.url + `/api/jobs/${pdfJob.id}/download`, { headers: { Cookie: s.api.cookie } })).arrayBuffer());
  state.pdf = OUT + "/edition.pdf";
  writeFileSync(state.pdf, pdfBytes);
  await page.goto(server.url + "/__demo/pdf.html");
  await page.waitForSelector("body[data-ready=true]", { timeout: 60000 });
  await hand.point({ x: 1200, y: 400 }, { pause: 300 });
  await scene("s13", "main", async () => {
    const scrollTo = async (n) => {
      await page.locator("#page-" + n).evaluate((el) => window.scrollTo({ top: el.offsetTop - 70, behavior: "smooth" }));
      await sleep(1100);
    };
    await beat(0, async () => {
      await sleep(600);
      await scrollTo(2);
    });
    await beat(1, async () => {
      // The PDF draws each word separately; select from "letter" to "studio".
      const word = (w) => page.locator("#page-2 .textLayer span").filter({ hasText: new RegExp(`^\\s*${w}\\s*$`) }).first().boundingBox();
      const a = await word("letter"), b = await word("studio");
      await hand.drag({ x: a.x + 1, y: a.y + a.height / 2 }, { x: b.x + b.width - 1, y: b.y + b.height / 2 }, { steps: 30 });
      await sleep(500);
      await hand.point(page.locator("#page-2 .link").first(), { pause: 1200 });
      await scrollTo(5);
      await hand.point(page.locator("#page-5 .link").first(), { pause: 1000 });
    });
    await beat(2, async () => {
      await scrollTo(9);
      await hand.point(page.locator("#page-9 .link").filter({ hasNot: page.locator("x") }).first(), { pause: 1500 });
    });
  });
  if (done("s13")) throw "stop";

  // Off camera: a few real reader sessions so the analytics have data.
  for (let i = 0; i < 4; i++) {
    const visitor = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await visitor.route("https://example.com/**", (r) => r.fulfill({ contentType: "text/html", body: "ok" }));
    const v = await visitor.newPage();
    await v.goto(reader);
    await v.locator("#magazine").waitFor();
    for (let k = 0; k < 2 + i; k++) { await v.getByRole("button", { name: "Next page", exact: true }).click(); await sleep(900); }
    if (i % 2 === 0) {
      await v.goto(reader + "?page=" + pageIds[4]);
      await sleep(1200);
      const link = v.locator("#magazine [data-product-link]:visible").first();
      const popup = visitor.waitForEvent("page").catch(() => {});
      await link.click().catch(() => {});
      await popup;
    }
    await sleep(2500);
    await visitor.close();
  }

  await page.goto(server.url + "/#/edit/" + s.pubId);
  await page.getByText("All changes saved", { exact: true }).waitFor();
  await goToPage(5);
  await scene("s14", "main", async () => {
    await beat(0, async () => {
      await hand.click(layer("Lamp"), { after: 400 });
      await hand.type(label("Price"), "139.00", { delay: 70 });
      await saved();
      await sleep(400);
      await page.goto(reader + "?page=" + pageIds[4]);
      await page.locator("#magazine").waitFor();
      await sleep(1200);
      await hand.point(page.locator("#magazine .price:visible").filter({ hasText: "145" }).first(), { pause: 900 });
    });
    await beat(1, async () => {
      await page.goto(server.url + "/#/");
      await page.getByText("Your publications").waitFor();
      await sleep(400);
      await hand.click(role("Actions for Slow Living — The Autumn Edit"), { after: 400 });
      await hand.click(page.getByRole("button", { name: "Analytics" }), { after: 1500 });
      await hand.point(page.locator("dialog[open] strong").first(), { pause: 800 });
    });
    await beat(2, async () => {
      await closeDialog();
      await page.goto(reader + "?page=" + pageIds[9]);
      await page.locator("#magazine").waitFor();
      await sleep(1500);
    });
  });

  // Cold open, recorded last and placed first in the edit.
  await page.evaluate(() => localStorage.removeItem("flipbook-reader-settings"));
  await page.goto(reader);
  await page.locator("#magazine").waitFor();
  await sleep(1800);
  await hand.point({ x: 1100, y: 620 }, { pause: 200 });
  await scene("s01", "main", async () => {
    await beat(0, async () => {
      await sleep(800);
      await hand.point({ x: 960, y: 520 }, { pause: 600 });
    });
    await beat(1, async () => {
      await hand.click(role("Next page"), { after: 0 });
      flip(0);
      await sleep(1600);
    });
    await beat(2, async () => {
      const book = await page.locator("#magazine .mag-page:visible").last().boundingBox();
      const y = book.y + book.height * 0.62;
      flip(1.6);
      await hand.drag({ x: book.x + book.width - 14, y }, { x: book.x - book.width * 0.75, y: y - 20 }, { steps: 70, holdAt: 0.5, hold: 1400 });
      await sleep(1400);
    });
    await beat(3, async () => {
      const book = await page.locator("#magazine .mag-page:visible").last().boundingBox();
      const y = book.y + book.height * 0.55;
      await hand.drag({ x: book.x + book.width - 14, y }, { x: book.x + book.width * 0.72, y: y - 10 }, { steps: 40, holdAt: 0.95, hold: 700 });
      await sleep(1600);
    });
  });
} catch (e) {
  if (e !== "stop") {
    console.error(e);
    await page.screenshot({ path: OUT + "/failure.png" }).catch(() => {});
    process.exitCode = 1;
  }
} finally {
  await main.stop();
  writeFileSync(OUT + "/timeline.json", JSON.stringify(timeline));
  await browser.close();
  server.stop();
  console.log("timeline written; frames:", timeline.captures.main?.length);
}
