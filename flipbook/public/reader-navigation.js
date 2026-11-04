import { searchPages, loadSettings, saveSettings } from "./reader-model.js";
export class AutoPlay {
  constructor(viewer, onChange = () => {}, delay = 4000) {
    this.viewer = viewer;
    this.onChange = onChange;
    this.delay = delay;
  }
  start() {
    if (this.running) return;
    if (!this.viewer.state.canNext) return;
    this.running = true;
    this.onChange(true);
    this.schedule();
  }
  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.running) return;
      if (document.hidden) {
        this.stop();
        return;
      }
      if (!this.viewer.busy) {
        if (!this.viewer.state.canNext) {
          this.stop();
          return;
        }
        this.viewer.next();
      }
      this.schedule();
    }, this.delay);
  }
  stop() {
    clearTimeout(this.timer);
    this.running = false;
    this.onChange(false);
  }
}
export function navigationTools(viewer, data, root) {
  const $ = (id) => document.getElementById(id),
    sidebar = $("reader-sidebar"),
    list = $("page-list"),
    results = $("search-results"),
    search = $("search-query");
  let settings = loadSettings(),
    panel = "thumbnails",
    lastFocus,
    searchTimer;
  const play = new AutoPlay(viewer, (on) => {
    $("autoplay").setAttribute("aria-pressed", String(on));
    $("autoplay").setAttribute(
      "aria-label",
      on ? "Pause autoplay" : "Start autoplay",
    );
    $("autoplay").textContent = on ? "Ⅱ" : "▷";
  });
  const stop = () => play.stop();
  $("autoplay").onclick = () => (play.running ? play.stop() : play.start());
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  root.addEventListener("pointerdown", stop);
  root.addEventListener("keydown", stop);
  document
    .querySelectorAll(".edge-turn")
    .forEach((button) => button.addEventListener("click", stop));
  for (const id of [
    "first",
    "previous",
    "next",
    "last",
    "pages",
    "thumbnails",
    "search",
    "options",
    "zoom",
    "zoom-out",
    "fit",
    "view",
    "print",
    "edge-next",
    "edge-previous",
  ])
    $(id)?.addEventListener("click", stop);
  function choose(index) {
    viewer.go(index);
    if (innerWidth < 760) closePanel();
  }
  function closePanel() {
    sidebar.hidden = true;
    document.body.classList.remove("navigation-open");
    $("thumbnails").setAttribute("aria-expanded", "false");
    $("search").setAttribute("aria-expanded", "false");
    lastFocus?.focus();
    viewer.resize();
  }
  function renderList() {
    list.replaceChildren();
    list.className = panel === "contents" ? "contents-list" : "thumbnail-list";
    data.document.pages.forEach((page, index) => {
      const item = document.createElement("button");
      item.className = "page-choice";
      item.dataset.pageIndex = index;
      item.setAttribute("aria-label", `Go to page ${index + 1}: ${page.title}`);
      if (panel !== "contents") {
        const tile = document.createElement("span");
        tile.className = "page-thumbnail magazine";
        for (const key of [
          "--ink",
          "--paper",
          "--accent",
          "--font",
          "--body-font",
        ])
          tile.style.setProperty(
            key,
            getComputedStyle(viewer.pages[index]).getPropertyValue(key),
          );
        const clone = viewer.pages[index].cloneNode(true);
        clone.hidden = false;
        clone.inert = true;
        clone.className = "mag-page";
        clone.removeAttribute("aria-label");
        clone.removeAttribute("data-page-id");
        clone.style.cssText = "";
        clone.setAttribute("aria-hidden", "true");
        clone
          .querySelectorAll("[id]")
          .forEach((el) => el.removeAttribute("id"));
        tile.append(clone);
        item.append(tile);
      }
      const label = document.createElement("span");
      label.textContent = `${index + 1}. ${page.title}`;
      item.append(label);
      item.onclick = () => choose(index);
      list.append(item);
    });
    update(viewer.state);
  }
  function renderSearch() {
    clearTimeout(searchTimer);
    const matches = searchPages(data.document, search.value);
    results.replaceChildren();
    $("search-count").textContent = search.value.trim()
      ? `${matches.length} matching ${matches.length === 1 ? "page" : "pages"}`
      : "Search the words and products in this publication.";
    for (const result of matches) {
      const button = document.createElement("button");
      button.className = "search-result";
      const title = document.createElement("strong"),
        snippet = document.createElement("span");
      title.textContent = `Page ${result.index + 1} · ${result.title}`;
      snippet.textContent = result.snippet;
      button.append(title, snippet);
      button.onclick = () => choose(result.index);
      results.append(button);
    }
  }
  function openPanel(kind) {
    if (!sidebar.hidden && panel === kind) {
      closePanel();
      return;
    }
    lastFocus = document.activeElement;
    panel = kind;
    $("thumbnails-tab").setAttribute(
      "aria-pressed",
      String(kind === "thumbnails"),
    );
    $("contents-tab").setAttribute("aria-pressed", "false");
    sidebar.hidden = false;
    document.body.classList.add("navigation-open");
    $("sidebar-title").textContent = kind === "search" ? "Search" : "Pages";
    $("thumbnails").setAttribute("aria-expanded", String(kind !== "search"));
    $("search").setAttribute("aria-expanded", String(kind === "search"));
    document.querySelector(".sidebar-tabs").hidden = kind === "search";
    document.querySelector(".reader-search").hidden = kind !== "search";
    list.hidden = kind === "search";
    results.hidden = kind !== "search";
    $("search-count").textContent = "";
    if (kind === "search") {
      renderSearch();
      search.focus();
    } else renderList();
    viewer.resize();
  }
  $("thumbnails").onclick = () => openPanel("thumbnails");
  $("search").onclick = () => openPanel("search");
  $("close-sidebar").onclick = closePanel;
  $("thumbnails-tab").onclick = () => {
    panel = "thumbnails";
    renderList();
    $("thumbnails-tab").setAttribute("aria-pressed", "true");
    $("contents-tab").setAttribute("aria-pressed", "false");
  };
  $("contents-tab").onclick = () => {
    panel = "contents";
    renderList();
    $("thumbnails-tab").setAttribute("aria-pressed", "false");
    $("contents-tab").setAttribute("aria-pressed", "true");
  };
  search.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderSearch, 120);
  };
  sidebar.onkeydown = (e) => {
    if (e.key === "Escape") closePanel();
  };
  $("first").onclick = () => viewer.go(0);
  $("last").onclick = () => viewer.go(viewer.pages.length - 1);
  $("zoom-out").onclick = () => viewer.setZoom(viewer.zoom - 0.25);
  $("fit").onclick = () => viewer.setZoom(1);
  const dialog = $("options-dialog");
  let focus;
  $("options").onclick = () => {
    focus = document.activeElement;
    dialog.showModal();
  };
  $("close-options").onclick = () => dialog.close();
  dialog.addEventListener("close", () => focus?.focus());
  const controls = {
    "view-mode": "mode",
    "page-layout": "layout",
    "reading-direction": "direction",
    binding: "binding",
    "reader-background": "background",
  };
  function apply() {
    settings = saveSettings(settings);
    document.body.dataset.background = settings.background;
    viewer.configure(settings);
  }
  for (const [id, key] of Object.entries(controls)) {
    $(id).value = settings[key];
    $(id).onchange = () => {
      settings[key] = $(id).value;
      apply();
    };
  }
  let printFlow = null;
  function preparePrint() {
    stop();
    viewer.cancelTurn();
    viewer.draw();
    if (printFlow === null) printFlow = root.classList.contains("flow");
    root.classList.remove("flow");
  }
  function restorePrint() {
    if (printFlow === null) return;
    root.classList.toggle("flow", printFlow);
    printFlow = null;
  }
  $("print").onclick = () => {
    preparePrint();
    try {
      window.print();
    } finally {
      restorePrint();
    }
  };
  window.addEventListener("beforeprint", preparePrint);
  window.addEventListener("afterprint", restorePrint);
  function update(state) {
    settings.mode = state.mode;
    saveSettings(settings);
    $("first").disabled = !state.canPrevious;
    $("last").disabled = !state.canNext;
    $("zoom-out").disabled = state.zoom <= 1;
    $("fit").hidden = state.zoom <= 1;
    $("zoom").disabled = state.zoom >= 3;
    for (const id of ["zoom", "zoom-out", "fit"])
      if (state.flow) $(id).hidden = true;
      else if (id !== "fit") $(id).hidden = false;
    $("view-mode").value = state.flow ? "scroll" : state.mode;
    $("rendering-note").textContent =
      state.mode === "3d" && state.renderer !== "webgl"
        ? "3D is unavailable here. The 2D reader stays fully usable."
        : "";
    list
      .querySelectorAll("[data-page-index]")
      .forEach((button) =>
        button.setAttribute(
          "aria-current",
          state.visible.includes(Number(button.dataset.pageIndex))
            ? "page"
            : "false",
        ),
      );
    if (play.running && !state.canNext && !state.busy) play.stop();
  }
  apply();
  return {
    update,
    stop,
    dispose() {
      stop();
      clearTimeout(searchTimer);
    },
  };
}
