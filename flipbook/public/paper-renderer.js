import * as THREE from "three";
import { toCanvas, getFontEmbedCSS } from "html-to-image";
import {
  paperPoint,
  bookOffset,
  PAPER_WIDTH as W,
  PAPER_HEIGHT as H,
  clamp,
  turnDuration,
} from "./paper-geometry.js";

/** WebGL is an animation layer only; live, accessible page DOM remains canonical. */
export class PaperRenderer {
  constructor(root, pages, onLost = () => {}) {
    this.root = root;
    this.pages = pages;
    this.cache = new Map();
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.revision = 0;
    this.protected = new Set();
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "paper-canvas";
    this.canvas.hidden = true;
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.inert = true;
    root.append(this.canvas);
    this.canvas.addEventListener("webglcontextlost", (e) => {
      if (this.destroyed) return;
      e.preventDefault();
      this.lost = true;
      this.hide();
      onLost();
    });
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    // Mild perspective makes the lifted corner perceptible. Overscan prevents
    // its projected edge from clipping; the resting page still fits exactly.
    this.overscan = 1.22;
    const distance = 6000;
    this.camera = new THREE.PerspectiveCamera(
      THREE.MathUtils.radToDeg(
        2 * Math.atan((H * this.overscan) / (2 * distance)),
      ),
      (2 * W) / H,
      1,
      10000,
    );
    this.camera.position.set(0, 0, distance);
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.15));
    const light = new THREE.DirectionalLight(0xffffff, 1.35);
    light.position.set(-W * 0.7, H, 2200);
    light.castShadow = true;
    Object.assign(light.shadow.camera, {
      left: -W * 2,
      right: W * 2,
      top: H,
      bottom: -H,
      near: 1,
      far: 5000,
    });
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0002;
    this.scene.add(light);
  }
  async texture(index) {
    if (index == null || index < 0 || index >= this.pages.length) return null;
    if (this.cache.has(index)) {
      const value = this.cache.get(index);
      this.cache.delete(index);
      this.cache.set(index, value);
      return value;
    }
    if (this.pending.has(index)) return this.pending.get(index);
    const task = this.queue.then(async () => {
      if (this.destroyed) return null;
      await document.fonts.ready;
      const holder = document.createElement("div");
      holder.className = "magazine paper-snapshot";
      holder.setAttribute("aria-hidden", "true");
      holder.inert = true;
      const theme = getComputedStyle(this.pages[index]);
      for (const key of [
        "--ink",
        "--paper",
        "--accent",
        "--font",
        "--body-font",
      ])
        holder.style.setProperty(key, theme.getPropertyValue(key));
      const clone = this.pages[index].cloneNode(true);
      clone
        .querySelectorAll("video,audio")
        .forEach((player) => player.remove());
      clone
        .querySelectorAll(".media-print")
        .forEach((poster) => (poster.style.display = "flex"));
      clone.hidden = false;
      clone.inert = true;
      clone.removeAttribute("aria-label");
      clone.removeAttribute("data-page-id");
      clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      clone.className = "mag-page";
      clone.style.cssText = `position:relative;left:0;top:0;width:${W}px;height:${H}px;transform:none;margin:0`;
      clone.querySelectorAll("img").forEach((img) => (img.loading = "eager"));
      holder.append(clone);
      document.body.append(holder);
      try {
        await Promise.all(
          [...clone.querySelectorAll("img")].map((img) =>
            img.decode().catch(() => {}),
          ),
        );
        this.fontCSS ||= getFontEmbedCSS(clone);
        const bitmap = await toCanvas(clone, {
          width: W,
          height: H,
          pixelRatio: 1,
          fontEmbedCSS: await this.fontCSS,
          skipAutoScale: true,
        });
        if (this.destroyed) return null;
        const texture = new THREE.CanvasTexture(bitmap);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        this.cache.set(index, texture);
        this.trimCache();
        return texture;
      } finally {
        holder.remove();
      }
    });
    this.pending.set(index, task);
    this.queue = task.catch(() => {});
    task.finally(() => this.pending.delete(index)).catch(() => {});
    return task;
  }
  warm(indices) {
    for (const i of indices) this.texture(i).catch(() => {});
  }
  trimCache() {
    for (const [i, texture] of this.cache) {
      if (this.cache.size <= 8) break;
      if (!this.protected.has(i)) {
        texture.dispose();
        this.cache.delete(i);
      }
    }
  }
  disposeScene() {
    this.group.traverse((node) => {
      node.geometry?.dispose();
      if (node.material) {
        for (const m of Array.isArray(node.material)
          ? node.material
          : [node.material]) {
          if (m.userData.ownedMap) m.map?.dispose();
          m.dispose();
        }
      }
    });
    this.group.clear();
    this.geometry = null;
  }
  plane(texture, x, z = 0) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshLambertMaterial({
        map: texture,
        color: texture ? 0xffffff : 0xf5f1e8,
      }),
    );
    mesh.position.set(x, 0, z);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }
  async prepare({
    oldVisible,
    nextVisible,
    forward,
    rtl,
    single,
    binding,
    corner,
    scale,
  }) {
    if (this.lost || this.destroyed) throw Error("3D is unavailable");
    const revision = ++this.revision;
    const all = [...new Set([...oldVisible, ...nextVisible])];
    this.protected = new Set(all);
    await Promise.all(all.map((i) => this.texture(i)));
    if (this.lost || this.destroyed || revision !== this.revision)
      throw Error("3D turn cancelled");
    this.disposeScene();
    this.params = {
      direction: forward !== rtl ? 1 : -1,
      hard:
        binding === "hard" &&
        !single &&
        (oldVisible.length === 1 || nextVisible.length === 1),
      corner,
    };
    this.startOffset = bookOffset(oldVisible, this.pages.length, rtl, single);
    this.endOffset = bookOffset(nextVisible, this.pages.length, rtl, single);
    if (single)
      this.startOffset = this.endOffset = (-this.params.direction * W) / 2;
    const from = forward ? oldVisible.at(-1) : oldVisible[0],
      to = forward ? nextVisible[0] : nextVisible.at(-1);
    const order = (list) => (rtl ? [...list].reverse() : list);
    const old = order(oldVisible),
      next = order(nextVisible),
      direction = this.params.direction;
    if (single) {
      this.plane(this.cache.get(to), (direction * W) / 2);
    } else {
      const left =
        direction === 1
          ? old.length === 2
            ? old[0]
            : null
          : next.length === 2
            ? next[0]
            : null;
      const right =
        direction === 1
          ? next.length === 2
            ? next[1]
            : null
          : old.length === 2
            ? old[1]
            : null;
      if (left != null) this.plane(this.cache.get(left), -W / 2);
      if (right != null) this.plane(this.cache.get(right), W / 2);
    }
    // Thin paper stacks catch the moving shadow and expose physical edges.
    for (const side of [-1, 1]) {
      const stack = new THREE.Mesh(
        new THREE.BoxGeometry(W + 5, H + 5, 6),
        new THREE.MeshLambertMaterial({ color: 0xe1dccf }),
      );
      stack.position.set((side * W) / 2, 0, -5);
      stack.receiveShadow = true;
      if ((oldVisible.length === 2 || nextVisible.length === 2) && !single)
        this.group.add(stack);
      else {
        stack.geometry.dispose();
        stack.material.dispose();
      }
    }
    this.geometry = new THREE.PlaneGeometry(W, H, 48, 12);
    const uv = this.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++)
      if (direction < 0) uv.setX(i, 1 - uv.getX(i));
    const frontMaterial = new THREE.MeshLambertMaterial({
      map: this.cache.get(from),
      side: direction > 0 ? THREE.FrontSide : THREE.BackSide,
    });
    const backTexture = this.cache.get(to)?.clone();
    if (backTexture) {
      backTexture.repeat.x = -1;
      backTexture.offset.x = 1;
    }
    const backMaterial = new THREE.MeshLambertMaterial({
      map: backTexture,
      side: direction > 0 ? THREE.BackSide : THREE.FrontSide,
    });
    backMaterial.userData.ownedMap = true;
    for (const material of [frontMaterial, backMaterial]) {
      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.castShadow = true;
      // A sheet cannot shadow itself twice through its coincident back face.
      // Only the stationary paper receives the moving sheet's shadow.
      mesh.receiveShadow = false;
      this.group.add(mesh);
    }
    if (binding === "spiral" && !single)
      for (let y = -H / 2 + 40; y < H / 2; y += 65) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(15, 2.6, 6, 16),
          new THREE.MeshLambertMaterial({ color: 0x67675e }),
        );
        ring.rotation.y = 0.9;
        ring.position.set(0, y, 18);
        this.group.add(ring);
      }
    this.renderer.setSize(
      2 * W * scale * this.overscan,
      H * scale * this.overscan,
      false,
    );
    this.canvas.style.width = `${2 * W * scale * this.overscan}px`;
    this.canvas.style.height = `${H * scale * this.overscan}px`;
    this.canvas.style.top = `${(-H * scale * (this.overscan - 1)) / 2}px`;
    this.canvas.hidden = false;
    this.render(0);
    // Keep the live turn's textures; discard older pages beyond a bounded cache.
    this.trimCache();
  }
  render(progress) {
    if (!this.geometry || this.lost || this.destroyed) return;
    const p = clamp(progress),
      position = this.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const u = (i % 49) / 48,
        v = 1 - Math.floor(i / 49) / 12,
        point = paperPoint(u, v, p, this.params);
      position.setXYZ(i, point.x, point.y, point.z + 2);
    }
    position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.group.position.x =
      this.startOffset +
      (this.endOffset - this.startOffset) * (p * p * (3 - 2 * p));
    this.root.dataset.turnProgress = p.toFixed(3);
    this.renderer.render(this.scene, this.camera);
  }
  animate(from = 0, to = 1) {
    let resolve,
      raf,
      stopped = false;
    const finished = new Promise((r) => (resolve = r)),
      duration = turnDuration(from, to);
    let start;
    const frame = (time) => {
      if (stopped) return;
      start ??= time;
      const t = clamp((time - start) / duration),
        ease = t * t * (3 - 2 * t);
      this.render(from + (to - from) * ease);
      if (t < 1) raf = requestAnimationFrame(frame);
      else resolve();
    };
    raf = requestAnimationFrame(frame);
    return {
      finished,
      cancel: () => {
        stopped = true;
        cancelAnimationFrame(raf);
        resolve();
      },
      finish: () => {
        stopped = true;
        cancelAnimationFrame(raf);
        this.render(to);
        resolve();
      },
    };
  }
  hide() {
    this.revision++;
    this.canvas.hidden = true;
    this.root.dataset.turnProgress = "0";
  }
  destroy() {
    this.destroyed = true;
    this.hide();
    this.disposeScene();
    for (const texture of this.cache.values()) texture.dispose();
    this.cache.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
