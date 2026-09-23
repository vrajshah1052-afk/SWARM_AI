/**
 * Runtime schema validation for JSON blobs imported from disk.
 *
 * We never trust user-supplied JSON. Every field is clamped to the same range
 * exposed by the UI sliders in `sim/engine.ts`.
 */

import { DEFAULT_PARAMS, type Params } from "../sim/engine";

export const PARAM_LIMITS: Record<keyof Params, [number, number] | null> = {
  robots: [1, 2000],
  speed: [0.05, 5],
  evaporation: [0.0001, 0.5],
  diffusion: [0, 1],
  deposit: [0.5, 200],
  sensorAngle: [1, 179],
  sensorDist: [1, 40],
  turnRate: [0.01, 6.28],
  wander: [0, 3],
  foodClusters: [1, 32],
  quantBits: [1, 16],
  msgHz: [0.1, 200],
  obstacles: null,
};

export class ValidationError extends Error {
  override name = "ValidationError";
}

function clampNumber(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Coerce an unknown value into a valid Params object.
 * Missing / invalid fields fall back to DEFAULT_PARAMS.
 */
export function sanitizeParams(input: unknown): Params {
  if (!input || typeof input !== "object") {
    throw new ValidationError("Expected an object with a 'params' shape.");
  }
  const src = input as Record<string, unknown>;
  const out = { ...DEFAULT_PARAMS } as unknown as Record<string, number | boolean>;
  (Object.keys(PARAM_LIMITS) as (keyof Params)[]).forEach((key) => {
    const limit = PARAM_LIMITS[key];
    const raw = src[key];
    if (raw === undefined) return;
    if (limit === null) {
      out[key] = raw === true || raw === "true";
    } else {
      const fallback = DEFAULT_PARAMS[key] as number;
      out[key] = clampNumber(raw, limit[0], limit[1], fallback);
    }
  });
  return out as unknown as Params;
}

/**
 * Validate a JSON blob that came from Simulator's "⤓ JSON" export.
 * Accepts either { params: ... } or a raw Params object.
 */
export function parseImportedRun(text: string): { params: Params } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new ValidationError(
      `File is not valid JSON: ${(err as Error).message}`,
    );
  }
  if (!json || typeof json !== "object") {
    throw new ValidationError("Import must be a JSON object.");
  }
  const candidate =
    "params" in (json as Record<string, unknown>)
      ? (json as { params: unknown }).params
      : json;
  return { params: sanitizeParams(candidate) };
}
