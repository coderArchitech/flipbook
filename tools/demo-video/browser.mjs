// Browser setup shared by the preview and the recorder: local routes for the
// PDF viewer and the demo film, plus a visible cursor (headless video has none).
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { FLIPBOOK, HERE, OUT } from "./paths.mjs";
import { FILM_URL } from "./build.mjs";

export const { chromium, devices } = createRequire(FLIPBOOK + "/package.json")("@playwright/test");

export const launch = () => chromium.launch({ headless: true });

export async function routes(context, state = {}) {
  const file = (path, type) => (route) =>
    route.fulfill({ status: 200, contentType: type, body: readFileSync(typeof path === "function" ? path() : path) });
  const pdfjs = HERE + "node_modules/pdfjs-dist/build/";
  await context.route("**/__demo/pdf.html", file(HERE + "pdf-viewer.html", "text/html"));
  await context.route("**/__demo/pdf.mjs", file(pdfjs + "pdf.min.mjs", "text/javascript"));
  await context.route("**/__demo/pdf.worker.mjs", file(pdfjs + "pdf.worker.min.mjs", "text/javascript"));
  await context.route("**/__demo/edition.pdf", file(() => state.pdf, "application/pdf"));
  await context.route(FILM_URL, file(OUT + "/assets/wheel.webm", "video/webm"));
}

// Drawn in the top layer so it stays above modal dialogs.
export const CURSOR_SCRIPT = `(() => {
  const install = () => {
    if (document.getElementById("demo-cursor-layer")) return;
    const layer = document.createElement("div");
    layer.id = "demo-cursor-layer";
    layer.setAttribute("popover", "manual");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:fixed;inset:0;pointer-events:none;overflow:visible;background:transparent;border:0;margin:0;padding:0;width:100vw;height:100vh;max-width:none;max-height:none;z-index:2147483647";
    layer.innerHTML = '<div id="demo-ring" style="position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid rgba(255,190,60,.95);background:rgba(255,190,60,.25);opacity:0;transform:scale(.4);transition:opacity .35s,transform .35s"></div><svg id="demo-arrow" width="28" height="28" viewBox="0 0 28 28" style="position:absolute;left:-200px;top:-200px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><path d="M3 2l19 11-8.5 1.8 4.8 9.2-3.4 1.7-4.8-9.2L4 22z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.append(layer);
    const show = () => { try { layer.hidePopover(); } catch {} try { layer.showPopover(); } catch {} };
    show();
    let x = window.__demoX ?? -200, y = window.__demoY ?? -200;
    const arrow = layer.querySelector("#demo-arrow"), ring = layer.querySelector("#demo-ring");
    if (window.__demoTouch) arrow.style.display = "none";
    const place = () => { arrow.style.left = x - 3 + "px"; arrow.style.top = y - 2 + "px"; ring.style.left = x + "px"; ring.style.top = y + "px"; };
    place();
    const move = (e) => { x = window.__demoX = e.clientX; y = window.__demoY = e.clientY; place(); };
    addEventListener("pointermove", move, true);
    addEventListener("pointerdown", (e) => { move(e); ring.style.transition = "none"; ring.style.opacity = "1"; ring.style.transform = "scale(.5)"; requestAnimationFrame(() => { ring.style.transition = "opacity .45s,transform .45s"; ring.style.transform = "scale(1.4)"; ring.style.opacity = "0"; }); }, true);
    new MutationObserver(show).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["open"], childList: false });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install();
})();`;
