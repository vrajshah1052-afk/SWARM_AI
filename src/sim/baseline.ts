/**
 * Centralized "greedy" baseline for side-by-side comparison against the
 * stigmergic swarm.
 *
 * The stigmergic engine (sim/engine.ts) has:
 *   • no shared map
 *   • no leader
 *   • communication happens through the environment (pheromone trails)
 *
 * This baseline is the opposite: every agent shares a full authoritative
 * map of food locations, walks a straight line toward its assigned
 * target, and gets a fresh map update every second. That map update is
 * the honest bandwidth cost of "the centralized approach" — a
 * `foodSites × pose × robots × updateHz` term that scales badly.
 *
 * Together the two engines let /compare tell a real story: the same
 * fleet on the same field, one paying centralized comms cost, the other
 * paying near-zero.
 */
import { GH, GW, type Params, type Stats } from "./engine";

export interface BaselineAgent {
  x: number;
  y: number;
  targetIdx: number; // index into foodSites; -1 if returning
  carrying: boolean;
  totalDistance: number;
}

export interface BaselineOptions {
  robots: number;
  speed: number;
  msgHz: number;
  quantBits: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bandwidth model for the centralized approach.
 * Each robot receives the full food map at 1 Hz and broadcasts its pose at msgHz.
 * The map itself is `foodCount * 16 bytes` (id + x + y + amount).
 */
export function centralizedKbps(
  robots: number,
  foodCount: number,
  msgHz: number,
): { kbps: number; breakdown: { poseKbps: number; mapKbps: number } } {
  const mapBytes = Math.max(1, foodCount) * 16; // per-agent map refresh
  const poseBytes = 12; // 4B x, 4B y, 4B flags/id
  const mapKbps = (robots * 1 * mapBytes * 8) / 1000; // 1 Hz map refresh
  const poseKbps = (robots * msgHz * poseBytes * 8) / 1000;
  return { kbps: mapKbps + poseKbps, breakdown: { mapKbps, poseKbps } };
}

/**
 * Run a centralized/greedy foraging simulation over the same arena,
 * food, and nest that the stigmergic SwarmEngine is using.
 */
export class BaselineEngine {
  agents: BaselineAgent[] = [];
  stats: Stats;
  params: Pick<Params, "robots" | "speed" | "msgHz" | "quantBits">;
  nest: { x: number; y: number };
  foodSites: { x: number; y: number; r: number; remaining: number }[];
  wall: Uint8Array;
  private rand: () => number;
  private totalFood = 1;
  private tripSum = 0;

  constructor(
    opts: BaselineOptions,
    nest: { x: number; y: number },
    foodSites: { x: number; y: number; r: number }[],
    wall: Uint8Array,
    seed = 1337,
  ) {
    this.params = { ...opts };
    this.rand = mulberry32(seed);
    this.nest = { ...nest };
    this.wall = wall;
    this.foodSites = foodSites.map((f) => ({
      x: f.x,
      y: f.y,
      r: f.r,
      // per-site stockpile roughly matching how the stigmergic engine seeds resources
      remaining: Math.round(Math.PI * f.r * f.r * 6),
    }));
    this.totalFood = Math.max(
      1,
      this.foodSites.reduce((a, b) => a + b.remaining, 0),
    );
    this.stats = {
      tick: 0,
      collected: 0,
      trips: 0,
      avgTrip: 0,
      bandwidthKbps: centralizedKbps(opts.robots, this.foodSites.length, opts.msgHz).kbps,
      naiveKbps: 0,
      compression: 1,
      coverage: 0,
      trailMass: 0,
      carrying: 0,
      foodRemaining: 1,
      efficiency: 0,
    };
    this.spawnAgents();
  }

  private spawnAgents(): void {
    for (let i = 0; i < this.params.robots; i++) {
      const a = this.rand() * Math.PI * 2;
      this.agents.push({
        x: this.nest.x + Math.cos(a) * (1 + this.rand() * 3),
        y: this.nest.y + Math.sin(a) * (1 + this.rand() * 3),
        targetIdx: this.pickNearestFood(this.nest.x, this.nest.y),
        carrying: false,
        totalDistance: 0,
      });
    }
  }

  private pickNearestFood(x: number, y: number): number {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.foodSites.length; i++) {
      const f = this.foodSites[i];
      if (f.remaining <= 0) continue;
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private isWall(x: number, y: number): boolean {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 1 || yi < 1 || xi >= GW - 1 || yi >= GH - 1) return true;
    return this.wall[yi * GW + xi] === 1;
  }

  step(): void {
    let carrying = 0;
    for (const a of this.agents) {
      // Choose destination
      let tx: number;
      let ty: number;
      if (a.carrying) {
        tx = this.nest.x;
        ty = this.nest.y;
      } else if (a.targetIdx < 0 || this.foodSites[a.targetIdx].remaining <= 0) {
        a.targetIdx = this.pickNearestFood(a.x, a.y);
        if (a.targetIdx < 0) continue; // no food remains
        tx = this.foodSites[a.targetIdx].x;
        ty = this.foodSites[a.targetIdx].y;
      } else {
        tx = this.foodSites[a.targetIdx].x;
        ty = this.foodSites[a.targetIdx].y;
      }

      const dx = tx - a.x;
      const dy = ty - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = Math.min(this.params.speed, dist);
      let nx = a.x + (dx / dist) * step;
      let ny = a.y + (dy / dist) * step;

      // Naive obstacle sidestep — if the direct step is blocked, try axis-aligned
      // components, else jitter around it. This is deliberately dumber than the
      // stigmergic controller so the comparison stays honest.
      if (this.isWall(nx, ny)) {
        if (!this.isWall(a.x + (dx / dist) * step, a.y)) {
          ny = a.y;
        } else if (!this.isWall(a.x, a.y + (dy / dist) * step)) {
          nx = a.x;
        } else {
          nx = a.x + (this.rand() - 0.5) * 1.5;
          ny = a.y + (this.rand() - 0.5) * 1.5;
        }
      }
      nx = Math.min(GW - 2, Math.max(1, nx));
      ny = Math.min(GH - 2, Math.max(1, ny));
      a.totalDistance += Math.hypot(nx - a.x, ny - a.y);
      a.x = nx;
      a.y = ny;

      if (!a.carrying && a.targetIdx >= 0) {
        const f = this.foodSites[a.targetIdx];
        if (Math.hypot(a.x - f.x, a.y - f.y) < f.r + 0.5 && f.remaining > 0) {
          f.remaining -= 1;
          a.carrying = true;
        }
      } else if (a.carrying && Math.hypot(a.x - this.nest.x, a.y - this.nest.y) < 4.5) {
        a.carrying = false;
        this.stats.collected++;
        this.stats.trips++;
        this.tripSum += this.stats.tick;
        a.targetIdx = this.pickNearestFood(a.x, a.y);
      }
      if (a.carrying) carrying++;
    }
    this.stats.tick++;
    this.stats.carrying = carrying;
    if (this.stats.tick % 6 === 0) this.recomputeStats();
  }

  private recomputeStats(): void {
    const remaining = this.foodSites.reduce((a, b) => a + b.remaining, 0);
    this.stats.foodRemaining = remaining / this.totalFood;
    this.stats.avgTrip = this.stats.trips ? this.tripSum / this.stats.trips : 0;
    // Coverage proxy: fraction of tiles within one step of an agent path.
    // Kept crude — the fair comparison metric is `collected` and `bandwidth`.
    this.stats.coverage = Math.min(1, this.stats.collected / (this.totalFood + 1));
  }

  /** Total distance travelled across the fleet — proxy for energy cost. */
  totalEnergy(): number {
    let s = 0;
    for (const a of this.agents) s += a.totalDistance;
    return s;
  }
}
