import { visiblePages, adjacentPage } from "./book-model.js";
import { releaseTarget, clamp } from "./paper-geometry.js";

/** Owns presentation only. Canonical page nodes and their interactive content stay intact. */
export class BookViewer {
  constructor(
    root,
    {
      initialIndex = 0,
      onChange = () => {},
      onTurn = () => {},
      single = false,
      settings = {},
      rendererFactory,
    } = {},
  ) {
    this.root = root;
    this.pages = [...root.querySelectorAll(".mag-page")];
    this.index = Math.max(0, Math.min(this.pages.length - 1, initialIndex));
    this.onChange = onChange;
    this.onTurn = onTurn;
    this.forceSingle = single;
    this.mode = settings.mode || "3d";
    this.layout = settings.layout || "auto";
    this.rtl = settings.direction === "rtl";
    this.binding = settings.binding || "hard";
    this.workToken = 0;
    this.flow = this.mode === "scroll";
    this.zoom = 1;
    this.busy = false;
    this.abort = new AbortController();
    this.stage = document.createElement("div");
    this.stage.className = "book-stage";
    this.stage.append(...this.pages);
    root.replaceChildren(this.stage);
    root.classList.add("book-viewer");
    root.tabIndex = 0;
    root.setAttribute(
      "aria-label",
      "Flipbook. Use left and right arrow keys to turn pages.",
    );
    this.resize = () => {
      this.index = this.requestedIndex;
      this.cancelTurn();
      this.draw();
    };
    let observedWidth = root.parentElement.clientWidth;
    this.observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (Math.abs(width - observedWidth) > 1) {
        observedWidth = width;
        this.resize();
      }
    });
    this.observer.observe(root.parentElement);
    window.addEventListener("resize", this.resize, {
      signal: this.abort.signal,
    });
    root.addEventListener(
      "keydown",
      (e) => {
        if (e.target.closest("input,textarea,select,button,a,[role=button]"))
          return;
        const action = {
          ArrowRight: () => (this.rtl ? this.previous() : this.next()),
          ArrowLeft: () => (this.rtl ? this.next() : this.previous()),
          Home: () => this.go(0),
          End: () => this.go(this.pages.length - 1),
        }[e.key];
        if (action) {
          e.preventDefault();
          action();
        }
      },
      { signal: this.abort.signal },
    );
    root.addEventListener("pointerdown", (e) => this.pointerDown(e), {
      signal: this.abort.signal,
    });
    root.addEventListener("pointermove", (e) => this.pointerMove(e), {
      signal: this.abort.signal,
    });
    root.addEventListener("pointerup", (e) => this.pointerUp(e), {
      signal: this.abort.signal,
    });
    root.addEventListener("pointercancel", (e) => this.pointerUp(e, true), {
      signal: this.abort.signal,
    });
    root.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey && !this.flow) {
          e.preventDefault();
          this.setZoom(this.zoom + (e.deltaY < 0 ? 0.25 : -0.25));
        }
      },
      { signal: this.abort.signal, passive: false },
    );
    if (rendererFactory) this.paper = rendererFactory(root, this.pages);
    else if (typeof WebGLRenderingContext !== "undefined") {
      // Keep the editor and basic reader usable while the optional GPU code loads.
      this.rendererReady = import("./paper-renderer.js")
        .then(({ PaperRenderer }) => {
          if (this.destroyed) return;
          this.paper = new PaperRenderer(root, this.pages, () => this.lose3D());
          if (!this.busy) this.draw();
        })
        .catch(() => {
          this.paper = null;
        });
    }
    this.draw();
  }
  get single() {
    return (
      this.mode === "slide" ||
      this.forceSingle ||
      this.layout === "single" ||
      (this.layout !== "spread" && this.root.parentElement.clientWidth < 760)
    );
  }
  get requestedIndex() {
    return this.pendingIndex ?? this.index;
  }
  get visible() {
    return visiblePages(this.index, this.pages.length, this.single);
  }
  get state() {
    const visible = this.visible;
    const requested = visiblePages(
      this.requestedIndex,
      this.pages.length,
      this.single,
    );
    return {
      index: this.index,
      visible,
      total: this.pages.length,
      flow: this.flow,
      mode: this.mode,
      zoom: this.zoom,
      renderer:
        this.paper && !this.paper.lost && this.mode === "3d" ? "webgl" : "css",
      busy: this.busy,
      canPrevious: this.flow ? this.requestedIndex > 0 : requested[0] > 0,
      canNext: this.flow
        ? this.requestedIndex < this.pages.length - 1
        : requested.at(-1) < this.pages.length - 1,
      label:
        visible.length === 2
          ? `Pages ${visible[0] + 1}–${visible[1] + 1} of ${this.pages.length}`
          : `Page ${this.index + 1} of ${this.pages.length}`,
    };
  }
  draw(display = this.visible) {
    const visible = this.visible,
      ordered = this.rtl ? [...display].reverse() : display;
    this.root.dataset.zoomed = String(this.zoom > 1);
    this.root.dataset.renderer = this.state.renderer;
    this.root.dataset.binding = this.binding;
    this.root.dataset.direction = this.rtl ? "rtl" : "ltr";
    this.root.classList.toggle("flow", this.flow);
    this.root.classList.toggle(
      "book-spread",
      !this.flow && visible.length === 2,
    );
    this.root.dataset.visiblePages = visible.map((i) => i + 1).join(",");
    this.root.dataset.turning = String(this.busy);
    this.pages.forEach((page, i) => {
      page.hidden = !this.flow && !display.includes(i);
      page.inert = page.hidden || this.busy;
      page.classList.toggle(
        "book-left",
        ordered.length === 2 && i === ordered[0],
      );
      page.classList.toggle(
        "book-right",
        ordered.length === 2 && i === ordered[1],
      );
      page.style.left = this.flow ? "" : `${ordered.indexOf(i) * 794}px`;
    });
    if (this.flow) {
      this.root.style.height = "";
      this.root.style.width = "";
      this.stage.style.cssText = "";
    } else {
      const width = visible.length * 794;
      const parent = this.root.parentElement,
        padding = getComputedStyle(parent);
      const available = Math.max(
        200,
        parent.clientWidth -
          (parseFloat(padding.paddingLeft) || 0) -
          (parseFloat(padding.paddingRight) || 0) -
          24,
      );
      const height = Math.max(
        280,
        window.innerHeight - (this.root.closest("dialog") ? 250 : 260),
      );
      // Desktop covers use the same page size as the interior spread.
      // Opening the book should not suddenly resize the paper.
      const fitWidth = !this.single && this.pages.length > 1 ? 1588 : width;
      const scale =
        Math.min(1, available / fitWidth, height / 1123) * this.zoom;
      this.scale = scale;
      this.root.style.height = `${1123 * scale}px`;
      this.root.style.width = this.zoom > 1 ? `${width * scale}px` : "";
      this.stage.style.cssText = `width:${width}px;height:1123px;transform:translateX(-50%) scale(${scale});`;
    }
    this.onChange(this.state);
    this.preloadAdjacent();
  }
  preloadAdjacent() {
    const indexes = new Set([
      ...this.visible,
      ...visiblePages(
        adjacentPage(this.index, this.pages.length, 1, this.single),
        this.pages.length,
        this.single,
      ),
      ...visiblePages(
        adjacentPage(this.index, this.pages.length, -1, this.single),
        this.pages.length,
        this.single,
      ),
    ]);
    if (this.mode === "3d" && !this.flow) this.paper?.warm([...indexes]);
    for (const i of indexes)
      this.pages[i]?.querySelectorAll("img").forEach((img) => {
        img.loading = "eager";
        img.decoding = "async";
        if (img.dataset.bookDecoded !== "true") {
          img.dataset.bookDecoded = "true";
          img.decode?.().catch(() => {});
        }
      });
  }
  lose3D() {
    if (this.drag) this.index = this.drag.from;
    this.cancelTurn();
    this.paper?.hide();
    this.draw();
  }
  configure(settings) {
    this.index = this.requestedIndex;
    this.cancelTurn();
    this.mode = settings.mode || this.mode;
    this.layout = settings.layout || this.layout;
    this.rtl = settings.direction ? settings.direction === "rtl" : this.rtl;
    this.binding = settings.binding || this.binding;
    this.flow = this.mode === "scroll";
    this.draw();
  }
  cancelTurn() {
    this.workToken++;
    this.root.removeAttribute("aria-busy");
    this.drag = null;
    this.paper?.hide();
    this.stage.style.visibility = "";
    this.animation?.cancel();
    this.animation = null;
    this.sheet?.remove();
    this.sheet = null;
    this.pendingIndex = null;
    this.busy = false;
  }
  setFlow(flow) {
    this.index = this.requestedIndex;
    this.cancelTurn();
    if (flow && !this.flow) this.lastBookMode = this.mode;
    this.mode = flow ? "scroll" : this.lastBookMode || "3d";
    this.flow = flow;
    this.draw();
  }
  setZoom(zoom) {
    this.index = this.requestedIndex;
    this.cancelTurn();
    this.zoom = clamp(zoom, 1, 3);
    this.draw();
  }
  next() {
    return this.go(
      adjacentPage(
        this.requestedIndex,
        this.pages.length,
        1,
        this.single || this.flow,
      ),
    );
  }
  previous() {
    return this.go(
      adjacentPage(
        this.requestedIndex,
        this.pages.length,
        -1,
        this.single || this.flow,
      ),
    );
  }
  pointerDown(e) {
    if (
      this.flow ||
      e.target.closest(
        "button,a,[role=button],input,select,textarea,video,audio,[contenteditable]",
      )
    )
      return;
    this.touches ||= new Map();
    this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.touches.size === 2) {
      this.cancelTurn();
      this.draw();
      const [a, b] = [...this.touches.values()];
      this.pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: this.zoom,
      };
      return;
    }
    this.pointer = {
      x: e.clientX,
      y: e.clientY,
      id: e.pointerId,
      lastX: e.clientX,
      time: e.timeStamp,
      velocity: 0,
    };
    this.root.setPointerCapture?.(e.pointerId);
  }
  pointerMove(e) {
    if (this.touches?.has(e.pointerId))
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.touches.size === 2) {
      const [a, b] = [...this.touches.values()];
      this.setZoom(
        (this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
          this.pinch.distance,
      );
      return;
    }
    const start = this.pointer;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    if (this.zoom > 1 && !this.drag) {
      this.root.parentElement.scrollLeft -= e.clientX - start.lastX;
      this.root.parentElement.scrollTop -= e.clientY - (start.lastY ?? start.y);
      start.lastX = e.clientX;
      start.lastY = e.clientY;
      return;
    }
    if (
      !this.drag &&
      !this.busy &&
      Math.abs(dx) > 8 &&
      Math.abs(dx) > Math.abs(dy) * 1.5 &&
      this.paper &&
      !this.paper.lost &&
      this.mode === "3d" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const direction = (dx < 0 ? 1 : -1) * (this.rtl ? -1 : 1),
        next = adjacentPage(
          this.index,
          this.pages.length,
          direction,
          this.single,
        );
      if (next !== this.index) {
        const box = this.root.getBoundingClientRect();
        this.go(next, true, {
          corner: clamp((start.y - box.top) / box.height),
          physical: dx < 0 ? -1 : 1,
          progress: 0,
        });
      }
    }
    if (this.drag) {
      e.preventDefault();
      // A page-turn drag must not leave the page text selected.
      document.getSelection()?.removeAllRanges();
      this.drag.progress = clamp(
        (dx * this.drag.physical) / (794 * this.scale),
      );
      this.drag.velocity =
        ((e.clientX - start.lastX) * this.drag.physical) /
        Math.max(1, e.timeStamp - start.time);
      if (this.drag.ready) this.paper.render(this.drag.progress);
    }
    start.lastX = e.clientX;
    start.time = e.timeStamp;
  }
  pointerUp(e, cancelled = false) {
    this.touches?.delete(e.pointerId);
    if (this.pinch) {
      if (this.touches.size < 2) this.pinch = null;
      this.pointer = null;
      return;
    }
    const start = this.pointer;
    this.pointer = null;
    if (this.root.hasPointerCapture?.(e.pointerId))
      this.root.releasePointerCapture(e.pointerId);
    if (!start || start.id !== e.pointerId) return;
    if (this.drag) {
      this.drag.target = releaseTarget(
        this.drag.progress,
        e.timeStamp - start.time > 80 ? 0 : this.drag.velocity,
        cancelled,
      );
      if (this.drag.target)
        this.onTurn({ from: this.drag.from, to: this.index });
      if (this.drag.ready) this.finishPaperDrag();
      return;
    }
    if (cancelled || this.zoom > 1) return;
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const forward = dx < 0 !== this.rtl;
      forward ? this.next() : this.previous();
    }
  }
  startPaperTurn({ oldIndex, oldVisible, nextVisible, next, gesture }) {
    const token = ++this.workToken;
    if (gesture)
      this.drag = { ...gesture, from: oldIndex, ready: false, target: null };
    else this.onTurn({ from: oldIndex, to: next });
    this.root.dataset.turning = "true";
    this.root.setAttribute("aria-busy", "true");
    this.paper
      .prepare({
        oldVisible,
        nextVisible,
        forward: next > oldIndex,
        rtl: this.rtl,
        single: this.single,
        binding: this.binding,
        corner: gesture?.corner ?? 0.85,
        scale: this.scale,
      })
      .then(() => {
        if (token !== this.workToken || this.destroyed) {
          return;
        }
        this.stage.style.visibility = "hidden";
        if (this.drag) {
          this.drag.ready = true;
          this.paper.render(this.drag.progress);
          if (this.drag.target !== null) this.finishPaperDrag();
        } else this.completePaperAnimation(this.paper.animate(), token);
      })
      .catch(() => {
        if (token !== this.workToken || this.destroyed) return;
        this.paper.lost = true;
        const rollback = gesture && this.drag?.target !== 1;
        this.index = oldIndex;
        this.cancelTurn();
        if (rollback) this.draw();
        else this.go(next, true, null, false);
      });
  }
  finishPaperDrag() {
    const drag = this.drag,
      token = this.workToken;
    this.completePaperAnimation(
      this.paper.animate(drag.progress, drag.target),
      token,
      drag.target === 0 ? drag.from : null,
    );
  }
  completePaperAnimation(animation, token, restore = null) {
    this.animation = animation;
    animation.finished.then(() => {
      if (token !== this.workToken) return;
      const pending = this.pendingIndex;
      if (restore !== null) this.index = restore;
      this.cancelTurn();
      this.draw();
      if (pending != null && pending !== this.index) this.go(pending);
    });
  }
  go(value, animate = true, gesture = null, playSound = true) {
    const next = Math.max(
      0,
      Math.min(this.pages.length - 1, Number(value) || 0),
    );
    if (!this.pages.length) return;
    if (this.busy) {
      this.pendingIndex = next;
      this.onChange(this.state);
      return;
    }
    const oldIndex = this.index,
      oldVisible = this.visible;
    if (next === oldIndex) return;
    this.index = next;
    const nextVisible = this.visible;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const changesPage = !nextVisible.includes(oldIndex);
    const turn = animate && !this.flow && !reduced && changesPage;
    this.busy = turn;
    if (turn && this.paper && !this.paper.lost && this.mode === "3d") {
      this.draw(oldVisible);
      this.startPaperTurn({ oldIndex, oldVisible, nextVisible, next, gesture });
      return;
    }
    this.draw();
    if (this.flow) {
      this.pages[next].scrollIntoView({
        behavior: reduced ? "instant" : "smooth",
        block: "start",
      });
      return;
    }
    if (changesPage && playSound) this.onTurn({ from: oldIndex, to: next });
    if (!turn) return;
    const forward = next > oldIndex,
      physicalForward = forward !== this.rtl;
    // Interior turns use a two-sided leaf rotating around the spine.
    // Covers use a shorter opening/closing transition in their centered position.
    if (oldVisible.length === 2 && nextVisible.length === 2) {
      const leaf = document.createElement("div");
      leaf.className = "book-leaf";
      leaf.setAttribute("aria-hidden", "true");
      leaf.inert = true;
      const front =
        this.pages[forward ? oldVisible[1] : oldVisible[0]].cloneNode(true);
      const back =
        this.pages[forward ? nextVisible[0] : nextVisible[1]].cloneNode(true);
      for (const node of [front, back]) {
        node.hidden = false;
        node.removeAttribute("data-page-id");
        node.removeAttribute("aria-label");
        node.className = "mag-page book-leaf-face";
        node.style.left = "0";
        node.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      }
      back.classList.add("book-leaf-back");
      leaf.append(front, back);
      // Keep the stationary old page visible below the turning leaf. Commit
      // its replacement only after the leaf lands, avoiding the old flash/jump.
      const stationary = this.pages[forward ? oldVisible[0] : oldVisible[1]];
      this.pages[forward ? nextVisible[0] : nextVisible[1]].hidden = true;
      stationary.hidden = false;
      stationary.inert = true;
      stationary.style.left = physicalForward ? "0" : "794px";
      stationary.classList.toggle("book-left", physicalForward);
      stationary.classList.toggle("book-right", !physicalForward);
      leaf.style.left = physicalForward ? "794px" : "0";
      leaf.style.transformOrigin = physicalForward
        ? "left center"
        : "right center";
      this.stage.append(leaf);
      this.sheet = leaf;
      this.animation = leaf.animate(
        [
          { transform: "rotateY(0deg)" },
          { transform: `rotateY(${physicalForward ? -180 : 180}deg)` },
        ],
        {
          duration: 420,
          easing: "cubic-bezier(.22,.61,.36,1)",
          fill: "forwards",
        },
      );
    } else {
      // A compositor-only transition for covers and narrow screens; keep the
      // incoming page fully visible while the old paper slides out above it.
      const sourcePosition = forward ? oldVisible.length - 1 : 0;
      const sheet = this.pages[oldVisible[sourcePosition]].cloneNode(true);
      sheet.hidden = false;
      sheet.inert = true;
      sheet.setAttribute("aria-hidden", "true");
      sheet.removeAttribute("data-page-id");
      sheet.removeAttribute("aria-label");
      sheet.className = "mag-page book-cover-turn";
      sheet.style.left = `${(nextVisible.length - oldVisible.length) * 397 + sourcePosition * 794}px`;
      sheet.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      this.stage.append(sheet);
      this.sheet = sheet;
      this.animation = sheet.animate(
        [
          { opacity: 1, transform: "translateX(0) rotateY(0deg)" },
          {
            opacity: 0,
            transform: `translateX(${forward ? -12 : 12}%) rotateY(${forward ? -18 : 18}deg)`,
          },
        ],
        { duration: 280, easing: "ease-out", fill: "forwards" },
      );
    }
    this.root.dataset.turning = "true";
    this.onChange(this.state);
    const animation = this.animation;
    animation.finished
      .then(() => {
        if (this.animation !== animation) return;
        const pending = this.pendingIndex;
        this.cancelTurn();
        this.draw();
        if (pending !== null && pending !== undefined && pending !== this.index)
          this.go(pending);
      })
      .catch(() => {});
  }
  destroy() {
    this.destroyed = true;
    this.cancelTurn();
    this.paper?.destroy();
    this.observer.disconnect();
    this.abort.abort();
    this.pages.forEach((p) => {
      p.hidden = false;
      p.inert = false;
      p.style.left = "";
      p.classList.remove("book-left", "book-right");
    });
    this.root.replaceChildren(...this.pages);
    this.root.style.height = "";
    this.root.style.width = "";
    this.root.classList.remove("book-viewer", "book-spread", "flow");
  }
}
