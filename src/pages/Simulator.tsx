import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_PARAMS,
  GH,
  GW,
  PRESETS,
  SwarmEngine,
  type Frame,
  type Params,
  type Stats,
} from "../sim/engine";
import { DEFAULT_VIEW, renderEngine, type ViewOpts } from "../sim/render";
import { addRecording, newId } from "../sim/store";
import { Btn, Chip, LineChart, Panel, Slider, Stat, Toggle, formatNum } from "../components/ui";
import { cn } from "../utils/cn";
import { downloadDataUrl, downloadJSON } from "../utils/download";
import { synth } from "../utils/audio";

type Brush = "none" | "food" | "wall" | "erase";

export default function Simulator() {
  const navigate = useNavigate();
  const engineRef = useRef<SwarmEngine | null>(null);
  if (!engineRef.current) engineRef.current = new SwarmEngine(DEFAULT_PARAMS, 7);
  const engine = engineRef.current;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [view, setView] = useState<ViewOpts>(DEFAULT_VIEW);
  const [running, setRunning] = useState(true);
  const [turbo, setTurbo] = useState(1);
  const [brush, setBrush] = useState<Brush>("none");
  const [stats, setStats] = useState<Stats>(engine.stats);
  const [history, setHistory] = useState(engine.history);
  const [fps, setFps] = useState(60);
  const [recording, setRecording] = useState(false);
  const [recFrames, setRecFrames] = useState(0);
  const [preset, setPreset] = useState("balanced");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [paramDrawerOpen, setParamDrawerOpen] = useState(false);
  const soundState = useRef({
    lastCollected: 0,
    lastCarrying: 0,
    lastPickupTick: 0,
  });

  const runRef = useRef(running);
  const turboRef = useRef(turbo);
  const viewRef = useRef(view);
  const recRef = useRef<{ on: boolean; frames: Frame[] }>({ on: false, frames: [] });
  runRef.current = running;
  turboRef.current = turbo;
  viewRef.current = view;

  useEffect(() => {
    engine.setParams(params);
  }, [params, engine]);

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let alive = true;
    let lastStats = 0;
    let frames = 0;
    let fpsT = performance.now();

    const loop = (t: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (runRef.current && !document.hidden) {
        for (let i = 0; i < turboRef.current; i++) engine.step();
        if (recRef.current.on && engine.stats.tick % 5 === 0) {
          recRef.current.frames.push(engine.snapshot());
          if (recRef.current.frames.length % 10 === 0) setRecFrames(recRef.current.frames.length);
          if (recRef.current.frames.length >= 420) {
            recRef.current.on = false;
            setRecording(false);
          }
        }
        // Aural feedback: nest returns → boom; food pickups → chime;
        // active carrying → throttled ping via synth's internal rate limit.
        const s = soundState.current;
        const returns = engine.stats.collected - s.lastCollected;
        const carryDelta = engine.stats.carrying - s.lastCarrying;
        if (returns > 0) synth.play("boom");
        // Pickups produce a positive carryDelta but at most a few per burst;
        // throttle to one chime per ~15 ticks to avoid a wall of sound.
        if (carryDelta > 0 && engine.stats.tick - s.lastPickupTick > 15) {
          synth.play("chime");
          s.lastPickupTick = engine.stats.tick;
        }
        if (engine.stats.carrying > 0) synth.play("ping");
        s.lastCollected = engine.stats.collected;
        s.lastCarrying = engine.stats.carrying;
      }
      renderEngine(canvas, engine, viewRef.current);
      frames++;
      if (t - fpsT > 700) {
        setFps(Math.round((frames * 1000) / (t - fpsT)));
        frames = 0;
        fpsT = t;
      }
      if (t - lastStats > 120) {
        lastStats = t;
        setStats({ ...engine.stats });
        setHistory([...engine.history]);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [engine]);

  // painting — shared kernel for mouse and touch input.
  const paintAt = useCallback(
    (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
      if (brush === "none") return;
      const rect = canvas.getBoundingClientRect();
      const gx = Math.round(((clientX - rect.left) / rect.width) * GW);
      const gy = Math.round(((clientY - rect.top) / rect.height) * GH);
      const r = brush === "food" ? 5 : 4;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = gx + dx;
          const y = gy + dy;
          if (x < 1 || y < 1 || x >= GW - 1 || y >= GH - 1) continue;
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const i = y * GW + x;
          if (brush === "food") {
            engine.resource[i] = Math.max(engine.resource[i], 3 + 8 * (1 - d / r));
            engine.wall[i] = 0;
          } else if (brush === "wall") {
            engine.wall[i] = 1;
            engine.resource[i] = 0;
          } else {
            engine.wall[i] = 0;
            engine.resource[i] = 0;
            engine.food[i] = 0;
            engine.home[i] = 0;
          }
        }
      }
    },
    [brush, engine],
  );

  const paint = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.buttons !== 1) return;
      paintAt(e.currentTarget, e.clientX, e.clientY);
    },
    [paintAt],
  );

  const touchPaint = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (brush === "none") return;
      // Prevent the browser from turning the touch into a scroll/zoom.
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      paintAt(e.currentTarget, t.clientX, t.clientY);
    },
    [brush, paintAt],
  );

  const applyPreset = (key: string) => {
    setPreset(key);
    const next = { ...DEFAULT_PARAMS, ...PRESETS[key].patch };
    setParams(next);
    engine.setParams(next);
    engine.reset(Math.floor(Math.random() * 99999));
  };

  const reset = () => {
    engine.reset(Math.floor(Math.random() * 99999));
    setStats({ ...engine.stats });
    setHistory([]);
  };

  const toggleRecord = () => {
    if (recRef.current.on) {
      recRef.current.on = false;
      setRecording(false);
      const frames = recRef.current.frames;
      if (frames.length > 4) {
        const rec = addRecording({
          id: newId(),
          name: `Live capture · ${PRESETS[preset].label}`,
          createdAt: Date.now(),
          params: { ...params },
          frames,
          foodSites: engine.foodSites.map((f) => ({ ...f })),
          nest: { ...engine.nest },
          history: [...engine.history],
        });
        void navigate(`/replay?id=${rec.id}`);
      }
    } else {
      recRef.current = { on: true, frames: [] };
      setRecFrames(0);
      setRecording(true);
      setRunning(true);
    }
  };

  const exportPng = () => {
    const c = canvasRef.current;
    if (!c) {
      setErrorMsg("Canvas is not ready — try again in a moment.");
      return;
    }
    try {
      const url = c.toDataURL("image/png");
      const res = downloadDataUrl(`pheromone-field-t${engine.stats.tick}.png`, url);
      if (!res.ok) setErrorMsg(`PNG export failed: ${res.error.message}`);
    } catch (err) {
      setErrorMsg(`PNG export failed: ${(err as Error).message}`);
    }
  };

  const exportJson = () => {
    const res = downloadJSON(`swarm-run-t${engine.stats.tick}.json`, {
      params,
      stats: engine.stats,
      history: engine.history,
    });
    if (!res.ok) setErrorMsg(`JSON export failed: ${res.error.message}`);
  };

  const P = useCallback(
    (k: keyof Params) => (v: number) => setParams((p) => ({ ...p, [k]: v })),
    [],
  );
  const hist = history.slice(-70);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-cyan-400/80 uppercase">
            module 01 · real-time
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Live Swarm Simulator
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-slate-400">
            Tune the field physics and agent policy while the colony runs. Paint food and walls
            straight onto the lattice and watch the trails re-route.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color={running ? "emerald" : "amber"}>{running ? "▶ running" : "❚❚ paused"}</Chip>
          <Chip color="slate">{fps} fps</Chip>
          <Chip color="cyan">tick {stats.tick.toLocaleString()}</Chip>
          <button
            type="button"
            role="switch"
            aria-checked={!muted}
            aria-label={muted ? "Enable sound" : "Mute sound"}
            onClick={() => {
              const next = !muted;
              setMuted(next);
              synth.setMuted(next);
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:outline-none",
              muted
                ? "border-white/10 text-slate-500 hover:text-slate-200"
                : "border-cyan-400/40 bg-cyan-400/[0.08] text-cyan-300",
            )}
          >
            {muted ? "🔇 sound off" : "🔊 sound on"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-4 py-2.5 text-[12px] text-rose-200"
        >
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            aria-label="dismiss error"
            className="text-rose-300 hover:text-rose-100"
          >
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)_300px]">
        {/* ---------- LEFT: parameters ---------- */}
        {/* Hidden by default under xl. On small screens users tap the floating
            "☰ Params" button to open it as a bottom sheet. */}
        <div
          className={cn(
            "space-y-4",
            "fixed inset-x-0 bottom-0 z-40 max-h-[75vh] overflow-y-auto border-t border-white/10 bg-ink-950/95 p-4 backdrop-blur-xl transition-transform duration-300 xl:static xl:z-auto xl:max-h-none xl:overflow-visible xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none xl:transition-none",
            paramDrawerOpen ? "translate-y-0" : "translate-y-full xl:translate-y-0",
          )}
        >
          <div className="mb-2 flex items-center justify-between xl:hidden">
            <span className="font-mono text-[11px] tracking-[0.16em] text-slate-400 uppercase">
              Parameters
            </span>
            <button
              type="button"
              onClick={() => setParamDrawerOpen(false)}
              aria-label="Close parameters"
              className="rounded-md border border-white/12 px-2 py-1 text-[11px] text-slate-300"
            >
              ✕
            </button>
          </div>
          <Panel title="Presets" dense>
            <div className="grid gap-1.5">
              {Object.entries(PRESETS).map(([k, p]) => (
                <button
                  key={k}
                  onClick={() => applyPreset(k)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    preset === k
                      ? "border-cyan-400/40 bg-cyan-400/[0.07]"
                      : "border-white/[0.07] hover:border-white/20 hover:bg-white/[0.04]",
                  )}
                >
                  <div
                    className={cn(
                      "text-[12px] font-semibold",
                      preset === k ? "text-cyan-300" : "text-slate-200",
                    )}
                  >
                    {p.label}
                  </div>
                  <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{p.blurb}</div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Colony">
            <div className="space-y-4">
              <Slider
                label="Robots"
                value={params.robots}
                min={20}
                max={900}
                step={10}
                onChange={P("robots")}
              />
              <Slider
                label="Speed"
                value={params.speed}
                min={0.3}
                max={2}
                step={0.05}
                onChange={P("speed")}
                unit=" cells/t"
                fmt={(v) => v.toFixed(2)}
              />
              <Slider
                label="Food clusters"
                value={params.foodClusters}
                min={1}
                max={9}
                onChange={(v) => {
                  setParams((p) => ({ ...p, foodClusters: v }));
                  engine.setParams({ foodClusters: v });
                  engine.reset(Math.floor(Math.random() * 99999));
                }}
              />
            </div>
          </Panel>

          <Panel title="Field physics">
            <div className="space-y-4">
              <Slider
                label="Evaporation λ"
                value={params.evaporation}
                min={0.001}
                max={0.05}
                step={0.001}
                onChange={P("evaporation")}
                fmt={(v) => v.toFixed(3)}
                hint="Higher = shorter memory, faster adaptation to change."
              />
              <Slider
                label="Diffusion D"
                value={params.diffusion}
                min={0}
                max={0.6}
                step={0.01}
                onChange={P("diffusion")}
                fmt={(v) => v.toFixed(2)}
                hint="Spreads gradients so they can be sensed further away."
              />
              <Slider
                label="Deposit δ"
                value={params.deposit}
                min={4}
                max={80}
                onChange={P("deposit")}
                hint="Trace strength written per agent per tick."
              />
            </div>
          </Panel>

          <Panel title="Agent policy">
            <div className="space-y-4">
              <Slider
                label="Sensor angle σ"
                value={params.sensorAngle}
                min={8}
                max={80}
                onChange={P("sensorAngle")}
                unit="°"
              />
              <Slider
                label="Sensor distance"
                value={params.sensorDist}
                min={2}
                max={16}
                onChange={P("sensorDist")}
                unit=" cells"
              />
              <Slider
                label="Turn rate"
                value={params.turnRate}
                min={0.05}
                max={1.4}
                step={0.05}
                onChange={P("turnRate")}
                fmt={(v) => v.toFixed(2)}
                unit=" rad"
              />
              <Slider
                label="Wander w"
                value={params.wander}
                min={0}
                max={1}
                step={0.01}
                onChange={P("wander")}
                fmt={(v) => v.toFixed(2)}
                hint="Stochastic exploration pressure."
              />
            </div>
          </Panel>

          <Panel title="Radio budget">
            <div className="space-y-4">
              <Slider
                label="Quantisation"
                value={params.quantBits}
                min={1}
                max={8}
                onChange={P("quantBits")}
                unit=" bits/cell"
              />
              <Slider
                label="Broadcast rate"
                value={params.msgHz}
                min={1}
                max={20}
                onChange={P("msgHz")}
                unit=" Hz"
              />
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-slate-500">uplink</span>
                  <span className="text-cyan-300">{stats.bandwidthKbps.toFixed(1)} kbps</span>
                </div>
                <div className="mt-1 flex justify-between font-mono text-[11px]">
                  <span className="text-slate-500">float32 baseline</span>
                  <span className="text-rose-300">{stats.naiveKbps.toFixed(0)} kbps</span>
                </div>
                <div className="mt-1 flex justify-between font-mono text-[11px]">
                  <span className="text-slate-500">compression</span>
                  <span className="text-emerald-300">{stats.compression.toFixed(1)}×</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* ---------- CENTER: canvas ---------- */}
        <div className="space-y-4">
          <Panel dense className="overflow-hidden">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Btn variant={running ? "soft" : "primary"} onClick={() => setRunning((r) => !r)}>
                {running ? "❚❚ Pause" : "▶ Play"}
              </Btn>
              <Btn
                onClick={() => {
                  for (let i = 0; i < 10; i++) engine.step();
                  setStats({ ...engine.stats });
                }}
              >
                ⏭ Step ×10
              </Btn>
              <Btn onClick={reset}>↻ Reset</Btn>
              <div className="ml-1 flex items-center gap-1 rounded-md border border-white/10 p-0.5">
                {[1, 2, 4, 8].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTurbo(s)}
                    className={cn(
                      "rounded px-2 py-1 font-mono text-[11px] transition",
                      turbo === s
                        ? "bg-cyan-400/20 text-cyan-300"
                        : "text-slate-500 hover:text-slate-200",
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2" data-tour="record">
                <Btn variant={recording ? "danger" : "ghost"} onClick={toggleRecord}>
                  {recording ? `● REC ${recFrames}` : "● Record"}
                </Btn>
                <Btn onClick={exportPng}>⤓ PNG</Btn>
                <Btn onClick={exportJson}>⤓ JSON</Btn>
              </div>
            </div>

            <div
              data-tour="sim-canvas"
              className="relative overflow-hidden rounded-lg border border-white/[0.09] bg-ink-950"
            >
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Live pheromone-field simulation. ${stats.collected} units delivered, ${stats.carrying} agents currently carrying, ${(stats.coverage * 100).toFixed(1)}% map coverage.`}
                className={cn(
                  "block w-full",
                  brush !== "none" ? "cursor-crosshair" : "cursor-default",
                )}
                style={{
                  aspectRatio: `${GW} / ${GH}`,
                  touchAction: brush === "none" ? "auto" : "none",
                }}
                onMouseDown={paint}
                onMouseMove={paint}
                onTouchStart={touchPaint}
                onTouchMove={touchPaint}
              />
              <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                <LegendPill color="#22d3ee" label="Φ_food · recruitment trail" />
                <LegendPill color="#f59e0b" label="Φ_home · return trail" />
                <LegendPill color="#86ffbe" label="loaded carrier" />
                <LegendPill color="#a78bfa" label="nest" />
              </div>
              <div className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-md border border-white/10 bg-ink-950/80 px-2.5 py-1.5 font-mono text-[10px] text-slate-400 backdrop-blur">
                Σ delivered <span className="text-cyan-300">{stats.collected}</span> · carrying{" "}
                <span className="text-emerald-300">{stats.carrying}</span> · food left{" "}
                <span className="text-amber-300">{(stats.foodRemaining * 100).toFixed(0)}%</span>
              </div>
            </div>

            <div
              data-tour="brush"
              className="mt-3 flex flex-wrap items-center gap-2"
              role="radiogroup"
              aria-label="Painting brush"
            >
              <span className="font-mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">
                brush
              </span>
              {(
                [
                  ["none", "Off", "slate"],
                  ["food", "🍃 Food", "emerald"],
                  ["wall", "▦ Wall", "violet"],
                  ["erase", "◌ Erase", "amber"],
                ] as [Brush, string, string][]
              ).map(([b, label]) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={brush === b}
                  aria-label={`Brush: ${label}`}
                  onClick={() => setBrush(b)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] transition focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:outline-none",
                    brush === b
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                      : "border-white/10 text-slate-400 hover:bg-white/[0.05]",
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto text-[10.5px] text-slate-600">
                drag on the field to paint · trails reroute within ~200 ticks
              </span>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Throughput & load">
              <LineChart
                height={140}
                series={[
                  { name: "delivered", color: "#22d3ee", data: hist.map((h) => h.collected) },
                  { name: "carrying", color: "#34d399", data: hist.map((h) => h.carrying) },
                ]}
              />
            </Panel>
            <Panel title="Trail mass & coverage">
              <LineChart
                height={140}
                series={[
                  { name: "trail mass", color: "#f59e0b", data: hist.map((h) => h.trailMass) },
                  { name: "coverage %", color: "#a78bfa", data: hist.map((h) => h.coverage * 100) },
                ]}
              />
            </Panel>
          </div>
        </div>

        {/* ---------- RIGHT: telemetry ---------- */}
        <div className="space-y-4">
          <Panel title="Telemetry">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="delivered" value={stats.collected} accent="cyan" />
              <Stat label="round trips" value={stats.trips} accent="slate" />
              <Stat label="avg trip" value={formatNum(stats.avgTrip)} unit="t" accent="violet" />
              <Stat
                label="coverage"
                value={(stats.coverage * 100).toFixed(1)}
                unit="%"
                accent="emerald"
              />
              <Stat label="trail mass" value={formatNum(stats.trailMass)} accent="amber" />
              <Stat
                label="uplink"
                value={stats.bandwidthKbps.toFixed(1)}
                unit="kbps"
                accent="cyan"
              />
            </div>
            <div className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
              <div className="mb-1.5 flex justify-between font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                <span>resource depletion</span>
                <span className="text-amber-300">
                  {((1 - stats.foodRemaining) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all"
                  style={{ width: `${(1 - stats.foodRemaining) * 100}%` }}
                />
              </div>
            </div>
          </Panel>

          <Panel title="Field layers">
            <div className="space-y-1">
              <Toggle
                label="Φ_food heatmap"
                checked={view.showFood}
                onChange={(v) => setView({ ...view, showFood: v })}
              />
              <Toggle
                label="Φ_home heatmap"
                checked={view.showHome}
                onChange={(v) => setView({ ...view, showHome: v })}
                color="amber"
              />
              <Toggle
                label="Robots"
                checked={view.showRobots}
                onChange={(v) => setView({ ...view, showRobots: v })}
                color="violet"
              />
              <Toggle
                label="Resource sites"
                checked={view.showResource}
                onChange={(v) => setView({ ...view, showResource: v })}
                color="emerald"
              />
            </div>
            <div className="mt-3">
              <Slider
                label="Heatmap gain"
                value={view.gain}
                min={0.2}
                max={4}
                step={0.1}
                onChange={(v) => setView({ ...view, gain: v })}
                fmt={(v) => v.toFixed(1)}
                unit="×"
              />
            </div>
          </Panel>

          <Panel title="Interpretation">
            <ul className="space-y-2.5 text-[11.5px] leading-relaxed text-slate-400">
              <li>
                <span className="text-cyan-300">Cyan arteries</span> mean the colony has locked onto
                a resource. Their thickness ≈ traffic density.
              </li>
              <li>
                <span className="text-amber-300">Amber haze</span> is the return gradient. If it
                fills the arena, evaporation is too low and agents are getting lost in stale data.
              </li>
              <li>
                Raise <span className="text-white">wander</span> when the swarm over-commits to one
                depleted patch — you are trading exploitation for exploration.
              </li>
              <li>
                Trail mass falling while delivered keeps climbing is the signature of an{" "}
                <span className="text-white">optimised, minimal-length path</span>.
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      {/* Mobile-only floating drawer trigger. Hidden ≥ xl where the params
          panel is a proper sidebar. */}
      <button
        type="button"
        onClick={() => setParamDrawerOpen((o) => !o)}
        aria-label={paramDrawerOpen ? "Close parameters" : "Open parameters"}
        aria-expanded={paramDrawerOpen}
        className="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full border border-cyan-400/40 bg-ink-950/95 px-4 py-2.5 text-[12px] font-semibold text-cyan-300 shadow-[0_0_24px_-6px_rgba(34,211,238,0.7)] backdrop-blur xl:hidden"
      >
        {paramDrawerOpen ? "✕ Close" : "☰ Params"}
      </button>
    </div>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-white/10 bg-ink-950/70 px-2 py-1 font-mono text-[9.5px] tracking-wider text-slate-300 uppercase backdrop-blur">
      <i
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {label}
    </span>
  );
}
