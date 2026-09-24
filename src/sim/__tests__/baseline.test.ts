import { describe, expect, it } from "vitest";
import { BaselineEngine, centralizedKbps } from "../baseline";
import { GW, GH } from "../engine";

function fakeArena(seed = 1) {
  const wall = new Uint8Array(GW * GH);
  const foodSites = [
    { x: 80, y: 40, r: 5 },
    { x: 130, y: 80, r: 5 },
  ];
  const nest = { x: 100, y: 63 };
  const engine = new BaselineEngine(
    { robots: 40, speed: 1, msgHz: 6, quantBits: 4 },
    nest,
    foodSites,
    wall,
    seed,
  );
  return engine;
}

describe("BaselineEngine", () => {
  it("spawns the requested fleet size at the nest", () => {
    const e = fakeArena(1);
    expect(e.agents.length).toBe(40);
    for (const a of e.agents) {
      expect(Math.hypot(a.x - e.nest.x, a.y - e.nest.y)).toBeLessThan(6);
    }
  });

  it("collects food and delivers over time", () => {
    const e = fakeArena(2);
    for (let i = 0; i < 800; i++) e.step();
    expect(e.stats.collected).toBeGreaterThan(0);
    expect(e.totalEnergy()).toBeGreaterThan(0);
  });

  it("depletes food sites eventually", () => {
    const e = fakeArena(3);
    const total = e.foodSites.reduce((a, b) => a + b.remaining, 0);
    for (let i = 0; i < 4000; i++) e.step();
    const now = e.foodSites.reduce((a, b) => a + b.remaining, 0);
    expect(now).toBeLessThan(total);
  });
});

describe("centralizedKbps model", () => {
  it("scales linearly with fleet size", () => {
    const a = centralizedKbps(100, 5, 6).kbps;
    const b = centralizedKbps(400, 5, 6).kbps;
    expect(b / a).toBeGreaterThan(3.5);
    expect(b / a).toBeLessThan(4.5);
  });

  it("separates map and pose components", () => {
    const r = centralizedKbps(200, 4, 6);
    expect(r.breakdown.mapKbps).toBeGreaterThan(0);
    expect(r.breakdown.poseKbps).toBeGreaterThan(0);
    expect(r.kbps).toBeCloseTo(r.breakdown.mapKbps + r.breakdown.poseKbps, 6);
  });
});
