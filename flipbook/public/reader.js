import { findRenderedBlock } from "../shared/design.mjs";
import { BookViewer } from "./book-viewer.js";
import { FlipSound } from "./flip-sound.js";
import { navigationTools } from "./reader-navigation.js";
import { loadSettings } from "./reader-model.js";
let navigation;
const flipSound = new FlipSound();
const soundButton = document.querySelector("#sound");
function updateSound() {
  soundButton.setAttribute("aria-pressed", String(flipSound.enabled));
  soundButton.setAttribute(
    "aria-label",
    flipSound.enabled ? "Mute flip sound" : "Enable flip sound",
  );
  soundButton.title = flipSound.enabled
    ? "Mute flip sound"
    : "Enable flip sound";
  soundButton.querySelector(".sound-waves").hidden = !flipSound.enabled;
  soundButton.querySelector(".sound-muted").hidden = flipSound.enabled;
}
soundButton.onclick = () => {
  flipSound.setEnabled(!flipSound.enabled);
  updateSound();
};
updateSound();
window.addEventListener("pagehide", () => flipSound.stop());
const data = JSON.parse(document.querySelector("#reader-data").textContent);
const root = document.querySelector("#magazine"),
  pages = [...root.querySelectorAll(".mag-page")],
  select = document.querySelector("#pages"),
  status = document.querySelector("#reader-status");
let lastInteraction = Date.now(),
  viewed = new Set(),
  lastFocus,
  pageTimer;
const imageUrl = (id) =>
  "/api/reader/" + data.slug + "/assets/" + id + "?version=" + data.versionId;
const emit = (type, extra = {}) =>
  fetch("/api/reader/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: data.eventToken,
      event: { id: crypto.randomUUID(), type, ...extra },
    }),
    keepalive: true,
  }).catch(() => {});
const esc = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function pageView(i) {
  const id = data.document.pages[i].id;
  if (!viewed.has(id)) {
    viewed.add(id);
    emit("page", { pageId: id });
  }
}
const viewer = new BookViewer(root, {
  settings: loadSettings(),
  onTurn: () => flipSound.play(),
  initialIndex: Math.max(
    0,
    data.document.pages.findIndex(
      (p) => p.id === new URL(location.href).searchParams.get("page"),
    ),
  ),
  onChange(state) {
    navigation?.update(state);
    select.value = state.index;
    document.querySelector("#page-position").textContent = state.flow
      ? "Reading view"
      : state.label;
    for (const selector of ["#previous", ".edge-previous"])
      document.querySelector(selector).disabled = !state.canPrevious;
    for (const selector of ["#next", ".edge-next"])
      document.querySelector(selector).disabled = !state.canNext;
    document.querySelector("#zoom").hidden = state.flow;
    document.querySelector("#view").textContent = state.flow
      ? "Book view"
      : "Scroll view";
    document
      .querySelector("#view")
      .setAttribute("aria-pressed", String(state.flow));
    document
      .querySelector(".book-surround")
      .classList.toggle("scroll-mode", state.flow);
    const url = new URL(location.href);
    url.searchParams.set("page", data.document.pages[state.index].id);
    history.replaceState({}, "", url);
    clearTimeout(pageTimer);
    if (!state.flow && !state.busy)
      pageTimer = setTimeout(() => {
        if (!document.hidden) state.visible.forEach(pageView);
      }, 1000);
  },
});
for (const selector of ["#previous", ".edge-previous"])
  document.querySelector(selector).onclick = () => viewer.previous();
for (const selector of ["#next", ".edge-next"])
  document.querySelector(selector).onclick = () => viewer.next();
select.onchange = () => viewer.go(Number(select.value));
document.querySelector("#view").onclick = () => viewer.setFlow(!viewer.flow);
document.querySelector(".reader-brand").onclick = (e) => {
  e.preventDefault();
  viewer.go(0);
};
const zoom = document.querySelector("#zoom");
zoom.onclick = () => viewer.setZoom(viewer.zoom + 0.25);
const fullscreen = document.querySelector("#fullscreen");
fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    status.textContent = "Fullscreen is not available in this browser.";
  }
};
document.addEventListener("fullscreenchange", () => {
  fullscreen.setAttribute(
    "aria-label",
    document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
  );
});
document.querySelector("#share").onclick = async () => {
  try {
    if (navigator.share)
      await navigator.share({ title: data.document.title, url: location.href });
    else {
      await navigator.clipboard.writeText(location.href);
      status.textContent = "Publication link copied.";
    }
  } catch {}
};
document.querySelector("#download").onclick = async () => {
  try {
    const url = "/api/reader/" + data.slug + "/pdf";
    const r = await fetch(url);
    if (r.status === 202) {
      status.textContent =
        "Your PDF is being prepared. Please try again in a moment.";
      return;
    }
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.error || "PDF unavailable.");
    }
    const blob = await r.blob(),
      link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = data.document.title + ".pdf";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    status.textContent = "Your PDF is ready.";
  } catch (e) {
    status.textContent = e.message;
  }
};
const dialog = document.querySelector("#product-dialog");
document.querySelector("#close-dialog").onclick = () => dialog.close();
dialog.addEventListener("close", () => lastFocus?.focus());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close();
});
function productDetails(id) {
  const p = findRenderedBlock(data.document, id)?.product;
  if (!p) return;
  lastFocus = document.activeElement;
  let price = "";
  try {
    if (p.price !== "")
      price = new Intl.NumberFormat("en", {
        style: "currency",
        currency: p.currency,
      }).format(Number(p.price));
  } catch {}
  document.querySelector("#product-detail").innerHTML =
    '<img id="detail-hero" src="' +
    esc(imageUrl(p.images[0])) +
    '" alt="' +
    esc(p.name) +
    '"><div class="gallery">' +
    p.images
      .map(
        (id, i) =>
          '<button data-gallery="' +
          esc(id) +
          '" aria-label="View image ' +
          (i + 1) +
          '"><img src="' +
          esc(imageUrl(id)) +
          '" alt=""></button>',
      )
      .join("") +
    "</div><h2>" +
    esc(p.name) +
    "</h2><strong>" +
    esc(price) +
    "</strong><p>" +
    esc(p.description || p.summary) +
    "</p>" +
    (p.url
      ? '<a href="' +
        esc(p.url) +
        '" data-product-link="' +
        esc(id) +
        '" target="_blank" rel="noopener noreferrer">View product ↗</a>'
      : "");
  dialog.showModal();
}
function galleryDetails(id, index = 0) {
  const block = findRenderedBlock(data.document, id);
  if (!block?.images?.length) return;
  lastFocus = document.activeElement;
  const selected =
    block.images[Math.max(0, Math.min(block.images.length - 1, index))];
  document.querySelector("#product-detail").innerHTML =
    '<img id="detail-hero" src="' +
    esc(imageUrl(selected.assetId)) +
    '" alt="' +
    esc(selected.alt) +
    '"><h2>' +
    esc(block.name || "Image gallery") +
    '</h2><div class="gallery">' +
    block.images
      .map(
        (image, i) =>
          '<button data-gallery="' +
          esc(image.assetId) +
          '" data-image-alt="' +
          esc(image.alt) +
          '" aria-label="View image ' +
          (i + 1) +
          '"><img src="' +
          esc(imageUrl(image.assetId)) +
          '" alt=""></button>',
      )
      .join("") +
    "</div>";
  dialog.showModal();
}
document.addEventListener("click", (e) => {
  const pageLink = e.target.closest("[data-page-link]");
  if (pageLink) {
    e.preventDefault();
    const index = data.document.pages.findIndex(
      (p) => p.id === pageLink.dataset.pageLink,
    );
    if (index >= 0) viewer.go(index);
  }
  const pageGallery = e.target.closest("[data-page-gallery]");
  if (pageGallery)
    galleryDetails(
      pageGallery.dataset.pageGallery,
      Number(pageGallery.dataset.image) || 0,
    );
  const detail = e.target.closest("[data-product]");
  if (detail) productDetails(detail.dataset.product);
  const link = e.target.closest("[data-product-link]");
  if (link) emit("click", { blockId: link.dataset.productLink });
  const gallery = e.target.closest("[data-gallery]");
  if (gallery) {
    document.querySelector("#detail-hero").src = imageUrl(
      gallery.dataset.gallery,
    );
    if (gallery.dataset.imageAlt)
      document.querySelector("#detail-hero").alt = gallery.dataset.imageAlt;
  }
  lastInteraction = Date.now();
});
document.addEventListener("keydown", (e) => {
  lastInteraction = Date.now();
  if (
    e.target.matches("[data-product]") &&
    (e.key === "Enter" || e.key === " ")
  ) {
    e.preventDefault();
    productDetails(e.target.dataset.product);
  }
  if (
    !dialog.open &&
    e.target.closest(".reader-nav") &&
    ["ArrowLeft", "ArrowRight"].includes(e.key)
  ) {
    e.preventDefault();
    e.key === "ArrowRight" ? viewer.next() : viewer.previous();
  }
});
window.addEventListener("scroll", () => (lastInteraction = Date.now()), {
  passive: true,
});
setTimeout(() => {
  if (!document.hidden) emit("view");
}, 1000);
setInterval(() => {
  if (document.hidden) return;
  if (viewer.flow) {
    pages.forEach((p, i) => {
      const r = p.getBoundingClientRect();
      if (
        Math.min(r.bottom, innerHeight) - Math.max(r.top, 76) >
        Math.min(r.height, innerHeight - 76) * 0.5
      )
        pageView(i);
    });
  }
  if (Date.now() - lastInteraction < 60000)
    emit("engagement", { activeMs: 10000 });
}, 10000);
setInterval(async () => {
  if (document.hidden) return;
  try {
    const r = await fetch("/api/reader/" + data.slug + "/status");
    if (!r.ok) {
      status.textContent = "This publication is no longer available.";
      root.hidden = true;
      document.querySelector(".reader-nav").hidden = true;
      document.querySelectorAll(".edge-turn").forEach((b) => (b.hidden = true));
      return;
    }
    const v = await r.json();
    if (v.versionId !== data.versionId) {
      status.replaceChildren(
        document.createTextNode("An updated edition is available. "),
      );
      const b = document.createElement("button");
      b.textContent = "Open latest edition";
      b.onclick = () => location.reload();
      status.append(b);
    }
  } catch {}
}, 15000);

navigation = navigationTools(viewer, data, root);
navigation.update(viewer.state);
