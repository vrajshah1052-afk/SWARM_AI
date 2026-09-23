import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../../sim/engine";
import { parseImportedRun, sanitizeParams, ValidationError } from "../validate";

describe("sanitizeParams", () => {
  it("clamps out-of-range values", () => {
    const p = sanitizeParams({ robots: 99999, evaporation: -1, diffusion: 2, quantBits: 100 });
    expect(p.robots).toBe(2000);
    expect(p.evaporation).toBe(0.0001);
    expect(p.diffusion).toBe(1);
    expect(p.quantBits).toBe(16);
  });

  it("falls back for NaN / non-numeric", () => {
    const p = sanitizeParams({ robots: NaN, deposit: "banana" });
    expect(p.robots).toBe(DEFAULT_PARAMS.robots);
    expect(p.deposit).toBe(DEFAULT_PARAMS.deposit);
  });

  it("preserves valid values", () => {
    const p = sanitizeParams({ robots: 150, wander: 0.4, obstacles: false });
    expect(p.robots).toBe(150);
    expect(p.wander).toBeCloseTo(0.4);
    expect(p.obstacles).toBe(false);
  });

  it("throws on non-object input", () => {
    expect(() => sanitizeParams(null)).toThrow(ValidationError);
    expect(() => sanitizeParams(42)).toThrow(ValidationError);
  });
});

describe("parseImportedRun", () => {
  it("accepts a full export blob with a 'params' key", () => {
    const blob = JSON.stringify({ params: { robots: 200 }, stats: {}, history: [] });
    expect(parseImportedRun(blob).params.robots).toBe(200);
  });

  it("accepts a bare params object", () => {
    expect(parseImportedRun('{"robots": 42}').params.robots).toBe(42);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseImportedRun("not json")).toThrow(ValidationError);
  });
});
