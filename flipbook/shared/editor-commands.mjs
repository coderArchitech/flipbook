import { uid, THEMES, makePage, block, emptyProduct } from "./document.mjs";
const clone = (value) => structuredClone(value);
export function upgradeDocument(document) {
  const doc = clone(document);
  doc.schemaVersion = 2;
  doc.styles ||= [];
  doc.masters ||= [];
  doc.brand ||= {
    ink: THEMES[doc.theme].ink,
    paper: THEMES[doc.theme].paper,
    accent: THEMES[doc.theme].accent,
    headingFont: doc.theme === "modern" ? "sans" : "serif",
    bodyFont: "sans",
    logoAssetId: null,
  };
  return doc;
}
export function selectionIds(page, ids) {
  const selected = new Set(ids),
    groups = new Set(
      page.blocks
        .filter((b) => selected.has(b.id) && b.groupId)
        .map((b) => b.groupId),
    );
  return page.blocks
    .filter((b) => selected.has(b.id) || groups.has(b.groupId))
    .map((b) => b.id);
}
export function selectedBlocks(page, ids, { editable = false } = {}) {
  const expanded = new Set(selectionIds(page, ids));
  const blocks = page.blocks.filter((b) => expanded.has(b.id));
  if (editable && blocks.some((b) => b.locked))
    throw Error("Unlock the selected layers before editing them.");
  return blocks;
}
export function bounds(blocks) {
  if (!blocks.length) return null;
  const left = Math.min(...blocks.map((b) => b.rect[0])),
    top = Math.min(...blocks.map((b) => b.rect[1]));
  const right = Math.max(...blocks.map((b) => b.rect[0] + b.rect[2])),
    bottom = Math.max(...blocks.map((b) => b.rect[1] + b.rect[3]));
  return [left, top, right - left, bottom - top];
}
const finite = (...values) => {
  if (values.some((n) => !Number.isFinite(n)))
    throw Error("Use finite position and size values.");
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const round = (n) => Math.round(n * 1000) / 1000;
export function moveSelection(page, ids, dx, dy) {
  finite(dx, dy);
  const blocks = selectedBlocks(page, ids, { editable: true }),
    box = bounds(blocks);
  if (!box) return;
  dx = clamp(dx, -box[0], 12 - box[0] - box[2]);
  dy = clamp(dy, -box[1], 36 - box[1] - box[3]);
  for (const b of blocks)
    b.rect = [round(b.rect[0] + dx), round(b.rect[1] + dy), ...b.rect.slice(2)];
}
export function resizeSelection(page, ids, width, height) {
  finite(width, height);
  const blocks = selectedBlocks(page, ids, { editable: true }),
    box = bounds(blocks);
  if (!box) return;
  const minWidth = Math.max(...blocks.map((b) => box[2] / b.rect[2])),
    minHeight = Math.max(...blocks.map((b) => box[3] / b.rect[3]));
  width = clamp(width, minWidth, 12 - box[0]);
  height = clamp(height, minHeight, 36 - box[1]);
  const sx = width / box[2],
    sy = height / box[3];
  for (const b of blocks)
    b.rect = [
      round(box[0] + (b.rect[0] - box[0]) * sx),
      round(box[1] + (b.rect[1] - box[1]) * sy),
      round(b.rect[2] * sx),
      round(b.rect[3] * sy),
    ];
}
export function groupSelection(page, ids) {
  const blocks = selectedBlocks(page, ids, { editable: true });
  if (blocks.length < 2) throw Error("Select at least two layers to group.");
  const groupId = uid();
  for (const b of blocks) b.groupId = groupId;
  return groupId;
}
export function ungroupSelection(page, ids) {
  for (const b of selectedBlocks(page, ids, { editable: true }))
    delete b.groupId;
}
export function reorderLayers(page, ids, action) {
  const selected = new Set(selectionIds(page, ids));
  selectedBlocks(page, ids, { editable: true });
  if (action === "front" || action === "back") {
    const chosen = page.blocks.filter((b) => selected.has(b.id)),
      others = page.blocks.filter((b) => !selected.has(b.id));
    page.blocks =
      action === "front" ? [...others, ...chosen] : [...chosen, ...others];
  } else if (action === "forward") {
    for (let i = page.blocks.length - 2; i >= 0; i--)
      if (
        selected.has(page.blocks[i].id) &&
        !selected.has(page.blocks[i + 1].id)
      )
        [page.blocks[i], page.blocks[i + 1]] = [
          page.blocks[i + 1],
          page.blocks[i],
        ];
  } else if (action === "backward") {
    for (let i = 1; i < page.blocks.length; i++)
      if (
        selected.has(page.blocks[i].id) &&
        !selected.has(page.blocks[i - 1].id)
      )
        [page.blocks[i], page.blocks[i - 1]] = [
          page.blocks[i - 1],
          page.blocks[i],
        ];
  } else throw Error("Unknown layer order action.");
}
// toPage may be true (whole page) or a grid box such as the master margins.
export function alignSelection(page, ids, alignment, toPage = false) {
  const blocks = selectedBlocks(page, ids, { editable: true }),
    box = Array.isArray(toPage)
      ? toPage
      : toPage
        ? [0, 0, 12, 36]
        : bounds(blocks);
  if (!box) return;
  for (const b of blocks) {
    const r = b.rect;
    if (alignment === "left") r[0] = box[0];
    else if (alignment === "center") r[0] = box[0] + (box[2] - r[2]) / 2;
    else if (alignment === "right") r[0] = box[0] + box[2] - r[2];
    else if (alignment === "top") r[1] = box[1];
    else if (alignment === "middle") r[1] = box[1] + (box[3] - r[3]) / 2;
    else if (alignment === "bottom") r[1] = box[1] + box[3] - r[3];
    else throw Error("Unknown alignment.");
  }
}
export function distributeSelection(page, ids, axis = "x") {
  const blocks = selectedBlocks(page, ids, { editable: true });
  if (blocks.length < 3)
    throw Error("Select at least three layers to distribute.");
  if (!["x", "y"].includes(axis)) throw Error("Unknown distribution axis.");
  const at = axis === "x" ? 0 : 1,
    size = at + 2;
  blocks.sort((a, b) => a.rect[at] - b.rect[at]);
  const start = blocks[0].rect[at],
    end = blocks.at(-1).rect[at] + blocks.at(-1).rect[size];
  const gap =
    (end - start - blocks.reduce((n, b) => n + b.rect[size], 0)) /
    (blocks.length - 1);
  let position = start;
  for (const b of blocks) {
    b.rect[at] = round(position);
    position += b.rect[size] + gap;
  }
}
export function snappedMove(
  page,
  ids,
  dx,
  dy,
  { threshold = 0.18, grid = 0.25, margins = null } = {},
) {
  const selected = new Set(selectionIds(page, ids)),
    box = bounds(page.blocks.filter((b) => selected.has(b.id)));
  if (!box) return { dx: 0, dy: 0, guides: [] };
  finite(dx, dy, threshold, grid);
  if (grid <= 0 || threshold < 0) throw Error("Invalid snapping settings.");
  const targets = { x: [0, 6, 12], y: [0, 18, 36] },
    guides = [];
  if (margins) {
    const [mx, my, mw, mh] = margins;
    targets.x.push(mx, mx + mw / 2, mx + mw);
    targets.y.push(my, my + mh / 2, my + mh);
  }
  for (const b of page.blocks.filter((b) => !selected.has(b.id) && !b.hidden)) {
    targets.x.push(b.rect[0], b.rect[0] + b.rect[2] / 2, b.rect[0] + b.rect[2]);
    targets.y.push(b.rect[1], b.rect[1] + b.rect[3] / 2, b.rect[1] + b.rect[3]);
  }
  const snap = (axis, delta) => {
    const at = axis === "x" ? 0 : 1,
      positions = [
        box[at] + delta,
        box[at] + delta + box[at + 2] / 2,
        box[at] + delta + box[at + 2],
      ];
    let best = threshold,
      correction = null,
      target = null;
    for (const p of positions)
      for (const t of targets[axis])
        if (Math.abs(t - p) < best) {
          best = Math.abs(t - p);
          correction = t - p;
          target = t;
        }
    if (correction !== null) {
      guides.push({ axis, position: target });
      return delta + correction;
    }
    return Math.round((box[at] + delta) / grid) * grid - box[at];
  };
  return {
    dx: clamp(round(snap("x", dx)), -box[0], 12 - box[0] - box[2]),
    dy: clamp(round(snap("y", dy)), -box[1], 36 - box[1] - box[3]),
    guides,
  };
}
export function cloneBlocks(
  blocks,
  { pageMap = new Map(), idMap = new Map(), groupMap = new Map() } = {},
) {
  for (const b of blocks) if (!idMap.has(b.id)) idMap.set(b.id, uid());
  return blocks.map((source) => {
    const b = clone(source);
    b.id = idMap.get(source.id);
    if (b.groupId) {
      if (!groupMap.has(b.groupId)) groupMap.set(b.groupId, uid());
      b.groupId = groupMap.get(b.groupId);
    }
    if (b.action?.kind === "product" && idMap.has(b.action.blockId))
      b.action.blockId = idMap.get(b.action.blockId);
    if (b.action?.kind === "page" && pageMap.has(b.action.pageId))
      b.action.pageId = pageMap.get(b.action.pageId);
    return b;
  });
}
export function pasteBlocks(page, source, { offset = 1 } = {}) {
  if (page.blocks.length + source.length > 50)
    throw Error("A page supports at most 50 layers.");
  const blocks = cloneBlocks(source);
  for (const b of blocks) b.locked = false;
  const temp = { blocks };
  moveSelection(
    temp,
    blocks.map((b) => b.id),
    offset,
    offset,
  );
  page.blocks.push(...blocks);
  return blocks.map((b) => b.id);
}
export function copyPage(page) {
  const id = uid(),
    result = { ...clone(page), id };
  result.blocks = cloneBlocks(page.blocks, {
    pageMap: new Map([[page.id, id]]),
  });
  return result;
}
export function copyDocument(document) {
  const doc = clone(document),
    pageMap = new Map(doc.pages.map((p) => [p.id, uid()])),
    idMap = new Map();
  for (const p of [...doc.pages, ...(doc.masters || [])])
    for (const b of p.blocks) idMap.set(b.id, uid());
  doc.pages = doc.pages.map((p) => ({
    ...p,
    id: pageMap.get(p.id),
    blocks: cloneBlocks(p.blocks, { pageMap, idMap }),
  }));
  const masterMap = new Map((doc.masters || []).map((m) => [m.id, uid()]));
  doc.masters = (doc.masters || []).map((m) => ({
    ...m,
    id: masterMap.get(m.id),
    blocks: cloneBlocks(m.blocks, { pageMap, idMap }),
  }));
  for (const p of doc.pages)
    if (p.masterId) p.masterId = masterMap.get(p.masterId);
  return doc;
}
export function generateProductPages(document, products, template = "grid") {
  if (!["grid", "feature"].includes(template))
    throw Error("Choose grid or product feature.");
  const perPage = template === "grid" ? 4 : 1,
    count = Math.ceil(products.length / perPage);
  if (document.pages.length + count > 100)
    throw Error("Generated pages would exceed the 100-page limit.");
  const added = [];
  for (let i = 0; i < products.length; i += perPage) {
    const page = makePage(template),
      batch = products.slice(i, i + perPage);
    let productIndex = 0;
    page.blocks = page.blocks.filter(
      (b) => b.type !== "product" || productIndex++ < batch.length,
    );
    productIndex = 0;
    for (const b of page.blocks)
      if (b.type === "product")
        b.product = clone(
          batch[productIndex++].content || batch[productIndex - 1],
        );
    page.title =
      template === "feature"
        ? batch[0].content?.name || batch[0].name
        : "Collection " + (added.length + 1);
    added.push(page);
  }
  document.pages.push(...added);
  return added.map((p) => p.id);
}
export function newElement(type, rect = [0, 0, 6, 6]) {
  const extra = {
    text: { text: "Your story goes here." },
    button: { text: "Explore more", url: "https://example.com" },
    product: { product: emptyProduct() },
    shape: {
      shape: "rectangle",
      appearance: { fill: "#bd5639", borderWidth: 0 },
    },
    gallery: { images: [], columns: 2, gap: 8 },
    icon: { icon: "star", color: null, strokeWidth: 2, label: "" },
    hotspot: {
      label: "Explore product",
      action: { kind: "url", url: "https://example.com" },
    },
    media: {
      mediaKind: "video",
      url: "https://example.com/video.mp4",
      title: "Watch the story",
      description: "",
      posterId: null,
    },
  };
  return block(type, rect, extra[type] || {});
}
