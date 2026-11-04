// Seeds the demo account through the real API and builds the pre-built draft of
// "Slow Living — The Autumn Edit". Anything a scene builds on camera is left out
// here (uploaded font, master margins, rich formatting, the leaf icon, the lamp
// hotspot, CSV textiles page, card presentation).
import { readdirSync } from "node:fs";
import { FLIPBOOK, OUT } from "./paths.mjs";
import { register } from "./lib.mjs";

const { makePage, uid } = await import(FLIPBOOK + "/shared/document.mjs");
const { upgradeDocument, newElement } = await import(FLIPBOOK + "/shared/editor-commands.mjs");
const { setBlockText } = await import(FLIPBOOK + "/shared/rich-text.mjs");

export const FILM_URL = "https://films.holmandfield.example/wheel.webm";
const PAPER = "#f3ede3";

function T(name, rect, text, { size = 16, color, font, lh, ls, align = "left", bold = false } = {}) {
  const b = { ...newElement("text", rect), name, size, align, bold };
  setBlockText(b, text);
  const style = {};
  if (color) style.color = color;
  if (font) style.font = font;
  if (lh) style.lineHeight = lh;
  if (ls !== undefined) style.letterSpacing = ls;
  if (Object.keys(style).length) b.textStyle = style;
  return b;
}
const IMG = (name, rect, assetId, alt, extra = {}) => ({ ...newElement("image", rect), name, assetId, alt, ...extra });
const ICON = (name, rect, icon, extra = {}) => ({ ...newElement("icon", rect), name, icon, ...extra });
const PRODUCT = (name, rect, product, extra = {}) => ({ ...newElement("product", rect), name, product: structuredClone(product), size: 14, ...extra });
const page = (template, title, blocks, extra = {}) => ({ ...makePage("blank"), template, title, blocks, footer: false, ...extra });

export async function seed(url) {
  const api = await register(url, { name: "Mira Holm", email: "mira@holmandfield.example", password: "demo-recording-only-2026" });
  const assetDir = OUT + "/assets/";
  const a = {};
  for (const file of readdirSync(assetDir).filter((f) => f.endsWith(".png")).sort())
    a[file] = (await api.upload(assetDir + file, file)).id;

  // The four starter products, given codes and the vessel's extra photos.
  const catalog = await api.call("/api/products");
  const byName = Object.fromEntries(catalog.map((p) => [p.content.name, p]));
  const codes = { "The everyday vessel": "HF-VES-01", "Arc table light": "HF-LMP-02", "Sunday lounge chair": "HF-CHR-03", "Linen, naturally": "HF-LIN-04" };
  for (const [name, sku] of Object.entries(codes)) {
    const p = byName[name];
    const content = { ...p.content, sku, url: "https://example.com/shop/" + sku.toLowerCase() };
    if (name === "The everyday vessel")
      content.images = [...content.images, a["vessel-side.png"], a["vessel-top.png"], a["vessel-pair.png"]];
    byName[name] = { ...p, content: (await api.call("/api/products/" + p.id, { method: "PUT", body: { revision: p.revision, content } })).content };
  }
  const product = (name) => byName[name].content;

  const created = await api.call("/api/publications", { method: "POST", body: { title: "Slow Living — The Autumn Edit", theme: "editorial" } });
  const doc = upgradeDocument(created.document);
  doc.title = "Slow Living — The Autumn Edit";
  doc.subtitle = "Objects, textiles and light for the quieter season";
  doc.publisher = "Holm & Field";
  doc.brand = { ink: "#2a2622", paper: PAPER, accent: "#a24f2f", headingFont: "serif", bodyFont: "sans" };

  const master = {
    id: uid(),
    name: "Edition",
    blocks: [
      T("Master header", [0.5, 0, 9, 1.5], "SLOW LIVING  ·  THE AUTUMN EDIT", { size: 11, ls: 2, font: "sans" }),
      IMG("Master logo", [10.5, 0, 1, 1.5], a["holm-field-logo.png"], "Holm & Field"),
      T("Master footer", [0.5, 34.5, 11, 1.5], "{{publisher}}  ·  {{page}} / {{pages}}", { size: 11, align: "right", font: "sans" }),
    ],
  };
  doc.masters = [master];

  const letter =
    "Autumn is when the studio slows down. The kilns run cooler, the windows stay open a little longer, and we finally have time to make things properly.\n" +
    "This edition gathers what we have been living with: stoneware for the table, light for the long evenings, and linen that softens with every wash. Everything is covered by our repair promise.\n" +
    "Inside this edition\nObjects for the everyday table\nLight for slow evenings\nLinen, naturally";
  const captions = ["Natural materials", "Free delivery", "Made to last", "Repair for life"];
  const captionX = [0.7, 3.367, 6.033, 8.7];

  doc.pages = [
    page("cover", "Cover", [
      IMG("Logo", [0.5, 1, 1.5, 2.5], a["holm-field-logo.png"], "Holm & Field"),
      T("Eyebrow", [0.5, 22.5, 11, 1.5], "VOLUME 04  ·  AUTUMN 2026", { size: 13, ls: 3, color: PAPER, font: "sans" }),
      T("Cover title", [0.5, 24, 11, 6], "Slow Living", { size: 64, color: PAPER }),
      T("Cover subtitle", [0.5, 30, 9, 3.5], "The Autumn Edit: objects, textiles and light for the quieter season.", { size: 18, color: PAPER, font: "sans", lh: 1.35 }),
    ], { background: { type: "image", color: PAPER, assetId: a["cover-room.png"], crop: { x: 50, y: 60, zoom: 1 }, overlayColor: "#1c1714", overlayOpacity: 0.42 } }),
    page("story", "A letter from the studio", [
      T("Headline", [0.5, 2.5, 11, 3], "A letter from the studio", { size: 40 }),
      T("Letter", [0.5, 6, 6.5, 15], letter, { size: 14, font: "sans", lh: 1.5 }),
      T("Sign-off", [0.5, 21.5, 6.5, 2], "Mira Holm, founder", { size: 14, font: "sans", lh: 1.5 }),
      IMG("Vessel photo", [7.5, 6, 4, 15.5], a["vessel-side.png"], "The everyday vessel in terracotta glaze"),
      ICON("Icon truck", [3.9, 26.75, 2, 4], "truck"),
      ICON("Icon award", [6.1, 25.5, 2, 4], "award"),
      ICON("Icon recycle", [9, 26.25, 2, 4], "recycle"),
      ...captions.map((c, i) => T("Caption " + (i + 1), [captionX[i], 30.5, 2.6, 3], c, { size: 12, align: "center", font: "sans" })),
    ], { masterId: master.id }),
    page("divider", "Chapter one: Objects", [
      T("Chapter", [0.5, 10, 11, 1.5], "CHAPTER ONE", { size: 13, ls: 3, font: "sans" }),
      T("Chapter title", [0.5, 12, 11, 5], "Objects", { size: 64 }),
      T("Chapter intro", [0.5, 17.5, 7, 3.5], "Stoneware, light and wood. Made slowly, meant to stay.", { size: 18, font: "sans", lh: 1.35 }),
      IMG("Pair", [6.5, 21.5, 5, 11.5], a["vessel-pair.png"], "Two vessels, sage and terracotta", { appearance: { frame: "circle" } }),
    ], { background: { type: "gradient", color: "#d9a07c", color2: "#efe6d8", angle: 160 } }),
    page("feature", "The everyday vessel", [
      T("Feature title", [0.5, 2.5, 11, 3], "The everyday vessel", { size: 36 }),
      PRODUCT("Vessel card", [0.5, 6, 7, 27], product("The everyday vessel"), { size: 16, presentation: { fields: ["image", "name", "summary", "price", "badge", "link"], imageLayout: "single" } }),
      T("Feature notes", [8, 12, 3.5, 14], "Thrown on the wheel in batches of twelve and finished in a soft matte glaze. Each one is a little different. Dishwasher safe, but happiest washed by hand.", { size: 14, font: "sans", lh: 1.5 }),
    ], { masterId: null }),
    page("grid", "Shop the collection", [
      T("Grid title", [0.5, 2.5, 11, 3], "Shop the collection", { size: 36 }),
      PRODUCT("Vessel", [0.5, 6, 5.25, 13.5], { ...product("The everyday vessel"), images: [product("The everyday vessel").images[0]] }),
      PRODUCT("Lamp", [6.25, 6, 5.25, 13.5], product("Arc table light")),
      PRODUCT("Chair", [0.5, 20, 5.25, 13.5], product("Sunday lounge chair")),
      PRODUCT("Linen", [6.25, 20, 5.25, 13.5], product("Linen, naturally")),
    ]),
    page("blank", "Lookbook: the reading corner", [
      T("Lookbook title", [0.5, 2.5, 11, 3], "The reading corner", { size: 36 }),
      IMG("Room", [0.5, 6, 11, 21], a["lookbook-room.png"], "A reading corner with an arc lamp, a side table with a vessel, and a lounge chair"),
      T("Lookbook caption", [0.5, 27.5, 7.5, 3], "Tap the room to explore. Everything you see is in this edition.", { size: 13, font: "sans", lh: 1.4 }),
      { ...newElement("hotspot", [8, 14, 3, 8]), name: "Chair hotspot", label: "Meet the maker of the lounge chair", action: { kind: "page", pageId: "MAKER" } },
      { ...newElement("hotspot", [8.5, 27.5, 3, 2.5]), name: "Shop hotspot", label: "Shop the room", showLabel: true, action: { kind: "url", url: "https://example.com/shop/reading-corner" } },
      { ...newElement("shape", [8, 7, 1.75, 3]), name: "Star badge", shape: "star", appearance: { fill: "#d2a34f", borderWidth: 0 } },
    ]),
    page("blank", "In the studio", [
      T("Studio title", [0.5, 2.5, 11, 3], "In the studio", { size: 36 }),
      { ...newElement("gallery", [0.5, 6, 11, 19]), name: "Studio gallery", columns: 3, gap: 8, images: [
        ["studio-wheel.png", "Clay centred on the wheel"], ["studio-shelves.png", "Shelves of glazed pots drying"], ["studio-glazes.png", "Four jars of glaze"],
        ["studio-bowls.png", "A stack of nesting bowls"], ["studio-loom.png", "Linen on the loom"], ["studio-tools.png", "Trimming tools"],
      ].map(([f, alt]) => ({ assetId: a[f], alt })) },
      IMG("Wheel", [0.5, 26, 3, 7.5], a["studio-wheel.png"], "The pottery wheel", { appearance: { frame: "circle" } }),
      T("Studio notes", [4, 26.5, 7.5, 6.5], "Every piece passes through four pairs of hands: the thrower, the trimmer, the glazer, and whoever packs it for you. We sign the base of each one.", { size: 14, font: "sans", lh: 1.5 }),
    ]),
    page("story", "Meet the maker", [
      T("Maker title", [0.5, 2.5, 11, 3], "Meet the maker", { size: 36 }),
      { ...newElement("media", [0.5, 6, 7, 16]), name: "Film", mediaKind: "video", url: FILM_URL, posterId: a["film-poster.png"], title: "Ninety seconds at the wheel", description: "Mira throws the everyday vessel, start to finish." },
      PRODUCT("Chair card", [7.5, 6, 4, 16], product("Sunday lounge chair"), { size: 13 }),
      T("Maker story", [0.5, 23, 7, 9.5], "Mira Holm trained as a furniture maker before she found clay. The Sunday lounge chair came first: a seat for the end of a long day at the wheel. The vessel followed, made to hold the tea she drinks from it.", { size: 14, font: "sans", lh: 1.5 }),
    ]),
    page("closing", "Visit the studio", [
      T("Closing title", [0.5, 7, 11, 4], "Visit the studio", { size: 48, color: PAPER }),
      T("Closing intro", [0.5, 11.5, 9, 3], "Open Thursday to Sunday, ten until six. Bring a cup; we'll fill it.", { size: 16, color: PAPER, font: "sans", lh: 1.4 }),
      ...[["mail", "hello@holmandfield.example"], ["phone", "+44 117 496 0000"], ["map-pin", "14 Kiln Yard, Bristol"]].flatMap(([icon, text], i) => [
        ICON("Contact icon " + icon, [0.5, 16 + i * 3.25, 1, 2.5], icon, { color: PAPER }),
        T("Contact " + icon, [1.75, 16.5 + i * 3.25, 9, 2], text, { size: 15, color: PAPER, font: "sans" }),
      ]),
      { ...newElement("button", [0.5, 27, 4.5, 2.5]), name: "Visit button", text: "Plan your visit", url: "https://example.com/visit" },
      IMG("Closing logo", [9.5, 29, 2, 4.5], a["holm-field-logo.png"], "Holm & Field"),
    ], { background: { type: "solid", color: "#a24f2f" } }),
  ];
  const maker = doc.pages.find((p) => p.title === "Meet the maker");
  doc.pages.find((p) => p.title.startsWith("Lookbook")).blocks.find((b) => b.name === "Chair hotspot").action.pageId = maker.id;
  // Product-feature page uses the master too; cover and closing stay full-bleed.
  doc.pages[3].masterId = master.id;

  const saved = await api.call(`/api/publications/${created.id}/draft`, { method: "PUT", body: { revision: created.revision, document: doc } });
  return { api, pubId: created.id, slug: created.slug, revision: saved.revision, assets: a, master };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { startServer } = await import("./lib.mjs");
  const server = await startServer();
  try {
    const s = await seed(server.url);
    console.log("Seeded", s.pubId, server.url + "/#/edit/" + s.pubId);
  } finally {
    if (!process.argv.includes("--keep")) server.stop();
  }
}
