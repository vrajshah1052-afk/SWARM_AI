import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, GH, GW, SwarmEngine, runHeadless } from "../engine";

function fingerprint(engine: SwarmEngine): string {
  // Small, cheap digest of engine state that is sensitive to any drift.
  let s = 0;
  for (let i = 0; i < engine.food.length; i += 97) s = (s + engine.food[i] * 1000) | 0;
  for (let i = 0; i < engine.home.length; i += 97) s = (s + engine.home[i] * 1000) | 0;
  const bots = engine.robots
    .slice(0, 10)
    .map((r) => `${r.x.toFixed(3)},${r.y.toFixed(3)},${r.a.toFixed(3)},${r.carrying ? 1 : 0}`)
    .join("|");
  return `${s}#${bots}#tick=${engine.stats.tick}`;
}

describe("SwarmEngine determinism", () => {
  it("produces identical output for the same seed", () => {
    const a = new SwarmEngine({ robots: 60 }, 42);
    const b = new SwarmEngine({ robots: 60 }, 42);
    for (let i = 0; i < 120; i++) {
      a.step();
      b.step();
    }
    expect(fingerprint(a)).toEqual(fingerprint(b));
    expect(a.stats.collected).toEqual(b.stats.collected);
  });

  it("diverges for different seeds", () => {
    const a = new SwarmEngine({ robots: 60 }, 42);
    const b = new SwarmEngine({ robots: 60 }, 99);
    for (let i = 0; i < 200; i++) {
      a.step();
      b.step();
    }
    expect(fingerprint(a)).not.toEqual(fingerprint(b));
  });

  it("resetting with a seed restores reproducibility", () => {
    const e = new SwarmEngine({ robots: 40 }, 7);
    for (let i = 0; i < 50; i++) e.step();
    const first = fingerprint(e);
    e.reset(7);
    for (let i = 0; i < 50; i++) e.step();
    expect(fingerprint(e)).toEqual(first);
  });
});

describe("SwarmEngine field dynamics", () => {
  it("evaporation decays field values over time", () => {
    const e = new SwarmEngine({ robots: 0, evaporation: 0.1, diffusion: 0 }, 1);
    // seed a single cell
    const idx = 40 * GW + 40;
    e.food[idx] = 100;
    e.step();
    // After 1 tick with λ = 0.1 the value should be ≈ 90 (before any diffusion contribution).
    expect(e.food[idx]).toBeGreaterThan(85);
    expect(e.food[idx]).toBeLessThanOrEqual(90.001);
    for (let i = 0; i < 20; i++) e.step();
    expect(e.food[idx]).toBeLessThan(100);
  });

  it("diffusion spreads mass to neighbouring cells", () => {
    const e = new SwarmEngine({ robots: 0, evaporation: 0, diffusion: 0.6 }, 1);
    const cx = 50;
    const cy = 50;
    const idx = cy * GW + cx;
    e.food[idx] = 100;
    const before = e.food[idx + 1];
    e.step();
    expect(e.food[idx + 1]).toBeGreaterThan(before);
  });

  it("total mass is bounded by (no growth without deposit)", () => {
    const e = new SwarmEngine({ robots: 0, evaporation: 0.01 }, 1);
    for (let i = 0; i < 100; i++) e.food[i * 5] = 50;
    const initial = e.food.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 30; i++) e.step();
    const final = e.food.reduce((a, b) => a + b, 0);
    expect(final).toBeLessThan(initial);
  });
});

describe("SwarmEngine agents", () => {
  it("robots stay inside the arena bounds", () => {
    const e = new SwarmEngine({ robots: 100 }, 3);
    for (let i = 0; i < 500; i++) e.step();
    for (const r of e.robots) {
      expect(r.x).toBeGreaterThanOrEqual(1);
      expect(r.x).toBeLessThanOrEqual(GW - 1);
      expect(r.y).toBeGreaterThanOrEqual(1);
      expect(r.y).toBeLessThanOrEqual(GH - 1);
    }
  });

  it("setParams(robots) resizes the fleet without resetting the field", () => {
    const e = new SwarmEngine({ robots: 50 }, 1);
    for (let i = 0; i < 20; i++) e.step();
    const foodMass = e.food.reduce((a, b) => a + b, 0);
    e.setParams({ robots: 200 });
    expect(e.robots.length).toBe(200);
    // Field survived
    expect(e.food.reduce((a, b) => a + b, 0)).toBeCloseTo(foodMass, 3);
    e.setParams({ robots: 10 });
    expect(e.robots.length).toBe(10);
  });

  it("agents pick up food and deliver back to nest", () => {
    const e = new SwarmEngine({ robots: 200, foodClusters: 4 }, 12);
    for (let i = 0; i < 1500; i++) e.step();
    expect(e.stats.collected).toBeGreaterThan(0);
    expect(e.stats.trips).toBeGreaterThan(0);
  });
});

describe("SwarmEngine bandwidth model", () => {
  it("kbps scales linearly with fleet size", () => {
    const a = new SwarmEngine({ robots: 100, quantBits: 4, msgHz: 6 }, 1);
    const b = new SwarmEngine({ robots: 400, quantBits: 4, msgHz: 6 }, 1);
    for (let i = 0; i < 30; i++) {
      a.step();
      b.step();
    }
    const ratio = b.stats.bandwidthKbps / a.stats.bandwidthKbps;
    expect(ratio).toBeGreaterThan(3.5);
    expect(ratio).toBeLessThan(4.5);
  });

  it("kbps scales with quantisation bits", () => {
    const low = new SwarmEngine({ robots: 100, quantBits: 2, msgHz: 6 }, 1);
    const high = new SwarmEngine({ robots: 100, quantBits: 8, msgHz: 6 }, 1);
    for (let i = 0; i < 30; i++) {
      low.step();
      high.step();
    }
    expect(high.stats.bandwidthKbps).toBeGreaterThan(low.stats.bandwidthKbps);
  });

  it("compression ratio matches naive / compressed kbps", () => {
    const e = new SwarmEngine({ robots: 100 }, 1);
    for (let i = 0; i < 30; i++) e.step();
    const expected = e.stats.naiveKbps / e.stats.bandwidthKbps;
    expect(e.stats.compression).toBeCloseTo(expected, 3);
  });
});

describe("SwarmEngine snapshots", () => {
  it("snapshot round-trips the essential state", () => {
    const e = new SwarmEngine({ robots: 50 }, 7);
    for (let i = 0; i < 30; i++) e.step();
    const snap = e.snapshot();
    expect(snap.rx.length).toEqual(snap.ry.length);
    expect(snap.rx.length).toEqual(snap.rc.length);
    expect(snap.food.length).toEqual(snap.home.length);
    expect(snap.stats.tick).toEqual(e.stats.tick);
  });

  it("runHeadless returns the requested number of frames", () => {
    const { frames, engine } = runHeadless({ robots: 30 }, 100, 10, 5);
    expect(frames.length).toBe(10);
    expect(engine.stats.tick).toBe(100);
  });
});

describe("SwarmEngine defaults", () => {
  it("exposes sensible defaults", () => {
    expect(DEFAULT_PARAMS.robots).toBeGreaterThan(0);
    expect(DEFAULT_PARAMS.evaporation).toBeGreaterThan(0);
    expect(DEFAULT_PARAMS.evaporation).toBeLessThan(1);
    expect(DEFAULT_PARAMS.diffusion).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_PARAMS.quantBits).toBeGreaterThanOrEqual(1);
  });
});
