import { esc } from "./html.mjs";
import { safeUrl, formatPrice } from "./document.mjs";
import {
  styleOf,
  brandOf,
  DEFAULT_PRODUCT_FIELDS,
  galleryBoxes,
  productImageBoxes,
} from "./design.mjs";
import { ICONS } from "./icons.mjs";
import { CUSTOM_FONT } from "./editor-schema.mjs";
import { builtinFontStack } from "./fonts.mjs";
import { rectangle, PAGE } from "./layout.mjs";
export const fontFamily = (font) =>
  CUSTOM_FONT.test(font || "")
    ? `'ff-${font.slice(7)}','DM Sans',sans-serif`
    : builtinFontStack(font);
// @font-face rules for uploaded fonts; urlFor(id) returns an authorized URL.
export const fontFaceCSS = (ids, urlFor) =>
  ids
    .filter((id) => /^[0-9a-f-]{36}$/.test(id))
    .map(
      (id) =>
        `@font-face{font-family:'ff-${id}';src:url("${esc(urlFor(id))}");font-display:block}`,
    )
    .join("");
export const editorCSS = `
.magazine{font-family:var(--body-font,"DM Sans",sans-serif)}.page-grid{display:block;position:relative}.mag-block{position:absolute}.mag-page{isolation:isolate}.page-background{position:absolute;inset:0;z-index:-1;overflow:hidden}.page-background img{width:100%;height:100%;object-fit:cover}.background-overlay{position:absolute;inset:0}
.mag-text p{margin:0;min-height:1em}.mag-text ul,.mag-text ol{margin:0;padding-left:1.4em;white-space:normal}.mag-text li{white-space:pre-wrap}.mag-text a{color:inherit}.mag-gallery{position:relative;width:100%;height:100%}.gallery-tile{position:absolute;overflow:hidden;border:0;padding:0;background:transparent;cursor:pointer}.gallery-tile img{width:100%;height:100%;object-fit:cover}.mag-shape{display:block;width:100%;height:100%}.mag-icon{display:block;width:100%;height:100%;overflow:visible}.product-images{position:relative;width:100%;height:100%}.product-tile{position:absolute;overflow:hidden}.mag-hotspot{display:flex;width:100%;height:100%;padding:0;align-items:center;justify-content:center;background:transparent;border:0;color:inherit;text-decoration:none;cursor:pointer}.hotspot-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}.mag-media{height:100%;display:flex;flex-direction:column;gap:8px}.media-poster{min-height:0;flex:1;position:relative;overflow:hidden}.media-poster img{width:100%;height:100%;object-fit:cover}.media-poster a{position:absolute;inset:auto 10px 10px;background:#fff;padding:8px;color:#242722;text-decoration:none}.mag-media video{width:100%;min-height:0;flex:1;object-fit:contain}.mag-media audio{width:100%;height:40px}.media-caption{font-size:14px;line-height:1.3}.media-print{display:none}.product-card .product-description,.product-card .product-sku,.product-card .product-category{font-size:.85em}.product-card.no-photo .product-copy{flex:1}.flow .mag-block{position:relative!important;left:auto!important;top:auto!important;width:100%!important;height:auto!important;transform:none!important}.flow .mag-gallery{height:360px}.flow .mag-shape{height:120px}.flow .mag-media{min-height:280px}.flow .page-background{display:none}
@media print{.mag-media video,.mag-media audio{display:none!important}.media-print{display:flex!important}}
`;
export function imageHTML(
  id,
  alt,
  assetUrl,
  crop = { x: 50, y: 50, zoom: 1 },
  frame = "rectangle",
) {
  const clip =
    frame === "diamond"
      ? "polygon(50% 0,100% 50%,50% 100%,0 50%)"
      : frame === "circle"
        ? "circle(closest-side)"
        : frame === "ellipse"
          ? "ellipse(50% 50%)"
          : "none";
  return id
    ? `<span class="image-frame" style="display:block;width:100%;height:100%;overflow:hidden;clip-path:${clip}"><img src="${esc(assetUrl(id))}" alt="${esc(alt)}" style="object-position:${Number(crop.x)}% ${Number(crop.y)}%;transform:scale(${Number(crop.zoom)})" /></span>`
    : '<div class="image-placeholder">Add an image</div>';
}
export function richHTML(paragraphs) {
  const inline = (r) => {
    let html = esc(r.text);
    if (r.bold) html = "<strong>" + html + "</strong>";
    if (r.italic) html = "<em>" + html + "</em>";
    if (r.underline) html = "<u>" + html + "</u>";
    if (r.color) html = `<span style="color:${esc(r.color)}">${html}</span>`;
    if (safeUrl(r.href))
      html = `<a href="${esc(safeUrl(r.href))}" target="_blank" rel="noopener noreferrer">${html}</a>`;
    return html;
  };
  let result = "",
    list = null;
  for (const p of paragraphs) {
    const type = p.kind === "bullet" ? "ul" : p.kind === "number" ? "ol" : null;
    if (type !== list) {
      if (list) result += `</${list}>`;
      if (type) result += `<${type}>`;
      list = type;
    }
    result += `<${type ? "li" : "p"}>${p.runs.map(inline).join("") || "<br>"}</${type ? "li" : "p"}>`;
  }
  return result + (list ? `</${list}>` : "");
}
export function backgroundHTML(background, assetUrl, paper) {
  if (!background) return "";
  let style = `background:${esc(background.color || paper)}`,
    image = "";
  if (background.type === "gradient")
    style = `background:linear-gradient(${Number(background.angle)}deg,${esc(background.color)},${esc(background.color2)})`;
  if (background.type === "image")
    image = imageHTML(background.assetId, "", assetUrl, background.crop);
  const overlay = background.overlayOpacity
    ? `<div class="background-overlay" style="background:${esc(background.overlayColor || "#000000")};opacity:${Number(background.overlayOpacity)}"></div>`
    : "";
  return `<div class="page-background" aria-hidden="true" style="${style}">${image}${overlay}</div>`;
}
export function shapePath(shape) {
  return (
    {
      arrow: "M 0 35 L 65 35 L 65 10 L 100 50 L 65 90 L 65 65 L 0 65 Z",
      star: "M50 0 L61 35 L98 35 L68 57 L79 94 L50 72 L21 94 L32 57 L2 35 L39 35 Z",
      badge: "M25 0 L75 0 L100 25 L100 75 L75 100 L25 100 L0 75 L0 25 Z",
      heart: "M50 90 C-30 40 5 -20 50 20 C95 -20 130 40 50 90 Z",
    }[shape] || ""
  );
}
function productPhotoHTML(product, layout, image) {
  const boxes = productImageBoxes(product.images, layout);
  if (boxes.length < 2) return image(product.images[0], product.name);
  const pct = (n) => `${Number((n * 100).toFixed(3))}%`;
  return `<div class="product-images">${boxes
    .map(
      (box, i) =>
        `<span class="product-tile" style="left:${pct(box.x)};top:${pct(box.y)};width:${pct(box.width)};height:${pct(box.height)}">${image(box.assetId, i ? `${product.name} view ${i + 1}` : product.name)}</span>`,
    )
    .join("")}</div>`;
}
export function renderBlockHTML(b, doc, assetUrl, { pdf = false } = {}) {
  const brand = brandOf(doc),
    style = styleOf(b, doc),
    appearance = b.appearance || {},
    r = rectangle(b.rect);
  const image = (id, alt, crop) =>
    imageHTML(id, alt, assetUrl, crop, appearance.frame);
  let content = "";
  if (b.type === "text")
    content = `<div class="mag-text" data-overflow-text style="font-family:${fontFamily(style.font)};font-size:${Number(style.size)}px;font-weight:${style.bold ? 700 : 400};font-style:${style.italic ? "italic" : "normal"};text-decoration:${style.underline ? "underline" : "none"};text-align:${esc(style.align)};color:${esc(style.color)};line-height:${Number(style.lineHeight)};letter-spacing:${Number(style.letterSpacing)}px">${b.richText ? richHTML(b.richText) : esc(b.text)}</div>`;
  if (b.type === "image")
    content = `<div class="mag-image">${image(b.assetId, b.decorative ? "" : b.alt, b.crop)}</div>`;
  if (b.type === "divider") content = '<div class="mag-divider"></div>';
  if (b.type === "button")
    content = `<a class="mag-button" href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer">${esc(b.text)}</a>`;
  if (b.type === "shape") {
    const stroke = esc(appearance.borderColor || brand.ink),
      fill = esc(appearance.fill || brand.accent),
      width = Number(appearance.borderWidth || 0);
    const shape =
      b.shape === "ellipse"
        ? '<ellipse cx="50" cy="50" rx="48" ry="48"/>'
        : b.shape === "line"
          ? '<path d="M0 50 L100 50" fill="none"/>'
          : b.shape === "rectangle"
            ? `<rect x="1" y="1" width="98" height="98" rx="${Math.min(48, Number(appearance.radius || 0))}"/>`
            : `<path d="${shapePath(b.shape)}"/>`;
    content = `<svg class="mag-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" fill="${fill}" stroke="${stroke}" stroke-width="${b.shape === "line" ? Math.max(1, width) : width}">${shape}</svg>`;
  }
  if (b.type === "product") {
    const p = b.product,
      presentation = b.presentation || {},
      fields = presentation.fields || DEFAULT_PRODUCT_FIELDS,
      show = (f) => fields.includes(f);
    const photo = show("image")
      ? `<div class="product-photo"${!pdf ? ` data-product="${esc(b.id)}" role="button" tabindex="0" aria-label="View ${esc(p.name || "product")} details"` : ""}>${productPhotoHTML(p, presentation.imageLayout, image)}${show("badge") && p.badge ? `<span class="product-badge" style="background:${esc(presentation.badgeColor || brand.paper)};color:${esc(presentation.badgeTextColor || brand.ink)}">${esc(p.badge)}</span>` : ""}</div>`
      : "";
    const copy = [
      show("name") ? `<h3>${esc(p.name || "Product name")}</h3>` : "",
      show("summary")
        ? `<p>${esc(p.summary || "Add a description for your product.")}</p>`
        : "",
      show("description")
        ? `<p class="product-description">${esc(p.description)}</p>`
        : "",
      show("sku") && p.sku
        ? `<p class="product-sku">SKU: ${esc(p.sku)}</p>`
        : "",
      show("category") && p.category
        ? `<p class="product-category">${esc(p.category)}</p>`
        : "",
      show("price")
        ? `<div class="price" style="color:${esc(presentation.priceColor || brand.ink)};${presentation.priceSize ? `font-size:${Number(presentation.priceSize)}px` : ""}">${esc(formatPrice(p))}</div>`
        : "",
      show("link") && p.url
        ? `<a data-product-link="${esc(b.id)}" href="${esc(safeUrl(p.url))}" target="_blank" rel="noopener noreferrer">View product ↗</a>`
        : "",
    ].join("");
    content = `<article class="product-card ${show("image") ? "" : "no-photo"}" style="font-size:${Number(b.size)}px;${presentation.background ? `background:${esc(presentation.background)}` : ""}">${photo}<div class="product-copy" data-overflow-text>${copy}</div></article>`;
  }
  if (b.type === "icon") {
    const label = String(b.label || "").trim();
    content = `<svg class="mag-icon" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" fill="none" stroke="${esc(b.color || brand.accent)}" stroke-width="${Number(b.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'}>${(ICONS[b.icon] || []).map((d) => `<path d="${esc(d)}"/>`).join("")}</svg>`;
  }
  if (b.type === "gallery")
    content = `<div class="mag-gallery">${galleryBoxes(b, r.width, r.height)
      .map(
        (im, index) =>
          `<${pdf ? "div" : 'button type="button"'} class="gallery-tile" ${pdf ? "" : `data-page-gallery="${esc(b.id)}" data-image="${index}" aria-label="Open gallery image ${index + 1}: ${esc(im.alt)}"`} style="left:${im.x}px;top:${im.y}px;width:${im.width}px;height:${im.height}px">${image(im.assetId, im.alt)}</${pdf ? "div" : "button"}>`,
      )
      .join("")}</div>`;
  if (b.type === "hotspot") {
    const action = b.action || {},
      label = `<span class="${b.showLabel ? "" : "hotspot-label"}">${esc(b.label)}</span>`;
    if (action.kind === "url")
      content = `<a class="mag-hotspot" aria-label="${esc(b.label)}" href="${esc(safeUrl(action.url))}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    if (action.kind === "page")
      content = `<a class="mag-hotspot" aria-label="${esc(b.label)}" href="?page=${esc(encodeURIComponent(action.pageId))}" data-page-link="${esc(action.pageId)}">${label}</a>`;
    if (action.kind === "product")
      content = `<button class="mag-hotspot" aria-label="${esc(b.label)}" data-product="${esc(action.blockId)}" type="button">${label}</button>`;
  }
  if (b.type === "media") {
    const poster = `<div class="media-poster">${b.posterId ? image(b.posterId, b.title) : '<div class="image-placeholder">' + esc(b.mediaKind === "audio" ? "Audio story" : "Video story") + "</div>"}<a href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer">${esc(b.title || "Open media")} ↗</a></div>`;
    const player =
      b.mediaKind === "video"
        ? `<video controls preload="none" ${b.posterId ? `poster="${esc(assetUrl(b.posterId))}"` : ""} src="${esc(safeUrl(b.url))}" aria-label="${esc(b.title)}"></video>`
        : `${poster}<audio controls preload="none" src="${esc(safeUrl(b.url))}" aria-label="${esc(b.title)}"></audio>`;
    content = `<div class="mag-media">${pdf ? poster : player + `<div class="media-print media-poster">${poster}</div>`}<div class="media-caption"><strong>${esc(b.title)}</strong><p>${esc(b.description)}</p></div></div>`;
  }
  const transforms = [
    `rotate(${Number(appearance.rotation || 0)}deg)`,
    `scale(${appearance.flipX ? -1 : 1},${appearance.flipY ? -1 : 1})`,
  ].join(" ");
  const border =
    b.type === "shape"
      ? ""
      : `border:${Number(appearance.borderWidth || 0)}px solid ${esc(appearance.borderColor || brand.ink)};`;
  return `<div class="mag-block" data-block-id="${esc(b.id)}" ${b.name ? `aria-label="${esc(b.name)}"` : ""} style="left:${r.x - PAGE.padding}px;top:${r.y - PAGE.padding}px;width:${r.width}px;height:${r.height}px;opacity:${Number(appearance.opacity ?? 1)};transform:${transforms};${border}border-radius:${Number(appearance.radius || 0)}px;${appearance.fill && b.type !== "shape" ? `background:${esc(appearance.fill)};` : ""}">${content}</div>`;
}
