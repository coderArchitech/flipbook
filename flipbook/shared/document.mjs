import { validateEditorExtensions, editorAssetIds } from "./editor-schema.mjs";
export const uid = () => globalThis.crypto.randomUUID();
export const SCHEMA_VERSIONS = [1, 2];
export const MAX_PAGES = 100;
export const THEMES = {
  editorial: {
    name: "Warm editorial",
    ink: "#242722",
    paper: "#f5f1e8",
    accent: "#bd5639",
    font: "Instrument Serif, serif",
  },
  modern: {
    name: "Modern studio",
    ink: "#17283b",
    paper: "#f3f6f8",
    accent: "#315fc4",
    font: "DM Sans, sans-serif",
  },
  botanical: {
    name: "Botanical",
    ink: "#24382c",
    paper: "#f0f3e9",
    accent: "#637646",
    font: "Instrument Serif, serif",
  },
};
export const TEMPLATES = [
  {
    id: "cover",
    name: "The opening",
    label: "Cover",
    description: "Make a memorable first impression.",
  },
  {
    id: "feature",
    name: "In the spotlight",
    label: "Product feature",
    description: "Give one product room to shine.",
  },
  {
    id: "grid",
    name: "The collection",
    label: "Product grid",
    description: "Four products. One beautiful edit.",
  },
  {
    id: "story",
    name: "The story",
    label: "Editorial",
    description: "A little context goes a long way.",
  },
  {
    id: "divider",
    name: "A new chapter",
    label: "Category divider",
    description: "Create a pause between collections.",
  },
  {
    id: "closing",
    name: "Stay in touch",
    label: "Closing",
    description: "Leave readers with a next step.",
  },
  {
    id: "blank",
    name: "Your canvas",
    label: "Blank",
    description: "Start with a clean page.",
  },
];
export const emptyProduct = () => ({
  name: "",
  summary: "",
  description: "",
  price: "",
  currency: "USD",
  sku: "",
  category: "",
  badge: "",
  url: "",
  images: [],
});
export function block(type, rect, values = {}) {
  return {
    id: uid(),
    type,
    rect,
    text: "",
    size: 18,
    bold: false,
    align: "left",
    assetId: null,
    alt: "",
    decorative: false,
    crop: { x: 50, y: 50, zoom: 1 },
    ...values,
  };
}
export function makePage(template = "blank") {
  const page = {
    id: uid(),
    template,
    title: TEMPLATES.find((t) => t.id === template)?.label || "Page",
    blocks: [],
  };
  const text = (rect, value, size = 18, extra = {}) =>
    block("text", rect, { text: value, size, ...extra });
  const product = (rect) =>
    block("product", rect, { product: emptyProduct(), size: 16 });
  if (template === "cover")
    page.blocks = [
      text([0, 0, 12, 2], "THE EDIT / VOLUME 01", 12, { bold: true }),
      block("image", [0, 3, 12, 22]),
      text([0, 26, 12, 6], "Objects for\neveryday living.", 42),
      text(
        [0, 33, 12, 3],
        "A considered collection, made to be discovered.",
        16,
      ),
    ];
  if (template === "feature")
    page.blocks = [
      text([0, 0, 12, 3], "A closer look.", 34),
      product([0, 4, 12, 32]),
    ];
  if (template === "grid")
    page.blocks = [
      text([0, 0, 12, 3], "The collection.", 32),
      product([0, 4, 6, 15]),
      product([6, 4, 6, 15]),
      product([0, 20, 6, 16]),
      product([6, 20, 6, 16]),
    ];
  if (template === "story")
    page.blocks = [
      text([0, 0, 12, 4], "Behind the collection.", 34),
      block("image", [0, 5, 12, 18]),
      text(
        [0, 24, 12, 12],
        "Every object has a story. Share the inspiration, the people, and the details that make your collection special.",
        20,
      ),
    ];
  if (template === "divider")
    page.blocks = [
      text([0, 4, 12, 2], "A NEW CHAPTER", 12, { bold: true }),
      text([0, 9, 12, 9], "Good things,\nthoughtfully made.", 44),
      block("image", [0, 20, 12, 16]),
    ];
  if (template === "closing")
    page.blocks = [
      text([0, 4, 12, 10], "Until the\nnext edition.", 48),
      text(
        [0, 17, 12, 8],
        "Thank you for spending time with our collection. Explore more from our studio.",
        22,
      ),
      block("button", [0, 28, 8, 4], {
        text: "Visit our store",
        url: "https://example.com",
        size: 18,
      }),
    ];
  return page;
}
export function makeDocument(title = "Untitled magazine", theme = "editorial") {
  return {
    schemaVersion: 1,
    title,
    subtitle: "A collection worth exploring.",
    publisher: "My studio",
    language: "en",
    theme,
    pages: [makePage("cover")],
  };
}
export function duplicatePage(page) {
  const id = uid(),
    ids = new Map(page.blocks.map((b) => [b.id, uid()])),
    groups = new Map();
  return {
    ...structuredClone(page),
    id,
    blocks: page.blocks.map((source) => {
      const b = structuredClone(source);
      b.id = ids.get(source.id);
      if (b.groupId) {
        if (!groups.has(b.groupId)) groups.set(b.groupId, uid());
        b.groupId = groups.get(b.groupId);
      }
      if (b.action?.kind === "page" && b.action.pageId === page.id)
        b.action.pageId = id;
      if (b.action?.kind === "product" && ids.has(b.action.blockId))
        b.action.blockId = ids.get(b.action.blockId);
      return b;
    }),
  };
}
export const assetIds = editorAssetIds;
export { editorFontIds as fontIds } from "./editor-schema.mjs";
export function safeUrl(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      value.length <= 2048
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function formatPrice(product) {
  if (product.price === "" || product.price == null) return "";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: product.currency || "USD",
    }).format(Number(product.price));
  } catch {
    return "";
  }
}
export function validateProduct(p, complete = false) {
  const errors = [];
  if (!p || typeof p !== "object" || Array.isArray(p))
    return ["Product content is required."];
  for (const [key, limit] of Object.entries({
    name: 200,
    summary: 500,
    description: 10000,
    sku: 100,
    category: 100,
    badge: 40,
    url: 2048,
    currency: 3,
    price: 30,
  }))
    if (typeof p[key] !== "string" || p[key].length > limit)
      errors.push("Invalid product " + key + ".");
  if (
    !Array.isArray(p.images) ||
    p.images.length > 8 ||
    p.images.some((id) => typeof id !== "string")
  )
    errors.push("Choose up to 8 product images.");
  if (p.url && !safeUrl(p.url))
    errors.push("Product links must be a valid HTTPS URL.");
  if (p.price && (!/^\d+(\.\d{1,3})?$/.test(p.price) || Number(p.price) > 1e12))
    errors.push("Enter a nonnegative price with up to 3 decimal places.");
  if (p.currency && !/^[A-Z]{3}$/.test(p.currency))
    errors.push("Use a three-letter currency code.");
  if (
    complete &&
    (typeof p.name !== "string" ||
      !p.name.trim() ||
      typeof p.summary !== "string" ||
      !p.summary.trim() ||
      !Array.isArray(p.images) ||
      !p.images.length)
  )
    errors.push("Add a product name, summary, and image.");
  return errors;
}
export function validateDocument(doc, complete = false) {
  const findings = [];
  const add = (message, pageId, blockId) =>
    findings.push({ message, pageId, blockId });
  // Structural problems stop validation; each gets its own finding so the
  // editor can explain it (see shared/finding-help.mjs).
  if (!doc || typeof doc !== "object")
    return [{ message: "The draft could not be read." }];
  if (!SCHEMA_VERSIONS.includes(doc.schemaVersion))
    add(
      `Document format ${JSON.stringify(doc.schemaVersion ?? null)} is not supported by this server.`,
    );
  if (!Array.isArray(doc.pages)) add("The draft has no page list.");
  else if (doc.pages.length > MAX_PAGES)
    add(
      `This magazine has ${doc.pages.length} pages; the limit is ${MAX_PAGES}.`,
    );
  if (!Object.hasOwn(THEMES, doc.theme))
    add(`Theme ${JSON.stringify(doc.theme ?? null)} is not available.`);
  if (findings.length) return findings;
  for (const [key, max] of [
    ["title", 160],
    ["subtitle", 300],
    ["publisher", 160],
  ])
    if (typeof doc[key] !== "string" || doc[key].length > max)
      add("Invalid " + key + ".");
  if (
    complete &&
    (typeof doc.title !== "string" ||
      !doc.title.trim() ||
      typeof doc.publisher !== "string" ||
      !doc.publisher.trim() ||
      !doc.pages.length)
  )
    add("Add a title, publisher, and at least one page.");
  const ids = new Set();
  const pages = [
    ...doc.pages,
    ...(Array.isArray(doc.masters)
      ? doc.masters.map((m) => m && { ...m, title: m.name, master: true })
      : []),
  ];
  for (const page of pages) {
    if (!page || typeof page !== "object" || Array.isArray(page)) {
      add("Invalid page.");
      continue;
    }
    if (typeof page.id !== "string" || ids.has(page.id))
      add("Page IDs must be unique.");
    ids.add(page.id);
    if (typeof page.title !== "string" || page.title.length > 160)
      add("Invalid page title.", page.id);
    if (!Array.isArray(page.blocks) || page.blocks.length > 50) {
      add("Use at most 50 blocks per page.", page.id);
      continue;
    }
    if (
      complete &&
      !page.master &&
      !page.masterId &&
      !page.background &&
      !page.blocks.some((b) => b && !b.hidden)
    )
      add("Add content or remove this empty page.", page.id);
    for (const b of page.blocks) {
      if (!b || typeof b.id !== "string" || ids.has(b.id)) {
        add("Block IDs must be unique.", page.id);
        continue;
      }
      ids.add(b.id);
      const required = complete && !b.hidden;
      if (
        !(
          doc.schemaVersion === 2
            ? [
                "text",
                "image",
                "product",
                "button",
                "divider",
                "shape",
                "gallery",
                "hotspot",
                "media",
                "icon",
              ]
            : ["text", "image", "product", "button", "divider"]
        ).includes(b.type)
      )
        add("Unsupported block type.", page.id, b.id);
      const r = b.rect;
      if (
        !Array.isArray(r) ||
        r.length !== 4 ||
        r.some((n) =>
          doc.schemaVersion === 2 ? !Number.isFinite(n) : !Number.isInteger(n),
        ) ||
        r[0] < 0 ||
        r[1] < 0 ||
        r[2] < 1 ||
        r[3] < 1 ||
        r[0] + r[2] > 12 ||
        r[1] + r[3] > 36
      )
        add("Keep blocks inside the page grid.", page.id, b.id);
      if (
        !Number.isFinite(b.size) ||
        b.size < 10 ||
        b.size > 64 ||
        !["left", "center", "right"].includes(b.align) ||
        typeof b.bold !== "boolean"
      )
        add("Invalid text style.", page.id, b.id);
      if (typeof b.text !== "string" || b.text.length > 20000)
        add("Text exceeds the supported length.", page.id, b.id);
      if (
        typeof b.alt !== "string" ||
        b.alt.length > 500 ||
        typeof b.decorative !== "boolean"
      )
        add("Invalid image description.", page.id, b.id);
      if (
        !b.crop ||
        !Number.isFinite(b.crop.x) ||
        b.crop.x < 0 ||
        b.crop.x > 100 ||
        !Number.isFinite(b.crop.y) ||
        b.crop.y < 0 ||
        b.crop.y > 100 ||
        !Number.isFinite(b.crop.zoom) ||
        b.crop.zoom < 1 ||
        b.crop.zoom > 3
      )
        add("Invalid image crop.", page.id, b.id);
      if (b.type === "product")
        for (const e of validateProduct(b.product, required))
          add(e, page.id, b.id);
      if (b.type === "button" && !safeUrl(b.url))
        add("Button links must use HTTPS.", page.id, b.id);
      if (b.assetId !== null && typeof b.assetId !== "string")
        add("Invalid image reference.", page.id, b.id);
      if (
        required &&
        b.type === "text" &&
        (typeof b.text !== "string" || !b.text.trim())
      )
        add("Add text or remove this empty block.", page.id, b.id);
      if (
        required &&
        b.type === "image" &&
        (!b.assetId ||
          (!b.decorative && (typeof b.alt !== "string" || !b.alt.trim())))
      )
        add(
          "Add an image and description, or mark it decorative.",
          page.id,
          b.id,
        );
    }
    if (doc.schemaVersion === 1)
      for (let i = 0; i < page.blocks.length; i++)
        for (let j = i + 1; j < page.blocks.length; j++) {
          const a = page.blocks[i]?.rect,
            b = page.blocks[j]?.rect;
          if (
            a?.length === 4 &&
            b?.length === 4 &&
            a[0] < b[0] + b[2] &&
            a[0] + a[2] > b[0] &&
            a[1] < b[1] + b[3] &&
            a[1] + a[3] > b[1]
          )
            add(
              "Blocks overlap. Move or resize one of them.",
              page.id,
              page.blocks[j].id,
            );
        }
  }
  findings.push(...validateEditorExtensions(doc, safeUrl, complete));
  if (JSON.stringify(doc).length > 2 * 1024 * 1024)
    add("Publication exceeds the 2 MiB document limit.");
  return findings;
}
