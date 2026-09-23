import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PRESETS, SwarmEngine, type Frame, type Params, type Recording } from "../sim/engine";
import { DEFAULT_VIEW, renderFrame, type ViewOpts } from "../sim/render";
import { addRecording, newId, removeRecording, useRecordings } from "../sim/store";
import { Btn, Chip, LineChart, Panel, Slider, Stat, Toggle, formatNum } from "../components/ui";
import { cn } from "../utils/cn";
import { downloadJSON } from "../utils/download";

const DEMOS: { name: string; patch: Partial<Params>; ticks: number }[] = [
  { name: "Demo · Balanced Forage", patch: PRESETS.balanced.patch, ticks: 1600 },
  { name: "Demo · Trail Highway", patch: PRESETS.highway.patch, ticks: 1600 },
  { name: "Demo · Scout Storm", patch: PRESETS.scout.patch, ticks: 1400 },
];

/** Runs a headless sim in animation-frame chunks so the UI stays responsive. */
function generate(
  name: string,
  patch: Partial<Params>,
  ticks: number,
  onProgress: (p: number) => void,
  aliveRef: React.MutableRefObject<boolean>,
): Promise<Recording | null> {
  return new Promise((resolve) => {
    const engine = new SwarmEngine(patch, 900 + Math.floor(Math.random() * 500));
    const frames: Frame[] = [];
    let t = 0;
    const chunk = () => {
      if (!aliveRef.current) {
        resolve(null);
        return;
      }
      for (let i = 0; i < 50 && t < ticks; i++, t++) {
        engine.step();
        if (t % 6 === 0) frames.push(engine.snapshot());
      }
      onProgress(t / ticks);
      if (t < ticks) requestAnimationFrame(chunk);
      else
        resolve({
          id: newId(),
          name,
          createdAt: Date.now(),
          params: engine.params,
          frames,
          foodSites: engine.foodSites.map((f) => ({ ...f })),
          nest: { ...engine.nest },
          history: [...engine.history],
        });
    };
    requestAnimationFrame(chunk);
  });
}

export default function Replay() {
  const recordings = useRecordings();
  const [sp, setSp] = useSearchParams();
  const [genProgress, setGenProgress] = useState<{ name: string; p: number } | null>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [loop, setLoop] = useState(true);
  const [view, setView] = useState<ViewOpts>({ ...DEFAULT_VIEW, showResource: false });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bootRef = useRef(false);
  const genAliveRef = useRef(true);

  const selectedId = sp.get("id");
  const rec = recordings.find((r) => r.id === selectedId) ?? recordings[0];

  const select = (id: string) => {
    setSp({ id });
    setIdx(0);
    setPlaying(true);
  };

  const makeDemos = useCallback(async () => {
    for (const d of DEMOS) {
      if (!genAliveRef.current) break;
      setGenProgress({ name: d.name, p: 0 });
      const r = await generate(
        d.name,
        d.patch,
        d.ticks,
        (p) => setGenProgress({ name: d.name, p }),
        genAliveRef,
      );
      if (r) addRecording(r);
    }
    setGenProgress(null);
  }, []);

  useEffect(() => {
    genAliveRef.current = true;
    if (bootRef.current) return;
    bootRef.current = true;
    if (recordings.length === 0) void makeDemos();
    return () => {
      genAliveRef.current = false;
    };
  }, [recordings.length, makeDemos]);

  // playback loop
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const stateRef = useRef({ playing, rate, loop, rec, view });
  stateRef.current = { playing, rate, loop, rec, view };

  useEffect(() => {
    let raf = 0;
    let alive = true;
    let acc = 0;
    let last = performance.now();
    const loopFn = (t: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loopFn);
      const dt = t - last;
      last = t;
      const s = stateRef.current;
      if (!s.rec?.frames.length) return;
      if (s.playing && !document.hidden) {
        acc += dt * s.rate;
        const frameMs = 1000 / 30;
        while (acc >= frameMs) {
          acc -= frameMs;
          let n = idxRef.current + 1;
          if (n >= s.rec.frames.length) {
            if (s.loop) n = 0;
            else {
              n = s.rec.frames.length - 1;
              setPlaying(false);
            }
          }
          idxRef.current = n;
        }
        setIdx(idxRef.current);
      }
      const frame = s.rec.frames[Math.min(idxRef.current, s.rec.frames.length - 1)];
      if (canvasRef.current && frame) renderFrame(canvasRef.current, frame, s.rec.nest, s.view);
    };
    raf = requestAnimationFrame(loopFn);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  const frame = rec?.frames[Math.min(idx, (rec?.frames.length ?? 1) - 1)];
  const hist = rec?.history ?? [];

  const exportRec = () => {
    if (!rec) return;
    downloadJSON(`${rec.name.replace(/\W+/g, "-").toLowerCase()}.json`, {
      name: rec.name,
      createdAt: rec.createdAt,
      params: rec.params,
      frames: rec.frames.length,
      history: rec.history,
      finalStats: rec.frames[rec.frames.length - 1]?.stats,
    });
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-violet-400/80 uppercase">
            module 03 · post-hoc analysis
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Replay Viewer
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-slate-400">
            Scrub through recorded runs frame by frame. Every capture stores quantised agent poses
            plus a down-sampled 100 × 63 snapshot of both pheromone fields.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Chip color="violet">{recordings.length} recordings</Chip>
          {rec && <Chip color="cyan">{rec.frames.length} frames</Chip>}
          <Btn onClick={exportRec} disabled={!rec}>
            ⤓ Export
          </Btn>
        </div>
      </div>

      {genProgress && (
        <div className="mb-4 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.06] px-4 py-3">
          <div className="flex items-center justify-between font-mono text-[11px] text-cyan-200">
            <span>synthesising {genProgress.name}…</span>
            <span>{(genProgress.p * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-cyan-400 transition-all" style={{ width: `${genProgress.p * 100}%` }} />
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_280px]">
        {/* library */}
        <Panel title="Library" dense className="self-start">
          <div className="space-y-1.5">
            {recordings.length === 0 && !genProgress && (
              <div className="px-2 py-6 text-center">
                <p className="text-[11.5px] text-slate-500">No recordings yet.</p>
                <Btn variant="primary" className="mt-3" onClick={makeDemos}>
                  Synthesise demo runs
                </Btn>
              </div>
            )}
            {recordings.map((r) => (
              <button
                key={r.id}
                onClick={() => select(r.id)}
                className={cn(
                  "group w-full rounded-lg border px-3 py-2 text-left transition",
                  rec?.id === r.id
                    ? "border-violet-400/40 bg-violet-400/[0.08]"
                    : "border-white/[0.07] hover:bg-white/[0.04]",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-[12px] font-medium text-slate-200">{r.name}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecording(r.id);
                    }}
                    className="text-slate-600 opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                  >
                    ✕
                  </span>
                </div>
                <div className="mt-1 font-mono text-[9.5px] text-slate-500">
                  {r.frames.length} frames · {r.params.robots} bots ·{" "}
                  {new Date(r.createdAt).toLocaleTimeString()}
                </div>
              </button>
            ))}
            {recordings.length > 0 && (
              <Btn className="mt-2 w-full" onClick={makeDemos} disabled={!!genProgress}>
                + Synthesise more
              </Btn>
            )}
          </div>
        </Panel>

        {/* player */}
        <div className="space-y-4">
          <Panel dense>
            <div className="relative overflow-hidden rounded-lg border border-white/[0.09] bg-ink-950">
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={
                  rec
                    ? `Playback of ${rec.name}, frame ${idx + 1} of ${rec.frames.length}.`
                    : "No recording loaded."
                }
                className="block w-full"
                style={{ aspectRatio: "200 / 126" }}
              />
              {!rec && (
                <div className="absolute inset-0 flex items-center justify-center text-[12px] text-slate-600">
                  {genProgress ? "rendering timeline…" : "no recording loaded"}
                </div>
              )}
              <div className="pointer-events-none absolute top-2.5 left-2.5 rounded-md border border-white/10 bg-ink-950/75 px-2.5 py-1.5 font-mono text-[10px] text-slate-300 backdrop-blur">
                {rec?.name ?? "—"} · frame {idx + 1}/{rec?.frames.length ?? 0} · t=
                {frame?.t ?? 0}
              </div>
              <div className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-md border border-white/10 bg-ink-950/75 px-2.5 py-1.5 font-mono text-[10px] text-slate-400 backdrop-blur">
                Σ {frame?.stats.collected ?? 0} delivered · {(frame?.stats.coverage ?? 0) * 100 > 0 ? ((frame?.stats.coverage ?? 0) * 100).toFixed(1) : "0.0"}% coverage
              </div>
            </div>

            {/* transport */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Btn variant={playing ? "soft" : "primary"} onClick={() => setPlaying((p) => !p)} disabled={!rec}>
                {playing ? "❚❚ Pause" : "▶ Play"}
              </Btn>
              <Btn onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={!rec}>
                ◀ Prev
              </Btn>
              <Btn onClick={() => setIdx((i) => Math.min((rec?.frames.length ?? 1) - 1, i + 1))} disabled={!rec}>
                Next ▶
              </Btn>
              <Btn onClick={() => setIdx(0)} disabled={!rec}>
                ⏮ Start
              </Btn>
              <div className="ml-1 flex items-center gap-1 rounded-md border border-white/10 p-0.5">
                {[0.25, 0.5, 1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRate(s)}
                    className={cn(
                      "rounded px-2 py-1 font-mono text-[11px] transition",
                      rate === s ? "bg-violet-400/20 text-violet-200" : "text-slate-500 hover:text-slate-200",
                    )}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <button
                onClick={() => setLoop((l) => !l)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] transition",
                  loop ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-slate-400",
                )}
              >
                ↻ Loop
              </button>
            </div>

            <input
              type="range"
              className="mt-3 w-full"
              aria-label="Playback timeline"
              min={0}
              max={Math.max(0, (rec?.frames.length ?? 1) - 1)}
              value={idx}
              onChange={(e) => {
                setIdx(parseInt(e.target.value));
                idxRef.current = parseInt(e.target.value);
              }}
            />
            <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-600">
              <span>00:00</span>
              <span>
                {rec ? `${(((idx + 1) / rec.frames.length) * 100).toFixed(0)}%` : "—"}
              </span>
              <span>{rec ? `${rec.frames[rec.frames.length - 1].t} ticks` : "—"}</span>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Recorded yield">
              <LineChart
                height={150}
                series={[
                  { name: "delivered", color: "#22d3ee", data: hist.map((h) => h.collected) },
                  { name: "carrying", color: "#34d399", data: hist.map((h) => h.carrying) },
                ]}
              />
            </Panel>
            <Panel title="Trail dynamics">
              <LineChart
                height={150}
                series={[
                  { name: "trail mass", color: "#f59e0b", data: hist.map((h) => h.trailMass) },
                  { name: "coverage %", color: "#a78bfa", data: hist.map((h) => h.coverage * 100) },
                ]}
              />
            </Panel>
          </div>
        </div>

        {/* inspector */}
        <div className="space-y-4">
          <Panel title="Frame inspector">
            {frame ? (
              <div className="grid grid-cols-2 gap-2">
                <Stat label="tick" value={frame.t} accent="slate" />
                <Stat label="delivered" value={frame.stats.collected} accent="cyan" />
                <Stat label="carrying" value={frame.stats.carrying} accent="emerald" />
                <Stat label="avg trip" value={formatNum(frame.stats.avgTrip)} unit="t" accent="violet" />
                <Stat label="trail mass" value={formatNum(frame.stats.trailMass)} accent="amber" />
                <Stat label="uplink" value={frame.stats.bandwidthKbps.toFixed(1)} unit="kbps" accent="cyan" />
              </div>
            ) : (
              <p className="text-[12px] text-slate-600">No frame.</p>
            )}
          </Panel>

          <Panel title="Layers">
            <div className="space-y-1">
              <Toggle label="Φ_food" checked={view.showFood} onChange={(v) => setView({ ...view, showFood: v })} />
              <Toggle label="Φ_home" checked={view.showHome} onChange={(v) => setView({ ...view, showHome: v })} color="amber" />
              <Toggle label="Agents" checked={view.showRobots} onChange={(v) => setView({ ...view, showRobots: v })} color="violet" />
            </div>
            <div className="mt-3">
              <Slider
                label="Gain"
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

          <Panel title="Capture format">
            <div className="space-y-1.5 font-mono text-[10.5px] text-slate-400">
              <Row k="agent pose" v="2 × uint8 + flag" />
              <Row k="field snapshot" v="100 × 63 × uint8" />
              <Row k="cadence" v="every 6 ticks" />
              <Row k="frame size" v="≈ 7.9 kB" />
              <Row k="codec" v="raw (lossy quantised)" />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Recordings live in memory for this session. Capture new ones from the simulator's{" "}
              <span className="text-cyan-300">● Record</span> button or push completed batch tasks
              here from the dashboard.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-white/[0.05] pb-1">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-300">{v}</span>
    </div>
  );
}
