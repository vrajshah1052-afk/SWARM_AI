import { GW, GH, RW, RH, type Frame, type SwarmEngine } from "./engine";
import type { BaselineEngine } from "./baseline";

export interface ViewOpts {
  showFood: boolean;
  showHome: boolean;
  showRobots: boolean;
  showResource: boolean;
  gain: number;
}

export const DEFAULT_VIEW: ViewOpts = {
  showFood: true,
  showHome: true,
  showRobots: true,
  showResource: true,
  gain: 1,
};

let buf: HTMLCanvasElement | null = null;
function getBuffer(w: number, h: number) {
  if (!buf) buf = document.createElement("canvas");
  if (buf.width !== w || buf.height !== h) {
    buf.width = w;
    buf.height = h;
  }
  return buf;
}

function paintFields(
  w: number,
  h: number,
  foodAt: (i: number) => number,
  homeAt: (i: number) => number,
  wallAt: ((i: number) => number) | null,
  resAt: ((i: number) => number) | null,
  o: ViewOpts,
): HTMLCanvasElement | null {
  const c = getBuffer(w, h);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    let r = 8;
    let g = 10;
    let b = 18;
    if (wallAt && wallAt(i)) {
      r = 26;
      g = 31;
      b = 45;
    }
    if (o.showHome) {
      const v = Math.min(1, homeAt(i) * o.gain);
      if (v > 0.002) {
        const t = Math.pow(v, 0.62);
        r += t * 220;
        g += t * 128;
        b += t * 22;
      }
    }
    if (o.showFood) {
      const v = Math.min(1, foodAt(i) * o.gain);
      if (v > 0.002) {
        const t = Math.pow(v, 0.55);
        r += t * 30;
        g += t * 215;
        b += t * 240;
      }
    }
    if (o.showResource && resAt) {
      const v = resAt(i);
      if (v > 0.05) {
        const t = Math.min(1, v / 10);
        r = r * (1 - t) + 120 * t;
        g = g * (1 - t) + 255 * t;
        b = b * (1 - t) + 150 * t;
      }
    }
    d[p] = r > 255 ? 255 : r;
    d[p + 1] = g > 255 ? 255 : g;
    d[p + 2] = b > 255 ? 255 : b;
    d[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function renderEngine(canvas: HTMLCanvasElement, engine: SwarmEngine, o: ViewOpts) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  const src = paintFields(
    GW,
    GH,
    (i) => engine.food[i] / 240,
    (i) => engine.home[i] / 240,
    (i) => engine.wall[i],
    (i) => engine.resource[i],
    o,
  );
  if (!src) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, cw, ch);

  const sx = cw / GW;
  const sy = ch / GH;

  // nest
  const nx = engine.nest.x * sx;
  const ny = engine.nest.y * sy;
  const grad = ctx.createRadialGradient(nx, ny, 1, nx, ny, 26);
  grad.addColorStop(0, "rgba(167,139,250,0.85)");
  grad.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(nx, ny, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(196,181,253,0.9)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(nx, ny, 6.5, 0, Math.PI * 2);
  ctx.stroke();

  if (o.showRobots) {
    const size = Math.max(1.3, sx * 0.85);
    ctx.fillStyle = "rgba(236,242,255,0.92)";
    ctx.beginPath();
    for (const r of engine.robots) {
      if (r.carrying) continue;
      ctx.rect(r.x * sx - size / 2, r.y * sy - size / 2, size, size);
    }
    ctx.fill();
    ctx.fillStyle = "rgba(134,255,190,0.98)";
    ctx.beginPath();
    for (const r of engine.robots) {
      if (!r.carrying) continue;
      ctx.rect(r.x * sx - size * 0.7, r.y * sy - size * 0.7, size * 1.4, size * 1.4);
    }
    ctx.fill();
  }
}

/**
 * Minimal renderer for the centralized/greedy BaselineEngine.
 * Draws walls, food sites, nest, agent dots, and a subtle target line for
 * carrying agents so the "planned path" nature of the algorithm is visible.
 */
export function renderBaseline(canvas: HTMLCanvasElement, engine: BaselineEngine): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const sx = cw / GW;
  const sy = ch / GH;

  // wall tint
  ctx.fillStyle = "rgba(26,31,45,0.85)";
  for (let y = 1; y < GH - 1; y++) {
    for (let x = 1; x < GW - 1; x++) {
      if (engine.wall[y * GW + x] === 1) ctx.fillRect(x * sx, y * sy, sx + 0.5, sy + 0.5);
    }
  }

  // food sites
  for (const f of engine.foodSites) {
    if (f.remaining <= 0) continue;
    const alpha = Math.min(0.7, 0.15 + (f.remaining / (Math.PI * f.r * f.r * 6)) * 0.6);
    ctx.fillStyle = `rgba(52,211,153,${alpha})`;
    ctx.beginPath();
    ctx.arc(f.x * sx, f.y * sy, f.r * sx, 0, Math.PI * 2);
    ctx.fill();
  }

  // nest
  const nx = engine.nest.x * sx;
  const ny = engine.nest.y * sy;
  const grad = ctx.createRadialGradient(nx, ny, 1, nx, ny, 26);
  grad.addColorStop(0, "rgba(244,114,182,0.85)");
  grad.addColorStop(1, "rgba(244,114,182,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(nx, ny, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(251,207,232,0.9)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(nx, ny, 6.5, 0, Math.PI * 2);
  ctx.stroke();

  // planned path lines (very thin, low alpha)
  ctx.strokeStyle = "rgba(244,114,182,0.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const a of engine.agents) {
    if (a.carrying) {
      ctx.moveTo(a.x * sx, a.y * sy);
      ctx.lineTo(nx, ny);
    } else if (a.targetIdx >= 0) {
      const f = engine.foodSites[a.targetIdx];
      ctx.moveTo(a.x * sx, a.y * sy);
      ctx.lineTo(f.x * sx, f.y * sy);
    }
  }
  ctx.stroke();

  // agents
  const size = Math.max(1.3, sx * 0.85);
  ctx.fillStyle = "rgba(236,242,255,0.92)";
  for (const a of engine.agents) {
    if (a.carrying) continue;
    ctx.fillRect(a.x * sx - size / 2, a.y * sy - size / 2, size, size);
  }
  ctx.fillStyle = "rgba(134,255,190,0.98)";
  for (const a of engine.agents) {
    if (!a.carrying) continue;
    ctx.fillRect(a.x * sx - size * 0.7, a.y * sy - size * 0.7, size * 1.4, size * 1.4);
  }
}

export function renderFrame(
  canvas: HTMLCanvasElement,
  frame: Frame,
  nest: { x: number; y: number },
  o: ViewOpts,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const src = paintFields(
    RW,
    RH,
    (i) => frame.food[i] / 255,
    (i) => frame.home[i] / 255,
    null,
    null,
    o,
  );
  if (!src) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, cw, ch);

  const nx = (nest.x / GW) * cw;
  const ny = (nest.y / GH) * ch;
  const grad = ctx.createRadialGradient(nx, ny, 1, nx, ny, 24);
  grad.addColorStop(0, "rgba(167,139,250,0.8)");
  grad.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(nx, ny, 24, 0, Math.PI * 2);
  ctx.fill();

  if (o.showRobots) {
    for (let i = 0; i < frame.rx.length; i++) {
      const x = (frame.rx[i] / 255) * cw;
      const y = (frame.ry[i] / 255) * ch;
      ctx.fillStyle = frame.rc[i] ? "rgba(134,255,190,0.95)" : "rgba(236,242,255,0.85)";
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  }
}

/** Isometric bar-field ("pseudo-3D") view of a pheromone lattice. */
export function renderIso(canvas: HTMLCanvasElement, frame: Frame, rotate: number, height: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);

  const step = 2; // sample every other cell
  const cols = Math.floor(RW / step);
  const rows = Math.floor(RH / step);
  const cs = Math.min(cw / (cols + rows) / 0.62, 11);
  const ox = cw / 2;
  const oy = ch * 0.2;
  const cosR = Math.cos(rotate);
  const sinR = Math.sin(rotate);

  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const gx = rx * step;
      const gy = ry * step;
      const i = gy * RW + gx;
      const vf = frame.food[i] / 255;
      const vh = frame.home[i] / 255;
      const v = Math.max(vf, vh);
      if (v < 0.02) continue;
      // rotate in grid space
      const px = rx - cols / 2;
      const py = ry - rows / 2;
      const rxr = px * cosR - py * sinR;
      const ryr = px * sinR + py * cosR;
      const sx = ox + (rxr - ryr) * cs * 0.86;
      const sy = oy + (rxr + ryr) * cs * 0.45;
      const h = Math.pow(v, 0.7) * height;
      const top = sy - h;
      const w = cs * 0.9;
      const col =
        vf >= vh ? `rgba(34,211,238,${0.25 + v * 0.7})` : `rgba(245,158,11,${0.22 + v * 0.7})`;
      ctx.fillStyle = col;
      ctx.fillRect(sx - w / 2, top, w, h + 1.5);
      ctx.fillStyle = vf >= vh ? "rgba(190,250,255,0.9)" : "rgba(255,224,160,0.9)";
      ctx.fillRect(sx - w / 2, top - 1.5, w, 2);
    }
  }
}
