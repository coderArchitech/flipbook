import { THEMES } from "./document.mjs";
import { rectangle } from "./layout.mjs";
export const DEFAULT_PRODUCT_FIELDS = [
  "image",
  "name",
  "summary",
  "price",
  "badge",
  "link",
];
export function brandOf(doc) {
  const theme = THEMES[doc.theme] || THEMES.editorial;
  return {
    ink: theme.ink,
    paper: theme.paper,
    accent: theme.accent,
    headingFont: doc.theme === "modern" ? "sans" : "serif",
    bodyFont: "sans",
    ...doc.brand,
  };
}
export function styleOf(block, doc) {
  const brand = brandOf(doc),
    style = (doc.styles || []).find((s) => s.id === block.styleId) || {};
  return {
    size: block.size,
    bold: block.bold,
    italic: false,
    underline: false,
    align: block.align,
    font: brand.headingFont,
    color: brand.ink,
    lineHeight: 1.2,
    letterSpacing: 0,
    ...style,
    ...block.textStyle,
  };
}
export function effectivePage(page, doc, index = 0) {
  const master = (doc.masters || []).find((m) => m.id === page.masterId);
  const replace = (text) =>
    String(text || "").replace(
      /\{\{(page|pages|publisher)\}\}/g,
      (_, key) =>
        ({
          page: String(index + 1),
          pages: String(doc.pages.length),
          publisher: doc.publisher,
        })[key],
    );
  const inherited = (master?.blocks || []).map((b) => {
    const copy = structuredClone(b);
    copy.id = `${page.id}:${b.id}`;
    copy.masterSourceId = b.id;
    copy.text = replace(copy.text);
    if (copy.richText)
      for (const p of copy.richText)
        for (const run of p.runs) run.text = replace(run.text);
    return copy;
  });
  return {
    ...page,
    blocks: [...inherited, ...page.blocks].filter((b) => !b.hidden),
  };
}
export function galleryBoxes(block, width, height) {
  const columns = block.columns || 2,
    rows = Math.max(1, Math.ceil(block.images.length / columns)),
    gap = block.gap ?? 8;
  const w = (width - gap * (columns - 1)) / columns,
    h = (height - gap * (rows - 1)) / rows;
  return block.images.map((image, index) => ({
    ...image,
    x: (index % columns) * (w + gap),
    y: Math.floor(index / columns) * (h + gap),
    width: w,
    height: h,
  }));
}
// Image tiles for a product card photo area as fractions (0-1) of that area,
// so the HTML card (percentages) and the PDF card (points) share one layout.
export function productImageBoxes(images, layout) {
  const ids = (images || []).filter(Boolean),
    gap = 0.03;
  if (!ids.length) return [];
  if (layout === "grid" && ids.length > 1) {
    const shown = ids.slice(0, 4),
      rows = shown.length > 2 ? 2 : 1,
      w = (1 - gap) / 2,
      h = (1 - gap * (rows - 1)) / rows;
    return shown.map((assetId, i) => ({
      assetId,
      x: (i % 2) * (w + gap),
      y: Math.floor(i / 2) * (h + gap),
      width: w,
      height: h,
    }));
  }
  if (layout === "thumbnails" && ids.length > 1) {
    const strip = 0.26,
      w = (1 - gap * 2) / 3;
    return [
      { assetId: ids[0], x: 0, y: 0, width: 1, height: 1 - strip - gap },
      ...ids.slice(1, 4).map((assetId, i) => ({
        assetId,
        x: i * (w + gap),
        y: 1 - strip,
        width: w,
        height: strip,
      })),
    ];
  }
  return [{ assetId: ids[0], x: 0, y: 0, width: 1, height: 1 }];
}
// The page's content area in grid units, inset by its master's margins.
export function marginBox(doc, page) {
  const m = (doc.masters || []).find((x) => x.id === page?.masterId)?.margins;
  if (!m) return null;
  return [m.left, m.top, 12 - m.left - m.right, 36 - m.top - m.bottom];
}
export function layoutWarnings(doc, assets = []) {
  const found = [],
    byId = new Map(assets.map((a) => [a.id, a]));
  for (const [i, source] of doc.pages.entries()) {
    const margins = marginBox(doc, source);
    for (const b of source.blocks)
      if (
        margins &&
        !b.hidden &&
        (b.rect[0] < margins[0] - 1e-6 ||
          b.rect[1] < margins[1] - 1e-6 ||
          b.rect[0] + b.rect[2] > margins[0] + margins[2] + 1e-6 ||
          b.rect[1] + b.rect[3] > margins[1] + margins[3] + 1e-6)
      )
        found.push({
          pageId: source.id,
          blockId: b.id,
          message: "Element is outside the master page margins.",
          severity: "warning",
        });
    for (const b of effectivePage(source, doc, i).blocks) {
      const rect = rectangle(b.rect),
        a = b.appearance || {},
        angle = ((a.rotation || 0) * Math.PI) / 180;
      const rotatedW =
          Math.abs(rect.width * Math.cos(angle)) +
          Math.abs(rect.height * Math.sin(angle)),
        rotatedH =
          Math.abs(rect.width * Math.sin(angle)) +
          Math.abs(rect.height * Math.cos(angle));
      const x = rect.x + (rect.width - rotatedW) / 2,
        y = rect.y + (rect.height - rotatedH) / 2;
      if (x < 0 || y < 0 || x + rotatedW > 794 || y + rotatedH > 1123)
        found.push({
          pageId: source.id,
          blockId: b.masterSourceId || b.id,
          message: "Rotated element extends beyond the page.",
          severity: "warning",
        });
      const images =
        b.type === "gallery"
          ? galleryBoxes(b, rect.width, rect.height)
          : b.type === "product"
            ? productImageBoxes(
                b.product?.images,
                b.presentation?.imageLayout,
              ).map((im) => ({
                ...im,
                width: im.width * rect.width,
                height: im.height * rect.height * 0.6,
              }))
            : [
                {
                  assetId: b.assetId || b.product?.images?.[0] || b.posterId,
                  width: rect.width,
                  height: rect.height,
                },
              ];
      for (const im of images) {
        const asset = byId.get(im.assetId);
        if (
          asset &&
          (asset.width < im.width * 1.5 || asset.height < im.height * 1.5)
        )
          found.push({
            pageId: source.id,
            blockId: b.masterSourceId || b.id,
            message:
              "This image may look soft in print. Use a higher-resolution image.",
            severity: "warning",
          });
      }
    }
  }
  return found;
}

export function findRenderedBlock(doc, id) {
  for (const [index, page] of doc.pages.entries()) {
    const found = effectivePage(page, doc, index).blocks.find(
      (b) => b.id === id,
    );
    if (found) return found;
  }
  return (doc.masters || []).flatMap((m) => m.blocks).find((b) => b.id === id);
}
