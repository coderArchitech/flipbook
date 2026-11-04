import { THEMES, safeUrl, formatPrice } from "./document.mjs";
import { esc } from "./html.mjs";
export { esc } from "./html.mjs";
import { brandOf, effectivePage } from "./design.mjs";
import {
  renderBlockHTML,
  backgroundHTML,
  editorCSS,
  fontFamily,
} from "./editor-render.mjs";
export const pageCSS =
  `
.magazine{color:var(--ink);font-family:'DM Sans',sans-serif}.mag-page{width:794px;height:1123px;padding:45px;box-sizing:border-box;background:var(--paper);position:relative;overflow:hidden}.page-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-template-rows:repeat(36,minmax(0,1fr));gap:7px;height:100%;width:100%}.mag-block{min-width:0;min-height:0;position:relative;box-sizing:border-box;overflow:hidden}.mag-text{white-space:pre-wrap;line-height:1.2;font-family:var(--font);margin:0}.mag-image{width:100%;height:100%;overflow:hidden}.mag-image img{width:100%;height:100%;object-fit:cover;display:block}.image-placeholder{height:100%;min-height:60px;background:color-mix(in srgb,var(--ink) 7%,var(--paper));display:flex;align-items:center;justify-content:center;color:var(--ink);font-size:13px;letter-spacing:.02em}.product-card{height:100%;display:flex;flex-direction:column;gap:8px;min-height:0}.product-card .product-photo{flex:1;min-height:0;overflow:hidden;position:relative}.product-card .product-photo img{width:100%;height:100%;object-fit:cover;display:block}.product-copy{flex:none;padding:4px 2px;line-height:1.4}.product-copy h3{font-family:var(--font);font-size:1.25em;line-height:1.15;margin:0 0 5px}.product-copy p{font-size:.85em;margin:0 0 5px;white-space:pre-wrap}.product-copy .price{font-size:.85em;font-weight:700}.product-copy a{font-size:.75em;color:var(--accent);display:inline-block;margin-top:5px}.product-badge{position:absolute;top:10px;left:10px;background:var(--paper);padding:5px 8px;font:10px 'DM Sans',sans-serif;letter-spacing:1px;text-transform:uppercase}.mag-button{display:inline-flex;align-items:center;justify-content:center;background:var(--ink);color:var(--paper);text-decoration:none;height:100%;width:100%;padding:8px;box-sizing:border-box;font-family:'DM Sans',sans-serif}.mag-divider{height:1px;background:var(--ink);margin-top:8px}.flow .mag-page{height:auto;width:100%;padding:24px;overflow:visible}.flow .page-grid{display:flex;flex-direction:column;gap:24px}.flow .mag-block{overflow:visible}.flow .mag-image{height:340px}.flow .product-photo{height:340px;flex:auto}.flow .mag-text{font-size:clamp(16px,6vw,38px)!important}.flow .mag-button{min-height:48px}.flow .product-card{font-size:18px!important}.page-footer{position:absolute;bottom:15px;left:45px;right:45px;display:flex;justify-content:space-between;font:9px 'DM Sans',sans-serif;letter-spacing:1px;opacity:.5}
@media print{@page{size:A4 portrait;margin:0}html,body{margin:0!important;padding:0!important;background:white!important}.mag-page{width:210mm;height:297mm;padding:12mm;break-after:page;print-color-adjust:exact;-webkit-print-color-adjust:exact}.mag-page:last-child{break-after:auto}.magazine{margin:0!important}.page-footer{bottom:4mm;left:12mm;right:12mm}.reader-only{display:none!important}}
` + editorCSS;
export function themeStyle(theme) {
  const t = typeof theme === "object" ? brandOf(theme) : brandOf({ theme });
  return (
    "--ink:" +
    t.ink +
    ";--paper:" +
    t.paper +
    ";--accent:" +
    t.accent +
    ";--font:" +
    fontFamily(t.headingFont) +
    ";--body-font:" +
    fontFamily(t.bodyFont)
  );
}
export function renderPage(
  page,
  doc,
  assetUrl,
  index = 0,
  { pdf = false } = {},
) {
  const effective = effectivePage(page, doc, index),
    brand = brandOf(doc);
  const blocks = effective.blocks
    .map((b) => renderBlockHTML(b, doc, assetUrl, { pdf }))
    .join("");
  const footer =
    page.footer === false
      ? ""
      : '<div class="page-footer"><span>' +
        esc(doc.publisher) +
        "</span><span>" +
        String(index + 1).padStart(2, "0") +
        "</span></div>";
  return (
    '<section class="mag-page" data-page-id="' +
    esc(page.id) +
    '" aria-label="Page ' +
    (index + 1) +
    ": " +
    esc(page.title) +
    '" style="' +
    esc(themeStyle(doc)) +
    '">' +
    backgroundHTML(page.background, assetUrl, brand.paper) +
    '<div class="page-grid">' +
    blocks +
    "</div>" +
    footer +
    "</section>"
  );
}
export function renderPrint(doc, assetUrl) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' +
    esc(doc.title) +
    "</title><style>" +
    pageCSS +
    '</style></head><body><main class="magazine" style="' +
    esc(themeStyle(doc)) +
    '">' +
    doc.pages
      .map((p, i) => renderPage(p, doc, assetUrl, i, { pdf: true }))
      .join("") +
    "</main></body></html>"
  );
}
