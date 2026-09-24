import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PARAMS, GH, GW, SwarmEngine, type Params } from "../sim/engine";
import { BaselineEngine, centralizedKbps } from "../sim/baseline";
import { DEFAULT_VIEW, renderBaseline, renderEngine } from "../sim/render";
import { Btn, Chip, LineChart, Panel, Slider, Stat, formatNum } from "../components/ui";
import { cn } from "../utils/cn";

interface Sample {
  t: number;
  swarmDelivered: number;
  baseDelivered: number;
  swarmKbps: number;
  baseKbps: number;
  swarmEnergy: number;
  baseEnergy: number;
}

const TARGET_DELIVERIES = 25;

export default function Compare() {
  const swarmCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const swarmEngineRef = useRef<SwarmEngine | null>(null);
  const baseEngineRef = useRef<BaselineEngine | null>(null);

  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(0);
  const [robots, setRobots] = useState(200);
  const [seed, setSeed] = useState(4242);
  const [history, setHistory] = useState<Sample[]>([]);
  const [swarmTTF, setSwarmTTF] = useState<number | null>(null);
  const [baseTTF, setBaseTTF] = useState<number | null>(null);
  const [foodClusters, setFoodClusters] = useState(4);

  const runRef = useRef(running);
  runRef.current = running;

  const boot = useCallback((rs: number, fc: number, s: number) => {
    const patch: Partial<Params> = { ...DEFAULT_PARAMS, robots: rs, foodClusters: fc };
    const swarm = new SwarmEngine(patch, s);
    const base = new BaselineEngine(
      {
        robots: rs,
        speed: DEFAULT_PARAMS.speed,
        msgHz: DEFAULT_PARAMS.msgHz,
        quantBits: DEFAULT_PARAMS.quantBits,
      },
      swarm.nest,
      swarm.foodSites,
      swarm.wall,
      s,
    );
    swarmEngineRef.current = swarm;
    baseEngineRef.current = base;
    setHistory([]);
    setSwarmTTF(null);
    setBaseTTF(null);
    setTick(0);
  }, []);

  useEffect(() => {
    boot(robots, foodClusters, seed);
  }, [boot, robots, foodClusters, seed]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    let lastSample = 0;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      const swarm = swarmEngineRef.current;
      const base = baseEngineRef.current;
      if (!swarm || !base) return;
      if (runRef.current && !document.hidden) {
        swarm.step();
        base.step();
        // First to hit TARGET_DELIVERIES wins the "convergence time" race.
        if (swarmTTF === null && swarm.stats.collected >= TARGET_DELIVERIES) {
          setSwarmTTF(swarm.stats.tick);
        }
        if (baseTTF === null && base.stats.collected >= TARGET_DELIVERIES) {
          setBaseTTF(base.stats.tick);
        }
      }
      if (swarmCanvasRef.current) renderEngine(swarmCanvasRef.current, swarm, DEFAULT_VIEW);
      if (baseCanvasRef.current) renderBaseline(baseCanvasRef.current, base);
      if (swarm.stats.tick - lastSample >= 12) {
        lastSample = swarm.stats.tick;
        setHistory((h) => {
          const next = [
            ...h,
            {
              t: swarm.stats.tick,
              swarmDelivered: swarm.stats.collected,
              baseDelivered: base.stats.collected,
              swarmKbps: swarm.stats.bandwidthKbps,
              baseKbps: base.stats.bandwidthKbps,
              swarmEnergy: swarm.totalEnergy(),
              baseEnergy: base.totalEnergy(),
            },
          ];
          if (next.length > 200) next.shift();
          return next;
        });
        setTick(swarm.stats.tick);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [swarmTTF, baseTTF]);

  const swarm = swarmEngineRef.current;
  const base = baseEngineRef.current;
  const swarmKbps = swarm?.stats.bandwidthKbps ?? 0;
  const baseKbps = base?.stats.bandwidthKbps ?? 0;
  const bandwidthRatio = baseKbps > 0 ? baseKbps / Math.max(0.001, swarmKbps) : 0;
  const bwBreak = centralizedKbps(
    robots,
    base?.foodSites.length ?? foodClusters,
    DEFAULT_PARAMS.msgHz,
  );

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-pink-400/80 uppercase">
            module 05 · A/B benchmark
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Stigmergic vs Centralized
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-slate-400">
            Same seed, same food layout, same fleet size. Left: our pheromone swarm coordinating
            through the environment. Right: a greedy centralized planner with a shared food map.
            Watch bandwidth diverge while yield stays comparable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color={running ? "emerald" : "amber"}>{running ? "▶ running" : "❚❚ paused"}</Chip>
          <Chip color="cyan">tick {tick.toLocaleString()}</Chip>
          <Btn variant={running ? "soft" : "primary"} onClick={() => setRunning((r) => !r)}>
            {running ? "❚❚ Pause" : "▶ Resume"}
          </Btn>
          <Btn onClick={() => boot(robots, foodClusters, seed)}>↻ Reset</Btn>
          <Btn onClick={() => setSeed(Math.floor(Math.random() * 100000))}>🎲 New seed</Btn>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Panel dense>
          <Slider
            label="Fleet size (both)"
            value={robots}
            min={40}
            max={600}
            step={10}
            onChange={setRobots}
          />
        </Panel>
        <Panel dense>
          <Slider
            label="Food clusters"
            value={foodClusters}
            min={1}
            max={9}
            onChange={setFoodClusters}
          />
        </Panel>
        <Panel dense className="flex items-center justify-between gap-4 px-4">
          <div className="font-mono text-[10px] tracking-widest text-slate-500 uppercase">
            first to {TARGET_DELIVERIES} deliveries
          </div>
          <div className="flex gap-3 font-mono text-xs">
            <span className="text-cyan-300">stig: {swarmTTF !== null ? `${swarmTTF}t` : "…"}</span>
            <span className="text-pink-300">cent: {baseTTF !== null ? `${baseTTF}t` : "…"}</span>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Stigmergic swarm" right={<Chip color="cyan">Φ pheromone</Chip>} dense>
          <div className="relative overflow-hidden rounded-lg border border-white/[0.09] bg-ink-950">
            <canvas
              ref={swarmCanvasRef}
              role="img"
              aria-label="Stigmergic swarm — agents coordinate through pheromone trails"
              className="block w-full"
              style={{ aspectRatio: `${GW} / ${GH}` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="delivered" value={swarm?.stats.collected ?? 0} accent="cyan" />
            <Stat label="uplink" value={swarmKbps.toFixed(1)} unit="kbps" accent="emerald" />
            <Stat
              label="energy"
              value={formatNum(swarm?.totalEnergy() ?? 0)}
              unit="c"
              accent="violet"
            />
          </div>
        </Panel>
        <Panel title="Centralized greedy" right={<Chip color="amber">shared map</Chip>} dense>
          <div className="relative overflow-hidden rounded-lg border border-white/[0.09] bg-ink-950">
            <canvas
              ref={baseCanvasRef}
              role="img"
              aria-label="Centralized greedy planner — agents receive a full shared food map"
              className="block w-full"
              style={{ aspectRatio: `${GW} / ${GH}` }}
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="delivered" value={base?.stats.collected ?? 0} accent="cyan" />
            <Stat label="uplink" value={baseKbps.toFixed(1)} unit="kbps" accent="amber" />
            <Stat
              label="energy"
              value={formatNum(base?.totalEnergy() ?? 0)}
              unit="c"
              accent="violet"
            />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Cumulative yield">
          <LineChart
            height={160}
            series={[
              {
                name: "stigmergic",
                color: "#22d3ee",
                data: history.map((h) => h.swarmDelivered),
              },
              {
                name: "centralized",
                color: "#f472b6",
                data: history.map((h) => h.baseDelivered),
              },
            ]}
          />
        </Panel>
        <Panel title="Radio load over run" right={<Chip color="emerald">kbps</Chip>}>
          <LineChart
            height={160}
            series={[
              {
                name: "stigmergic",
                color: "#22d3ee",
                data: history.map((h) => h.swarmKbps),
              },
              {
                name: "centralized",
                color: "#f472b6",
                data: history.map((h) => h.baseKbps),
              },
            ]}
          />
        </Panel>
        <Panel title="Energy cost (Σ distance)">
          <LineChart
            height={160}
            series={[
              {
                name: "stigmergic",
                color: "#22d3ee",
                data: history.map((h) => h.swarmEnergy),
              },
              {
                name: "centralized",
                color: "#f472b6",
                data: history.map((h) => h.baseEnergy),
              },
            ]}
          />
        </Panel>
      </div>

      <Panel title="Bandwidth breakdown · centralized" className="mt-4" dense>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat
            label="map refresh"
            value={bwBreak.breakdown.mapKbps.toFixed(1)}
            unit="kbps"
            accent="amber"
            hint="foodCount × 16 B × robots @ 1 Hz"
          />
          <Stat
            label="pose telemetry"
            value={bwBreak.breakdown.poseKbps.toFixed(1)}
            unit="kbps"
            accent="slate"
            hint="12 B × robots × msgHz"
          />
          <Stat label="total centralized" value={baseKbps.toFixed(1)} unit="kbps" accent="amber" />
          <Stat
            label="stigmergic savings"
            value={bandwidthRatio > 0 ? `${bandwidthRatio.toFixed(1)}×` : "—"}
            accent="emerald"
            hint="centralized ÷ stigmergic"
          />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
          The centralized model assumes a shared authoritative food map is rebroadcast at{" "}
          <span className="text-white">1 Hz</span> plus per-agent pose telemetry at the same{" "}
          {DEFAULT_PARAMS.msgHz}&nbsp;Hz cadence. Stigmergic broadcast is a{" "}
          <span className="text-white">5&nbsp;×&nbsp;5 field patch</span> at the same rate,
          quantised and run-length collapsed.
        </p>
      </Panel>

      <p className="mt-6 text-[11.5px] leading-relaxed text-slate-500">
        Both simulators consume the same seed and food-cluster layout so the arena is identical. The
        greedy planner is deliberately simple — no A*, no re-planning — because the point of the
        comparison is the{" "}
        <span
          className={cn("font-mono", bandwidthRatio > 5 ? "text-emerald-300" : "text-slate-400")}
        >
          radio budget
        </span>
        , not the local navigation quality.
      </p>
    </div>
  );
}
