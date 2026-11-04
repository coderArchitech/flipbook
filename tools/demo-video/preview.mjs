// Design QA before recording: applies the end state of every scene through the
// API, publishes, exports, and screenshots each reader page and PDF page.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { FLIPBOOK, OUT, FONT } from "./paths.mjs";
import { startServer, waitJob } from "./lib.mjs";
import { seed } from "./build.mjs";
import { launch, routes } from "./browser.mjs";

const { newElement, generateProductPages } = await import(FLIPBOOK + "/shared/editor-commands.mjs");
const { parseCsv, suggestMapping, previewImport } = await import(FLIPBOOK + "/shared/catalog-import.mjs");
const dir = OUT + "/preview/";
mkdirSync(dir, { recursive: true });
const server = await startServer(4311);
try {
  const s = await seed(server.url);
  const { api } = s;
  const font = await api.call("/api/fonts", { method: "POST", raw: { name: "Fraunces-SemiBoldItalic.woff", bytes: readFileSync(FONT) }, type: "application/octet-stream" });
  let pub = await api.call("/api/publications/" + s.pubId);
  const d = pub.document;
  d.brand.headingFont = font.value;
  d.masters[0].margins = { left: 0.5, right: 0.5, top: 2, bottom: 2 };
  d.pages.forEach((p, i) => (p.masterId = i === 0 || i === d.pages.length - 1 ? null : d.masters[0].id));
  const letterPage = d.pages[1];
  letterPage.blocks.push({ ...newElement("icon", [1, 25.5, 2, 4]), icon: "leaf" });
  for (const b of letterPage.blocks) if (b.type === "icon") b.rect[1] = 25.5;
  const look = d.pages[5];
  look.blocks.push({ ...newElement("hotspot", [2.5, 9.5, 2.5, 4]), label: "Arc table light details", action: { kind: "product", blockId: d.pages[4].blocks.find((b) => b.name === "Lamp").id } });
  const presentation = { fields: ["image", "name", "summary", "sku", "price", "badge", "link"], priceColor: "#a24f2f" };
  for (const p of d.pages) for (const b of p.blocks) if (b.type === "product") b.presentation = { ...presentation, imageLayout: "single" };
  d.pages[3].blocks.find((b) => b.type === "product").presentation.imageLayout = "grid";

  const assets = await api.call("/api/assets");
  const parsed = parseCsv(readFileSync(OUT + "/assets/textiles.csv", "utf8"));
  const rows = previewImport(parsed, suggestMapping(parsed.headers), assets);
  const imported = await api.call("/api/products/import", { method: "POST", body: { products: rows.map((r) => r.product) } });
  const before = d.pages.length;
  generateProductPages(d, imported.products, "grid");
  const [generated] = d.pages.splice(before, 1);
  generated.blocks[0].text = "Linen, naturally.";
  delete generated.blocks[0].richText;
  for (const b of generated.blocks) if (b.type === "product") b.presentation = { ...presentation, imageLayout: "single" };
  d.pages.splice(7, 0, generated);

  const saved = await api.call(`/api/publications/${s.pubId}/draft`, { method: "PUT", body: { revision: pub.revision, document: d } });
  const job = await api.call(`/api/publications/${s.pubId}/publish`, { method: "POST", body: { revision: saved.revision } });
  await waitJob(api, job.id);
  pub = await api.call("/api/publications/" + s.pubId);
  const exp = await api.call(`/api/publications/${s.pubId}/export`, { method: "POST", body: {} });
  const pdfJob = await waitJob(api, exp.id);
  const pdf = Buffer.from(await (await fetch(server.url + `/api/jobs/${pdfJob.id}/download`, { headers: { Cookie: api.cookie } })).arrayBuffer());
  writeFileSync(dir + "edition.pdf", pdf);

  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 });
  await routes(context, { pdf: dir + "edition.pdf" });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(server.url + "/m/" + pub.slug);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: dir + "reader-cover.png" });
  for (const i of [1, 3, 5, 7, 9]) {
    await page.goto(server.url + "/m/" + pub.slug + "?page=" + d.pages[i].id);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${dir}spread-${String(i + 1).padStart(2, "0")}.png` });
  }
  const login = await context.newPage();
  await context.addCookies([{ name: api.cookie.split("=")[0], value: api.cookie.split("=").slice(1).join("="), url: server.url }]);
  await login.goto(server.url + "/#/edit/" + s.pubId);
  await login.getByRole("button", { name: "Select page 2", exact: true }).click();
  await login.waitForTimeout(800);
  await login.screenshot({ path: dir + "editor.png" });
  await page.goto(server.url + "/__demo/pdf.html");
  await page.waitForSelector("body[data-ready=true]", { timeout: 30000 });
  await page.screenshot({ path: dir + "pdf-viewer.png" });
  for (let i = 1; i <= d.pages.length; i++) await page.locator("#page-" + i).screenshot({ path: `${dir}pdf-${String(i).padStart(2, "0")}.png` });
  await browser.close();
  console.log("Preview written to", dir);
} finally {
  server.stop();
}
