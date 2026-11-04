import { vi } from "vitest";

export function browserMocks({ reducedMotion = false, width = 1200 } = {}) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return width;
    },
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reducedMotion })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height: 800,
    left: 0,
    top: 0,
    right: width,
    bottom: 800,
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.animate = vi.fn(function (frames, options) {
    let finish, reject;
    const finished = new Promise((yes, no) => {
      finish = yes;
      reject = no;
    });
    return {
      finished,
      finish,
      cancel: vi.fn(() => reject(new Error("cancelled"))),
      frames,
      options,
    };
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  localStorage.clear();
}
export async function finishTurn(viewer) {
  viewer.animation.finish();
  await Promise.resolve();
  await Promise.resolve();
}
