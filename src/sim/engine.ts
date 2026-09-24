/**
 * Digital Pheromone Swarm Engine
 * ------------------------------
 * A stigmergic multi-robot foraging model. Two scalar pheromone fields are
 * maintained on a discrete lattice:
 *
 *   Φ_home  — deposited by SEARCHING robots (a breadcrumb back to the nest)
 *   Φ_food  — deposited by RETURNING robots (a recruitment trail to a resource)
 *
 * Each field obeys  ∂Φ/∂t = D∇²Φ − λΦ + Σ deposits
 * (diffusion, evaporation, agent deposition).
 *
 * Robots are reactive: 3 forward sensors sample the relevant field and the
 * agent turns toward the strongest reading, plus a wander term. No global map,
 * no central planner — trails are an emergent property.
 */

export const GW = 200;
export const GH = 126;

export interface Params {
  robots: number;
  speed: number;
  evaporation: number;
  diffusion: number;
  deposit: number;
  sensorAngle: number;
  sensorDist: number;
  turnRate: number;
  wander: number;
  foodClusters: number;
  quantBits: number;
  msgHz: number;
  obstacles: boolean;
}

export const DEFAULT_PARAMS: Params = {
  robots: 260,
  speed: 0.95,
  evaporation: 0.0085,
  diffusion: 0.16,
  deposit: 34,
  sensorAngle: 34,
  sensorDist: 7,
  turnRate: 0.55,
  wander: 0.25,
  foodClusters: 4,
  quantBits: 4,
  msgHz: 6,
  obstacles: true,
};

/**
 * Hard limits enforced by `clampParams`. UI sliders should stay inside these
 * ranges, but we clamp here as a defence against corrupted state, imported
 * JSON, or programmatic bugs.
 */
const PARAM_BOUNDS: Record<keyof Params, [number, number] | null> = {
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

function clampField(key: keyof Params, value: unknown, fallback: number | boolean): unknown {
  const bounds = PARAM_BOUNDS[key];
  if (bounds === null) return value === true || value === "true";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(bounds[1], Math.max(bounds[0], n));
}

/** Reject NaN / Infinity / out-of-range parameter updates. */
export function clampParams(patch: Partial<Params>, base: Params = DEFAULT_PARAMS): Partial<Params> {
  const out: Partial<Params> = {};
  (Object.keys(patch) as (keyof Params)[]).forEach((key) => {
    const value = patch[key];
    if (value === undefined) return;
    (out as Record<string, unknown>)[key] = clampField(key, value, base[key]);
  });
  return out;
}

export const PRESETS: Record<string, { label: string; blurb: string; patch: Partial<Params> }> = {
  balanced: {
    label: "Balanced Forage",
    blurb: "Textbook parameters — stable trails, healthy exploration.",
    patch: {},
  },
  highway: {
    label: "Trail Highway",
    blurb: "Low evaporation + strong deposits create thick persistent arteries.",
    patch: { evaporation: 0.003, deposit: 55, robots: 380, wander: 0.14, diffusion: 0.1 },
  },
  scout: {
    label: "Scout Storm",
    blurb: "High wander, fast decay — maximum coverage, weak convergence.",
    patch: { evaporation: 0.03, deposit: 18, wander: 0.55, robots: 300, sensorAngle: 52 },
  },
  frugal: {
    label: "Bandwidth Frugal",
    blurb: "2-bit quantisation at 2 Hz — swarm on a shoestring radio budget.",
    patch: { quantBits: 2, msgHz: 2, robots: 160, deposit: 40 },
  },
  swarmstorm: {
    label: "Mega Swarm",
    blurb: "900 agents. Watch congestion and trail competition emerge.",
    patch: { robots: 900, deposit: 22, evaporation: 0.012, speed: 1.1 },
  },
};

export interface Robot {
  x: number;
  y: number;
  a: number;
  carrying: boolean;
  age: number;
  tripStart: number;
}

export interface Stats {
  tick: number;
  collected: number;
  trips: number;
  avgTrip: number;
  bandwidthKbps: number;
  naiveKbps: number;
  compression: number;
  coverage: number;
  trailMass: number;
  carrying: number;
  foodRemaining: number;
  efficiency: number;
}

export interface HistoryPoint {
  t: number;
  collected: number;
  bandwidth: number;
  trailMass: number;
  coverage: number;
  carrying: number;
}

export interface Frame {
  t: number;
  /** quantised robot state: x,y in 0..255 and carry flag */
  rx: Uint8Array;
  ry: Uint8Array;
  rc: Uint8Array;
  /** down-sampled pheromone fields (RW x RH), 0..255 */
  food: Uint8Array;
  home: Uint8Array;
  stats: Stats;
}

export const RW = 100;
export const RH = 63;

export interface Recording {
  id: string;
  name: string;
  createdAt: number;
  params: Params;
  frames: Frame[];
  foodSites: { x: number; y: number; r: number }[];
  nest: { x: number; y: number };
  history: HistoryPoint[];
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class SwarmEngine {
  params: Params;
  food: Float32Array;
  home: Float32Array;
  tmp: Float32Array;
  resource: Float32Array;
  wall: Uint8Array;
  visited: Uint8Array;
  robots: Robot[] = [];
  nest = { x: GW / 2, y: GH / 2 };
  foodSites: { x: number; y: number; r: number }[] = [];
  stats: Stats;
  history: HistoryPoint[] = [];
  rand: () => number;
  private tripSum = 0;
  private visitedCount = 0;
  private totalFood = 1;
  /** Sum of Euclidean distance travelled by every robot — proxy for energy cost. */
  private distanceSum = 0;

  constructor(params: Partial<Params> = {}, seed = 1337) {
    this.params = { ...DEFAULT_PARAMS, ...clampParams(params) };
    this.rand = mulberry32(seed);
    const n = GW * GH;
    this.food = new Float32Array(n);
    this.home = new Float32Array(n);
    this.tmp = new Float32Array(n);
    this.resource = new Float32Array(n);
    this.wall = new Uint8Array(n);
    this.visited = new Uint8Array(n);
    this.stats = {
      tick: 0,
      collected: 0,
      trips: 0,
      avgTrip: 0,
      bandwidthKbps: 0,
      naiveKbps: 0,
      compression: 1,
      coverage: 0,
      trailMass: 0,
      carrying: 0,
      foodRemaining: 1,
      efficiency: 0,
    };
    this.reset();
  }

  /** Total distance travelled by all robots — proxy for total energy expended. */
  totalEnergy(): number {
    return this.distanceSum;
  }

  setParams(p: Partial<Params>) {
    const prevRobots = this.params.robots;
    this.params = { ...this.params, ...clampParams(p, this.params) };
    if (this.params.robots !== prevRobots) this.syncRobots();
  }

  reset(seed?: number) {
    if (seed !== undefined) this.rand = mulberry32(seed);
    this.food.fill(0);
    this.home.fill(0);
    this.resource.fill(0);
    this.wall.fill(0);
    this.visited.fill(0);
    this.visitedCount = 0;
    this.tripSum = 0;
    this.distanceSum = 0;
    this.history = [];
    this.robots = [];
    this.stats = { ...this.stats, tick: 0, collected: 0, trips: 0, avgTrip: 0, coverage: 0, efficiency: 0 };
    this.spawnObstacles();
    this.spawnFood();
    this.syncRobots();
  }

  private spawnObstacles() {
    if (!this.params.obstacles) return;
    const R = this.rand;
    const blocks = 5;
    for (let b = 0; b < blocks; b++) {
      const cx = 18 + R() * (GW - 36);
      const cy = 14 + R() * (GH - 28);
      if (Math.hypot(cx - this.nest.x, cy - this.nest.y) < 24) continue;
      const w = 6 + R() * 26;
      const h = 5 + R() * 20;
      for (let y = Math.max(1, cy - h / 2); y < Math.min(GH - 1, cy + h / 2); y++) {
        for (let x = Math.max(1, cx - w / 2); x < Math.min(GW - 1, cx + w / 2); x++) {
          this.wall[(y | 0) * GW + (x | 0)] = 1;
        }
      }
    }
  }

  private spawnFood() {
    const R = this.rand;
    this.foodSites = [];
    let total = 0;
    const count = Math.max(1, Math.round(this.params.foodClusters));
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let tries = 0;
      do {
        const ang = R() * Math.PI * 2;
        const dist = 34 + R() * 52;
        x = this.nest.x + Math.cos(ang) * dist;
        y = this.nest.y + Math.sin(ang) * dist * 0.72;
        tries++;
      } while ((x < 10 || x > GW - 10 || y < 8 || y > GH - 8) && tries < 40);
      const r = 5 + R() * 4;
      this.foodSites.push({ x, y, r });
      for (let dy = -r - 1; dy <= r + 1; dy++) {
        for (let dx = -r - 1; dx <= r + 1; dx++) {
          const px = Math.round(x + dx);
          const py = Math.round(y + dy);
          if (px < 1 || py < 1 || px >= GW - 1 || py >= GH - 1) continue;
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const idx = py * GW + px;
          this.wall[idx] = 0;
          const amount = 3 + 9 * (1 - d / r);
          this.resource[idx] = amount;
          total += amount;
        }
      }
    }
    this.totalFood = Math.max(1, total);
    this.stats.foodRemaining = 1;
  }

  private syncRobots() {
    const target = Math.round(this.params.robots);
    while (this.robots.length > target) this.robots.pop();
    while (this.robots.length < target) {
      const a = this.rand() * Math.PI * 2;
      this.robots.push({
        x: this.nest.x + Math.cos(a) * (1 + this.rand() * 3),
        y: this.nest.y + Math.sin(a) * (1 + this.rand() * 3),
        a,
        carrying: false,
        age: this.rand() * 60,
        tripStart: this.stats.tick,
      });
    }
  }

  private sense(field: Float32Array, x: number, y: number): number {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 1 || yi < 1 || xi >= GW - 1 || yi >= GH - 1) return -1;
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) {
      const row = (yi + dy) * GW;
      s += field[row + xi - 1] + field[row + xi] + field[row + xi + 1];
    }
    return s / 9;
  }

  private isWall(x: number, y: number) {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 1 || yi < 1 || xi >= GW - 1 || yi >= GH - 1) return true;
    return this.wall[yi * GW + xi] === 1;
  }

  step() {
    const p = this.params;
    const n = GW * GH;

    // --- field dynamics: evaporation ---
    const decay = 1 - p.evaporation;
    for (let i = 0; i < n; i++) {
      this.food[i] *= decay;
      this.home[i] *= decay;
    }

    // --- diffusion (separable box blur, blended) ---
    if (p.diffusion > 0.001) {
      this.blur(this.food, p.diffusion);
      this.blur(this.home, p.diffusion);
    }

    // --- agents ---
    const sa = (p.sensorAngle * Math.PI) / 180;
    const sd = p.sensorDist;
    let carrying = 0;
    for (let i = 0; i < this.robots.length; i++) {
      const r = this.robots[i];
      r.age++;
      const target = r.carrying ? this.home : this.food;

      // three whisker sensors
      const fx = r.x + Math.cos(r.a) * sd;
      const fy = r.y + Math.sin(r.a) * sd;
      const lx = r.x + Math.cos(r.a - sa) * sd;
      const ly = r.y + Math.sin(r.a - sa) * sd;
      const rx = r.x + Math.cos(r.a + sa) * sd;
      const ry = r.y + Math.sin(r.a + sa) * sd;

      let f = this.sense(target, fx, fy);
      let l = this.sense(target, lx, ly);
      let rr = this.sense(target, rx, ry);
      if (this.isWall(fx, fy)) f = -6;
      if (this.isWall(lx, ly)) l = -6;
      if (this.isWall(rx, ry)) rr = -6;

      if (r.carrying) {
        // homing bias: pull toward the nest, strongest when close
        const dx = this.nest.x - r.x;
        const dy = this.nest.y - r.y;
        const want = Math.atan2(dy, dx);
        const diff = ((want - r.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        r.a += diff * 0.09;
      }

      if (f >= l && f >= rr) {
        // continue straight
      } else if (l > rr) {
        r.a -= p.turnRate * (0.4 + this.rand() * 0.6);
      } else if (rr > l) {
        r.a += p.turnRate * (0.4 + this.rand() * 0.6);
      } else {
        r.a += (this.rand() - 0.5) * p.turnRate * 2;
      }
      r.a += (this.rand() - 0.5) * p.wander;

      // move with wall reflection
      let nx = r.x + Math.cos(r.a) * p.speed;
      let ny = r.y + Math.sin(r.a) * p.speed;
      if (this.isWall(nx, ny)) {
        // try sliding, else reverse with random scatter
        if (!this.isWall(r.x + Math.cos(r.a) * p.speed, r.y)) {
          ny = r.y;
        } else if (!this.isWall(r.x, r.y + Math.sin(r.a) * p.speed)) {
          nx = r.x;
        } else {
          r.a += Math.PI * (0.6 + this.rand() * 0.8);
          nx = r.x;
          ny = r.y;
        }
      }
      const clampedX = Math.min(GW - 2, Math.max(1, nx));
      const clampedY = Math.min(GH - 2, Math.max(1, ny));
      this.distanceSum += Math.hypot(clampedX - r.x, clampedY - r.y);
      r.x = clampedX;
      r.y = clampedY;

      const idx = (r.y | 0) * GW + (r.x | 0);
      if (!this.visited[idx]) {
        this.visited[idx] = 1;
        this.visitedCount++;
      }

      // deposit — strength decays with time since last "certain" event
      const strength = p.deposit * Math.exp(-r.age / 340);
      if (r.carrying) {
        this.food[idx] += strength;
        carrying++;
      } else {
        this.home[idx] += strength * 0.85;
      }

      // interactions
      if (!r.carrying && this.resource[idx] > 0) {
        this.resource[idx] = Math.max(0, this.resource[idx] - 1);
        r.carrying = true;
        r.age = 0;
        r.a += Math.PI;
        r.tripStart = this.stats.tick;
      } else if (r.carrying && Math.hypot(r.x - this.nest.x, r.y - this.nest.y) < 4.5) {
        r.carrying = false;
        r.age = 0;
        r.a += Math.PI * (0.7 + this.rand() * 0.6);
        this.stats.collected++;
        this.stats.trips++;
        this.tripSum += this.stats.tick - r.tripStart;
      }
    }

    this.stats.tick++;
    this.stats.carrying = carrying;

    if (this.stats.tick % 6 === 0) this.recomputeStats();
    if (this.stats.tick % 12 === 0) {
      this.history.push({
        t: this.stats.tick,
        collected: this.stats.collected,
        bandwidth: this.stats.bandwidthKbps,
        trailMass: this.stats.trailMass,
        coverage: this.stats.coverage,
        carrying: this.stats.carrying,
      });
      if (this.history.length > 900) this.history.shift();
    }
  }

  private blur(field: Float32Array, amount: number) {
    const tmp = this.tmp;
    for (let y = 1; y < GH - 1; y++) {
      const row = y * GW;
      for (let x = 1; x < GW - 1; x++) {
        const i = row + x;
        tmp[i] = (field[i - 1] + field[i] + field[i + 1]) / 3;
      }
    }
    for (let y = 1; y < GH - 1; y++) {
      const row = y * GW;
      for (let x = 1; x < GW - 1; x++) {
        const i = row + x;
        const b = (tmp[i - GW] + tmp[i] + tmp[i + GW]) / 3;
        field[i] = field[i] + (b - field[i]) * amount;
      }
    }
  }

  private recomputeStats() {
    const n = GW * GH;
    let mass = 0;
    let res = 0;
    for (let i = 0; i < n; i++) {
      mass += this.food[i];
      res += this.resource[i];
    }
    const p = this.params;
    // Bandwidth model: each robot broadcasts a delta patch of the local field.
    // Patch = 5x5 cells, quantised to `quantBits`, run-length collapsed (~0.55),
    // plus an 6-byte header (id, pose, checksum).
    const patchCells = 25;
    const rawBits = patchCells * p.quantBits;
    const bytesPerMsg = 6 + (rawBits / 8) * 0.55;
    const naiveBytes = 6 + patchCells * 4; // float32 uncompressed
    const kbps = (this.robots.length * p.msgHz * bytesPerMsg * 8) / 1000;
    const naive = (this.robots.length * p.msgHz * naiveBytes * 8) / 1000;

    this.stats.trailMass = mass / 1000;
    this.stats.bandwidthKbps = kbps;
    this.stats.naiveKbps = naive;
    this.stats.compression = naive / Math.max(0.001, kbps);
    this.stats.coverage = this.visitedCount / n;
    this.stats.foodRemaining = res / this.totalFood;
    this.stats.avgTrip = this.stats.trips ? this.tripSum / this.stats.trips : 0;
    this.stats.efficiency =
      this.stats.tick > 0 ? (this.stats.collected / this.stats.tick) * (60 / Math.max(1, this.robots.length)) * 100 : 0;
  }

  /** Compact snapshot for the replay system. */
  snapshot(): Frame {
    const nR = Math.min(this.robots.length, 500);
    const stride = this.robots.length / nR;
    const rx = new Uint8Array(nR);
    const ry = new Uint8Array(nR);
    const rc = new Uint8Array(nR);
    for (let i = 0; i < nR; i++) {
      const r = this.robots[Math.floor(i * stride)];
      rx[i] = Math.max(0, Math.min(255, (r.x / GW) * 255));
      ry[i] = Math.max(0, Math.min(255, (r.y / GH) * 255));
      rc[i] = r.carrying ? 1 : 0;
    }
    const food = new Uint8Array(RW * RH);
    const home = new Uint8Array(RW * RH);
    const sx = GW / RW;
    const sy = GH / RH;
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < RW; x++) {
        const gi = ((y * sy) | 0) * GW + ((x * sx) | 0);
        food[y * RW + x] = Math.min(255, this.food[gi] * 1.06);
        home[y * RW + x] = Math.min(255, this.home[gi] * 1.06);
      }
    }
    return { t: this.stats.tick, rx, ry, rc, food, home, stats: { ...this.stats } };
  }
}

/** Run an engine headless for `ticks`, capturing a frame every `every` ticks. */
export function runHeadless(
  params: Partial<Params>,
  ticks: number,
  every: number,
  seed = 7,
): { engine: SwarmEngine; frames: Frame[] } {
  const engine = new SwarmEngine(params, seed);
  const frames: Frame[] = [];
  for (let i = 0; i < ticks; i++) {
    engine.step();
    if (i % every === 0) frames.push(engine.snapshot());
  }
  return { engine, frames };
}
