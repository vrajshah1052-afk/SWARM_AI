import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_PARAMS,
  PRESETS,
  SwarmEngine,
  type Frame,
  type HistoryPoint,
  type Params,
  type Stats,
} from "../sim/engine";
import { renderIso } from "../sim/render";
import { addRecording, newId } from "../sim/store";
import { BarRow, Btn, Chip, LineChart, Panel, Slider, Stat, formatNum } from "../components/ui";
import { cn } from "../utils/cn";
import { downloadBlob } from "../utils/download";
import { useNavigate } from "react-router-dom";

const COLORS = ["#22d3ee", "#f59e0b", "#a78bfa", "#34d399", "#f472b6", "#60a5fa", "#fb923c"];

interface Task {
  id: string;
  name: string;
  params: Params;
  ticks: number;
  seed: number;
  color: string;
  status: "queued" | "running" | "done";
  progress: number;
  result?: {
    stats: Stats;
    history: HistoryPoint[];
    frame: Frame;
    frames: Frame[];
    foodSites: { x: number; y: number; r: number }[];
    nest: { x: number; y: number };
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const tasksRef = useRef<Task[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const busy = useRef(false);
  const rafRef = useRef(0);
  const aliveRef = useRef(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    robots: 300,
    evaporation: 0.008,
    deposit: 34,
    quantBits: 4,
    msgHz: 6,
    wander: 0.25,
    ticks: 1200,
  });
  const [autoRotate, setAutoRotate] = useState(true);
  const bootRef = useRef(false);

  const sync = useCallback(() => setTasks([...tasksRef.current]), []);

  const runNext = useCallback(() => {
    if (busy.current) return;
    const next = tasksRef.current.find((t) => t.status === "queued");
    if (!next) return;
    busy.current = true;
    next.status = "running";
    sync();
    const engine = new SwarmEngine(next.params, next.seed);
    const frames: Frame[] = [];
    let done = 0;
    const chunk = () => {
      if (!aliveRef.current) return;
      const N = 45;
      for (let i = 0; i < N && done < next.ticks; i++, done++) {
        engine.step();
        if (done % 8 === 0 && frames.length < 260) frames.push(engine.snapshot());
      }
      next.progress = done / next.ticks;
      if (done < next.ticks) {
        sync();
        rafRef.current = requestAnimationFrame(chunk);
      } else {
        const final = engine.snapshot();
        next.status = "done";
        next.progress = 1;
        next.result = {
          stats: { ...engine.stats },
          history: [...engine.history],
          frame: final,
          frames: frames.length ? frames : [final],
          foodSites: engine.foodSites.map((f) => ({ ...f })),
          nest: { ...engine.nest },
        };
        busy.current = false;
        setSelected((s) => s ?? next.id);
        sync();
        runNext();
      }
    };
    rafRef.current = requestAnimationFrame(chunk);
  }, [sync]);

  const enqueue = useCallback(
    (name: string, patch: Partial<Params>, ticks: number) => {
      const t: Task = {
        id: newId(),
        name,
        params: { ...DEFAULT_PARAMS, ...patch },
        ticks,
        seed: 100 + Math.floor(Math.random() * 5000),
        color: COLORS[tasksRef.current.length % COLORS.length],
        status: "queued",
        progress: 0,
      };
      tasksRef.current.push(t);
      sync();
      runNext();
    },
    [runNext, sync],
  );

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    enqueue("Balanced Forage", PRESETS.balanced.patch, 1100);
    enqueue("Trail Highway", PRESETS.highway.patch, 1100);
    enqueue("Scout Storm", PRESETS.scout.patch, 1100);
    enqueue("Bandwidth Frugal", PRESETS.frugal.patch, 1100);
  }, [enqueue]);

  // Cancel any in-flight batch work when the page unmounts.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      cancelAnimationFrame(rafRef.current);
      busy.current = false;
    };
  }, []);

  const done = tasks.filter((t) => t.status === "done");
  const sel = tasks.find((t) => t.id === selected) ?? done[0];
  const runningTask = tasks.find((t) => t.status === "running");

  const maxDelivered = Math.max(1, ...done.map((t) => t.result!.stats.collected));
  const maxKbps = Math.max(1, ...done.map((t) => t.result!.stats.bandwidthKbps));

  const removeTask = (id: string) => {
    tasksRef.current = tasksRef.current.filter((t) => t.id !== id);
    sync();
  };

  const sendToReplay = (t: Task) => {
    if (!t.result) return;
    const rec = addRecording({
      id: newId(),
      name: `Batch · ${t.name}`,
      createdAt: Date.now(),
      params: t.params,
      frames: t.result.frames,
      foodSites: t.result.foodSites,
      nest: t.result.nest,
      history: t.result.history,
    });
    void navigate(`/replay?id=${rec.id}`);
  };

  const exportCsv = () => {
    const rows = [
      ["task", "robots", "evaporation", "deposit", "bits", "hz", "ticks", "delivered", "trips", "avg_trip", "coverage", "kbps", "compression"],
      ...done.map((t) => [
        t.name,
        t.params.robots,
        t.params.evaporation,
        t.params.deposit,
        t.params.quantBits,
        t.params.msgHz,
        t.ticks,
        t.result!.stats.collected,
        t.result!.stats.trips,
        t.result!.stats.avgTrip.toFixed(1),
        (t.result!.stats.coverage * 100).toFixed(2),
        t.result!.stats.bandwidthKbps.toFixed(2),
        t.result!.stats.compression.toFixed(2),
      ]),
    ];
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    downloadBlob("swarm-batch-results.csv", blob);
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.24em] text-amber-400/80 uppercase">
            module 02 · batch analytics
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Multi-Task Dashboard
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] text-slate-400">
            Queue swarm configurations, run them headless at maximum speed, then compare yield,
            coverage and radio cost side by side.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip color={runningTask ? "amber" : "emerald"}>
            {runningTask ? `running · ${(runningTask.progress * 100).toFixed(0)}%` : "queue idle"}
          </Chip>
          <Chip color="cyan">{done.length} completed</Chip>
          <Btn onClick={exportCsv} disabled={!done.length}>
            ⤓ CSV
          </Btn>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* ---------- LEFT: queue builder ---------- */}
        <div className="space-y-4">
          <Panel title="New task">
            <div className="space-y-4">
              <Slider label="Robots" value={draft.robots} min={40} max={900} step={10} onChange={(v) => setDraft({ ...draft, robots: v })} />
              <Slider
                label="Evaporation λ"
                value={draft.evaporation}
                min={0.001}
                max={0.04}
                step={0.001}
                onChange={(v) => setDraft({ ...draft, evaporation: v })}
                fmt={(v) => v.toFixed(3)}
              />
              <Slider label="Deposit δ" value={draft.deposit} min={5} max={80} onChange={(v) => setDraft({ ...draft, deposit: v })} />
              <Slider
                label="Wander w"
                value={draft.wander}
                min={0}
                max={0.8}
                step={0.01}
                onChange={(v) => setDraft({ ...draft, wander: v })}
                fmt={(v) => v.toFixed(2)}
              />
              <Slider label="Quantisation" value={draft.quantBits} min={1} max={8} onChange={(v) => setDraft({ ...draft, quantBits: v })} unit=" bits" />
              <Slider label="Broadcast" value={draft.msgHz} min={1} max={20} onChange={(v) => setDraft({ ...draft, msgHz: v })} unit=" Hz" />
              <Slider label="Duration" value={draft.ticks} min={300} max={3000} step={100} onChange={(v) => setDraft({ ...draft, ticks: v })} unit=" ticks" />
              <Btn
                variant="primary"
                className="w-full"
                onClick={() =>
                  enqueue(
                    `Custom ${tasksRef.current.length + 1} · ${draft.robots}r`,
                    {
                      robots: draft.robots,
                      evaporation: draft.evaporation,
                      deposit: draft.deposit,
                      quantBits: draft.quantBits,
                      msgHz: draft.msgHz,
                      wander: draft.wander,
                    },
                    draft.ticks,
                  )
                }
              >
                + Queue task
              </Btn>
            </div>
          </Panel>

          <Panel title="Quick sweeps" dense>
            <div className="grid gap-1.5">
              <Btn
                onClick={() => {
                  [80, 240, 480, 800].forEach((r) => enqueue(`Fleet size ${r}`, { robots: r }, 900));
                }}
              >
                Sweep fleet size (4 runs)
              </Btn>
              <Btn
                onClick={() => {
                  [0.002, 0.008, 0.02, 0.04].forEach((e) =>
                    enqueue(`λ = ${e}`, { evaporation: e }, 900),
                  );
                }}
              >
                Sweep evaporation (4 runs)
              </Btn>
              <Btn
                onClick={() => {
                  [1, 2, 4, 8].forEach((b) => enqueue(`${b}-bit radio`, { quantBits: b }, 900));
                }}
              >
                Sweep bit-budget (4 runs)
              </Btn>
              <Btn
                variant="danger"
                onClick={() => {
                  tasksRef.current = tasksRef.current.filter((t) => t.status === "running");
                  setSelected(null);
                  sync();
                }}
              >
                Clear queue
              </Btn>
            </div>
          </Panel>

          <Panel title={`Queue · ${tasks.length}`} dense>
            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {tasks.length === 0 && (
                <p className="px-2 py-6 text-center text-[11.5px] text-slate-600">No tasks queued.</p>
              )}
              {tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => t.status === "done" && setSelected(t.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition",
                    sel?.id === t.id
                      ? "border-cyan-400/40 bg-cyan-400/[0.07]"
                      : "border-white/[0.07] hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
                    <span className="flex-1 truncate text-[12px] font-medium text-slate-200">{t.name}</span>
                    <span
                      className={cn(
                        "font-mono text-[9.5px] tracking-wider uppercase",
                        t.status === "done"
                          ? "text-emerald-400"
                          : t.status === "running"
                            ? "text-amber-300"
                            : "text-slate-500",
                      )}
                    >
                      {t.status}
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTask(t.id);
                      }}
                      className="cursor-pointer text-slate-600 hover:text-rose-400"
                    >
                      ✕
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${t.progress * 100}%`, background: t.color }}
                    />
                  </div>
                  <div className="mt-1 font-mono text-[9.5px] text-slate-500">
                    {t.params.robots} bots · λ{t.params.evaporation} · {t.params.quantBits}b ·{" "}
                    {t.ticks}t
                    {t.result ? ` · ${t.result.stats.collected} delivered` : ""}
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* ---------- RIGHT: results ---------- */}
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Cumulative yield" right={<Chip color="cyan">units delivered</Chip>}>
              <LineChart
                height={190}
                fill={false}
                series={done.map((t) => ({
                  name: t.name,
                  color: t.color,
                  data: t.result!.history.map((h) => h.collected),
                }))}
              />
            </Panel>
            <Panel title="Radio load over run" right={<Chip color="amber">kbps</Chip>}>
              <LineChart
                height={190}
                fill={false}
                series={done.map((t) => ({
                  name: t.name,
                  color: t.color,
                  data: t.result!.history.map((h) => h.bandwidth),
                }))}
              />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <Panel title="Pseudo-3D pheromone relief" right={
              <button
                onClick={() => setAutoRotate((a) => !a)}
                className="font-mono text-[10px] tracking-wider text-slate-400 uppercase hover:text-cyan-300"
              >
                {autoRotate ? "◼ stop spin" : "▶ spin"}
              </button>
            }>
              {sel?.result ? (
                <IsoView frame={sel.result.frame} autoRotate={autoRotate} />
              ) : (
                <div className="flex h-[260px] items-center justify-center text-[12px] text-slate-600">
                  Waiting for the first task to finish…
                </div>
              )}
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500">
                <span>{sel ? sel.name : "—"}</span>
                <span>
                  <span className="text-cyan-300">■</span> Φ_food &nbsp;
                  <span className="text-amber-300">■</span> Φ_home
                </span>
              </div>
            </Panel>

            <Panel title="Selected run">
              {sel?.result ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="delivered" value={sel.result.stats.collected} accent="cyan" />
                    <Stat label="avg trip" value={formatNum(sel.result.stats.avgTrip)} unit="t" accent="violet" />
                    <Stat label="coverage" value={(sel.result.stats.coverage * 100).toFixed(1)} unit="%" accent="emerald" />
                    <Stat label="uplink" value={sel.result.stats.bandwidthKbps.toFixed(1)} unit="kbps" accent="amber" />
                    <Stat label="compression" value={sel.result.stats.compression.toFixed(1)} unit="×" accent="emerald" />
                    <Stat
                      label="units / bot / 1k ticks"
                      value={((sel.result.stats.collected / sel.params.robots / sel.ticks) * 1000).toFixed(2)}
                      accent="slate"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Btn variant="soft" className="flex-1" onClick={() => sendToReplay(sel)}>
                      📹 Send to replay
                    </Btn>
                    <Btn
                      className="flex-1"
                      onClick={() => enqueue(`${sel.name} (rerun)`, sel.params, sel.ticks)}
                    >
                      ↻ Re-run
                    </Btn>
                  </div>
                  <div className="mt-3 rounded-lg border border-white/[0.07] bg-ink-950/60 p-3 font-mono text-[10.5px] leading-relaxed text-slate-400">
                    <div className="text-slate-500">// configuration</div>
                    robots={sel.params.robots} λ={sel.params.evaporation} D={sel.params.diffusion} δ=
                    {sel.params.deposit} σ={sel.params.sensorAngle}° w={sel.params.wander} bits=
                    {sel.params.quantBits} hz={sel.params.msgHz}
                  </div>
                </>
              ) : (
                <div className="flex h-[240px] items-center justify-center text-[12px] text-slate-600">
                  Select a completed task.
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Yield ranking">
              <div className="space-y-2.5">
                {done.length === 0 && <p className="text-[12px] text-slate-600">No results yet.</p>}
                {[...done]
                  .sort((a, b) => b.result!.stats.collected - a.result!.stats.collected)
                  .map((t) => (
                    <BarRow
                      key={t.id}
                      label={t.name}
                      value={t.result!.stats.collected}
                      max={maxDelivered}
                      color={t.color}
                      display={String(t.result!.stats.collected)}
                    />
                  ))}
              </div>
            </Panel>
            <Panel title="Radio cost ranking">
              <div className="space-y-2.5">
                {done.length === 0 && <p className="text-[12px] text-slate-600">No results yet.</p>}
                {[...done]
                  .sort((a, b) => a.result!.stats.bandwidthKbps - b.result!.stats.bandwidthKbps)
                  .map((t) => (
                    <BarRow
                      key={t.id}
                      label={t.name}
                      value={t.result!.stats.bandwidthKbps}
                      max={maxKbps}
                      color={t.color}
                      display={t.result!.stats.bandwidthKbps.toFixed(1) + "k"}
                    />
                  ))}
              </div>
            </Panel>
          </div>

          <Panel title="Result matrix">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="font-mono text-[9.5px] tracking-[0.14em] text-slate-500 uppercase">
                    {["task", "bots", "λ", "δ", "bits", "delivered", "trips", "avg trip", "coverage", "kbps", "ratio"].map(
                      (h) => (
                        <th key={h} className="border-b border-white/[0.07] px-2 py-2 font-medium">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="font-mono text-[11px] text-slate-300">
                  {done.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className={cn(
                        "cursor-pointer transition hover:bg-white/[0.04]",
                        sel?.id === t.id && "bg-cyan-400/[0.06]",
                      )}
                    >
                      <td className="border-b border-white/[0.04] px-2 py-2">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: t.color }} />
                        <span className="text-slate-200">{t.name}</span>
                      </td>
                      <td className="border-b border-white/[0.04] px-2 py-2">{t.params.robots}</td>
                      <td className="border-b border-white/[0.04] px-2 py-2">{t.params.evaporation}</td>
                      <td className="border-b border-white/[0.04] px-2 py-2">{t.params.deposit}</td>
                      <td className="border-b border-white/[0.04] px-2 py-2">{t.params.quantBits}</td>
                      <td className="border-b border-white/[0.04] px-2 py-2 text-cyan-300">
                        {t.result!.stats.collected}
                      </td>
                      <td className="border-b border-white/[0.04] px-2 py-2">{t.result!.stats.trips}</td>
                      <td className="border-b border-white/[0.04] px-2 py-2">{t.result!.stats.avgTrip.toFixed(0)}</td>
                      <td className="border-b border-white/[0.04] px-2 py-2 text-emerald-300">
                        {(t.result!.stats.coverage * 100).toFixed(1)}%
                      </td>
                      <td className="border-b border-white/[0.04] px-2 py-2 text-amber-300">
                        {t.result!.stats.bandwidthKbps.toFixed(1)}
                      </td>
                      <td className="border-b border-white/[0.04] px-2 py-2 text-violet-300">
                        {t.result!.stats.compression.toFixed(1)}×
                      </td>
                    </tr>
                  ))}
                  {done.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-2 py-8 text-center text-slate-600">
                        Results will populate as tasks complete.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function IsoView({ frame, autoRotate }: { frame: Frame; autoRotate: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [rot, setRot] = useState(0.5);
  const [height, setHeight] = useState(58);
  const rotRef = useRef(rot);
  rotRef.current = rot;

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const loop = () => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (autoRotate) {
        rotRef.current += 0.004;
        setRot(rotRef.current);
      }
      if (ref.current) renderIso(ref.current, frame, rotRef.current, height);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [frame, autoRotate, height]);

  return (
    <div>
      <canvas ref={ref} className="block h-[260px] w-full rounded-lg border border-white/[0.07] bg-ink-950" />
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Slider label="Rotation" value={rot % (Math.PI * 2)} min={0} max={6.28} step={0.01} onChange={setRot} fmt={(v) => v.toFixed(2)} unit=" rad" />
        <Slider label="Relief height" value={height} min={10} max={130} onChange={setHeight} unit="px" />
      </div>
    </div>
  );
}
