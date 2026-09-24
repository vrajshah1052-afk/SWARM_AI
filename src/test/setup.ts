import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// Canvas 2D isn't implemented by jsdom. Provide a minimal stub so components
// that instantiate a canvas don't crash during smoke tests.
function stubCanvasCtx() {
  return {
    canvas: null,
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    imageSmoothingEnabled: true,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  };
}
HTMLCanvasElement.prototype.getContext = vi.fn(() => stubCanvasCtx()) as never;
HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,00");

// jsdom lacks requestAnimationFrame timing guarantees; the default polyfill is fine
// but we cap it at one call so tests don't loop forever.
let rafId = 0;
window.requestAnimationFrame = (cb: FrameRequestCallback) => {
  rafId++;
  const id = rafId;
  queueMicrotask(() => cb(performance.now()));
  return id;
};
window.cancelAnimationFrame = () => {
  /* no-op */
};

// jsdom does not implement IntersectionObserver. Docs.tsx uses it for
// scroll-spy — the fallback is fine, we just need the constructor to exist.
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
}
Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
Object.defineProperty(global, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

// URL.createObjectURL is used by the download helpers.
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => "blob:mock");
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = vi.fn();
}
