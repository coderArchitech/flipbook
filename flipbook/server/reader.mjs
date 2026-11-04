import { renderPage, pageCSS, themeStyle, esc } from "../shared/render.mjs";
import { fontFaceCSS } from "../shared/editor-render.mjs";
import { builtinFontFaceCSS } from "../shared/fonts.mjs";
import { fontIds } from "../shared/document.mjs";
const button = (id, label, icon, extra = "") =>
  `<button id="${id}" aria-label="${label}" title="${label}" ${extra}>${icon}</button>`;
export function readerHTML(publication, version, eventToken) {
  const doc = JSON.parse(version.document),
    assetUrl = (id) =>
      "/api/reader/" +
      publication.slug +
      "/assets/" +
      id +
      "?version=" +
      version.id;
  const data = JSON.stringify({
    slug: publication.slug,
    versionId: version.id,
    document: doc,
    eventToken,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(doc.title)} · Flipbook</title><link rel="stylesheet" href="/reader.css"><link rel="stylesheet" href="/book-viewer.css"><style>${builtinFontFaceCSS()}${pageCSS}${fontFaceCSS(fontIds(doc), (id) => `/api/reader/${publication.slug}/fonts/${id}?version=${version.id}`)}</style></head><body>
  <header class="reader-bar"><a class="reader-brand" href="#" aria-label="First page">flipbook<span>®</span></a><div class="reader-title">${esc(doc.title)}<small>${esc(doc.publisher)}</small></div><div class="reader-actions"><button id="view" aria-pressed="false">Scroll view</button><button id="sound" aria-label="Mute flip sound" aria-pressed="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><g class="sound-waves"><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></g><path class="sound-muted" d="m16 9 6 6m0-6-6 6" hidden/></svg></button><button id="share">Share</button><button id="download" aria-label="Download PDF"><span class="download-long">Download </span>PDF ↓</button></div></header>
  <div id="reader-status" role="status"></div>
  <aside class="reader-sidebar" id="reader-sidebar" aria-label="Publication navigation" hidden><header><h2 id="sidebar-title">Pages</h2>${button("close-sidebar", "Close navigation", "×")}</header><div class="sidebar-tabs"><button id="thumbnails-tab" aria-pressed="true">Thumbnails</button><button id="contents-tab" aria-pressed="false">Contents</button></div><label class="reader-search" hidden>Search publication<input id="search-query" type="search" placeholder="Products, words, SKU…" maxlength="200"></label><p id="search-count" role="status"></p><div id="page-list"></div><div id="search-results" hidden></div></aside>
  <div class="book-surround"><button class="edge-turn edge-previous" aria-label="Turn to previous spread">‹</button><main id="magazine" class="magazine" style="${themeStyle(doc.theme)}">${doc.pages.map((p, i) => renderPage(p, doc, assetUrl, i)).join("")}</main><button class="edge-turn edge-next" aria-label="Turn to next spread">›</button></div>
  <nav class="reader-nav" aria-label="Page navigation"><div class="reader-nav-main">${button("first", "Go to first page", "⇤")}${button("previous", "Previous page", "←")}<span id="page-position" role="status" aria-live="polite"></span><select id="pages" aria-label="Jump to page">${doc.pages.map((p, i) => `<option value="${i}">${i + 1} / ${doc.pages.length} — ${esc(p.title)}</option>`).join("")}</select>${button("next", "Next page", "→")}${button("last", "Go to last page", "⇥")}</div><div class="reader-nav-tools">${button("thumbnails", "Show thumbnails", "▦", 'aria-expanded="false"')}${button("search", "Search publication", "⌕", 'aria-expanded="false"')}${button("options", "View options", "☷")}${button("zoom-out", "Zoom out", "−")}${button("zoom", "Zoom in", "＋")}${button("fit", "Fit book", "Fit", "hidden")}${button("fullscreen", "Enter fullscreen", "⛶")}${button("autoplay", "Start autoplay", "▷", 'aria-pressed="false"')}${button("print", "Print publication", "Print")}</div></nav>
  <dialog id="options-dialog" aria-label="View options"><header><h2>Make yourself comfortable.</h2>${button("close-options", "Close view options", "×")}</header><div class="view-fields"><label>View mode<select id="view-mode" aria-label="View mode"><option value="3d">3D book</option><option value="2d">2D book</option><option value="slide">Slide viewer</option><option value="scroll">Scroll reader</option></select></label><label>Page layout<select id="page-layout" aria-label="Page layout"><option value="auto">Automatic</option><option value="single">Single page</option><option value="spread">Double page</option></select></label><label>Reading direction<select id="reading-direction" aria-label="Reading direction"><option value="ltr">Left to right</option><option value="rtl">Right to left</option></select></label><label>Binding<select id="binding" aria-label="Binding"><option value="hard">Hard cover</option><option value="soft">Soft cover</option><option value="spiral">Spiral binding</option></select></label><label>Surround<select id="reader-background" aria-label="Surround"><option value="warm">Warm paper</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><p class="reader-tip">Drag a page to turn it. Drag back to cancel. When zoomed, drag to pan; pinch or Ctrl + scroll to zoom.</p><p id="rendering-note" role="status"></p></dialog>
  <dialog id="product-dialog"><button id="close-dialog" aria-label="Close product details">×</button><div id="product-detail"></div></dialog><script type="application/json" id="reader-data">${data}</script><script type="module" src="/reader.js"></script></body></html>`;
}
