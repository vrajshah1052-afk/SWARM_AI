import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import HeroSwarm from "../components/HeroSwarm";
import { Chip, BarRow } from "../components/ui";

const FEATURES = [
  {
    icon: "🎮",
    title: "Live Simulator",
    body: "Interactive real-time simulation. Adjust parameters, watch robots explore and forage, see pheromone trails emerge in beautiful heatmaps.",
    cta: "Try Now",
    to: "/simulator",
    accent: "from-cyan-400/20 to-cyan-400/0",
    ring: "group-hover:shadow-[0_0_0_1px_rgba(34,211,238,0.35)]",
  },
  {
    icon: "📊",
    title: "Multi-Task Dashboard",
    body: "Queue multiple swarm tasks with different parameters. Compare bandwidth usage, track performance metrics, visualize in pseudo-3D.",
    cta: "Open Dashboard",
    to: "/dashboard",
    accent: "from-amber-400/20 to-amber-400/0",
    ring: "group-hover:shadow-[0_0_0_1px_rgba(245,158,11,0.35)]",
  },
  {
    icon: "📹",
    title: "Replay Viewer",
    body: "Load recorded simulations and replay them with full control. Analyze behavior patterns, export data, study emergent trails.",
    cta: "View Replays",
    to: "/replay",
    accent: "from-violet-400/20 to-violet-400/0",
    ring: "group-hover:shadow-[0_0_0_1px_rgba(167,139,250,0.35)]",
  },
  {
    icon: "📚",
    title: "Documentation",
    body: "Learn about the algorithms, pheromone physics, robot behaviors, and bandwidth compression techniques. Full API reference included.",
    cta: "Read Docs",
    to: "/docs",
    accent: "from-emerald-400/20 to-emerald-400/0",
    ring: "group-hover:shadow-[0_0_0_1px_rgba(52,211,153,0.35)]",
  },
];

const MARQUEE = [
  "STIGMERGY",
  "Φ_food ⊕ Φ_home",
  "ANT COLONY OPTIMISATION",
  "DELTA-QUANTISED TELEMETRY",
  "EMERGENT TRAIL FORMATION",
  "DECENTRALISED CONTROL",
  "EVAPORATION λ",
  "DIFFUSION D∇²Φ",
  "SWARM ROBOTICS",
  "BANDWIDTH-AWARE GOSSIP",
];

const STEPS = [
  {
    n: "01",
    t: "Deposit",
    d: "Every robot writes a scalar trace into the shared lattice as it moves. Searchers lay Φ_home, loaded carriers lay Φ_food. Deposit strength decays with time-since-event, so stale information is intrinsically weaker.",
    color: "text-cyan-300",
  },
  {
    n: "02",
    t: "Diffuse & Evaporate",
    d: "The medium does the computation: D∇²Φ spreads gradients so they can be sensed from a distance, while λΦ erases them. Together they act as a distributed low-pass filter with a finite memory horizon.",
    color: "text-amber-300",
  },
  {
    n: "03",
    t: "Sense & Steer",
    d: "Three forward whiskers sample the field. The agent turns toward the strongest reading with a stochastic wander term. No maps, no planners, no leader — the shortest path wins by reinforcement.",
    color: "text-violet-300",
  },
];

const SCENARIOS = [
  {
    icon: "🛰️",
    t: "Planetary Regolith Survey",
    d: "Comms-denied exploration where a shared field beats a shared map.",
  },
  {
    icon: "🌊",
    t: "Underwater Mine Sweeps",
    d: "Acoustic links measured in bytes/second, not megabits.",
  },
  {
    icon: "🚁",
    t: "Post-Disaster Search",
    d: "Hundreds of micro-UAVs converging on survivor signals.",
  },
  {
    icon: "🏭",
    t: "Warehouse Fleet Routing",
    d: "Congestion-aware lanes that reroute themselves as load shifts.",
  },
  {
    icon: "🌾",
    t: "Precision Agriculture",
    d: "Persistent coverage maps grown by the fleet, not the cloud.",
  },
  {
    icon: "🔬",
    t: "Research & Teaching",
    d: "A reproducible sandbox with seeded RNG and exportable traces.",
  },
];

export default function Home() {
  const [live, setLive] = useState({ collected: 0, kbps: 0, coverage: 0, carrying: 0 });
  const onStats = useCallback((s: typeof live) => setLive(s), []);

  return (
    <div>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden border-b border-white/[0.07]">
        <div className="absolute inset-0">
          <HeroSwarm className="h-full w-full" opacity={0.5} onStats={onStats} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/85 via-ink-950/70 to-ink-950" />
        <div className="grid-bg absolute inset-0 opacity-60" />

        <div className="relative mx-auto max-w-[1600px] px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="max-w-3xl">
            <Chip color="cyan">● live stigmergic field · 200 × 126 lattice</Chip>
            <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              Digital Pheromone
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-200 to-violet-300 bg-clip-text text-transparent text-glow">
                Swarm Intelligence
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-300 sm:text-base">
              Hundreds of minimal robots. No map, no leader, no cloud. They coordinate by writing
              evaporating chemical-like traces into the world itself — and shortest paths, foraging
              highways and adaptive coverage fall out for free. Explore the field in real time,
              queue experiments, replay them frame by frame.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/simulator"
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-ink-950 shadow-[0_0_36px_-8px_rgba(34,211,238,0.9)] transition hover:bg-cyan-300"
              >
                Launch Simulator
                <span aria-hidden>→</span>
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.06]"
              >
                Queue an experiment
              </Link>
              <Link
                to="/docs"
                className="inline-flex items-center gap-2 px-2 py-2.5 font-mono text-[12px] text-slate-400 transition hover:text-cyan-300"
              >
                read the physics ↗
              </Link>
            </div>
          </div>

          {/* live telemetry strip */}
          <div className="mt-14 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-4">
            {[
              { k: "units delivered", v: live.collected.toLocaleString(), c: "text-cyan-300" },
              { k: "carrying now", v: live.carrying.toString(), c: "text-emerald-300" },
              { k: "radio load", v: live.kbps.toFixed(1) + " kbps", c: "text-amber-300" },
              {
                k: "map coverage",
                v: (live.coverage * 100).toFixed(1) + "%",
                c: "text-violet-300",
              },
            ].map((s) => (
              <div key={s.k} className="bg-ink-950/80 px-4 py-3.5 backdrop-blur">
                <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">
                  {s.k}
                </div>
                <div className={`mt-1 font-mono text-lg font-semibold tabular-nums ${s.c}`}>
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- MARQUEE ---------------- */}
      <div className="overflow-hidden border-b border-white/[0.07] bg-ink-900/50 py-2.5">
        <div className="flex w-max animate-marquee gap-8 whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span
              key={i}
              className="font-mono text-[11px] tracking-[0.2em] text-slate-600 uppercase"
            >
              {m} <span className="text-cyan-500/40">◦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- FEATURE CARDS ---------------- */}
      <section className="mx-auto max-w-[1600px] px-6 py-16 sm:py-20">
        <SectionHead
          eyebrow="the toolkit"
          title="Four instruments, one field"
          sub="Everything is driven by the same deterministic engine — so a trail you discover in the simulator behaves identically when queued in the dashboard or scrubbed in the replay viewer."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              to={f.to}
              className={`group glass relative flex flex-col overflow-hidden rounded-xl p-5 transition duration-300 hover:-translate-y-1 ${f.ring}`}
            >
              <div
                className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${f.accent} opacity-0 transition group-hover:opacity-100`}
              />
              <div className="relative text-3xl">{f.icon}</div>
              <h3 className="relative mt-4 text-base font-semibold text-white">{f.title}</h3>
              <p className="relative mt-2 flex-1 text-[12.5px] leading-relaxed text-slate-400">
                {f.body}
              </p>
              <span className="relative mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider text-cyan-300 uppercase">
                {f.cta}
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="border-y border-white/[0.07] bg-ink-900/40">
        <div className="mx-auto max-w-[1600px] px-6 py-16 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <SectionHead
                eyebrow="stigmergy loop"
                title="The environment is the message bus"
                sub="Classic multi-robot systems ship state to each other. Stigmergic systems ship state to the world and let physics do the routing."
                left
              />
              <div className="mt-8 space-y-5">
                {STEPS.map((s) => (
                  <div key={s.n} className="flex gap-4">
                    <div className={`font-mono text-xl font-semibold ${s.color} tabular-nums`}>
                      {s.n}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{s.t}</h4>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-6">
              <div className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                field update · per tick
              </div>
              <pre className="mt-4 overflow-x-auto rounded-lg border border-white/[0.07] bg-ink-950/80 p-4 font-mono text-[11.5px] leading-relaxed text-slate-300">
                {`Φ(x, t+1) = (1 − λ)·Φ(x, t)
            + D·[ ∇²Φ(x, t) ]
            + Σᵢ  δᵢ · e^(−ageᵢ / τ)

sense(a)  = Σ_{n ∈ N₃ₓ₃(x + r·û(a))} Φ(n) / 9
steer     = argmax_{a ∈ {−σ, 0, +σ}} sense(a)
            + 𝒰(−w, w)`}
              </pre>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["λ", "evaporation", "text-amber-300"],
                  ["D", "diffusion", "text-cyan-300"],
                  ["σ", "sensor angle", "text-violet-300"],
                  ["τ", "trace half-life", "text-emerald-300"],
                ].map(([sym, name, c]) => (
                  <div
                    key={sym}
                    className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2"
                  >
                    <div className={`font-mono text-lg ${c}`}>{sym}</div>
                    <div className="font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                      {name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- BANDWIDTH ---------------- */}
      <section className="mx-auto max-w-[1600px] px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                uplink per 300-robot fleet
              </span>
              <Chip color="emerald">17.9× smaller</Chip>
            </div>
            <div className="mt-6 space-y-3.5">
              <BarRow
                label="raw float32 map"
                value={1440}
                max={1440}
                color="#f43f5e"
                display="1440 kbps"
              />
              <BarRow
                label="int16 patches"
                value={720}
                max={1440}
                color="#f59e0b"
                display="720 kbps"
              />
              <BarRow label="4-bit + RLE" value={98} max={1440} color="#22d3ee" display="98 kbps" />
              <BarRow
                label="2-bit @ 2 Hz"
                value={26}
                max={1440}
                color="#34d399"
                display="26 kbps"
              />
            </div>
            <p className="mt-6 text-[12.5px] leading-relaxed text-slate-400">
              Pheromone fields are extraordinarily compressible: they are smooth, sparse and
              self-correcting. A lost packet is not a lost plan — the field simply re-converges on
              the next deposit. That tolerance is what lets us quantise aggressively down to two
              bits per cell.
            </p>
          </div>
          <div>
            <SectionHead
              eyebrow="bandwidth model"
              title="Coordination that fits in a whisper"
              sub="Each agent broadcasts a 5×5 delta patch of its local field, quantised and run-length collapsed, with a six-byte header. The dashboard measures the real cost of every configuration you queue."
              left
            />
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {[
                [
                  "Δ-patch encoding",
                  "Only cells that changed beyond the quantisation step are transmitted.",
                ],
                [
                  "Loss tolerant",
                  "No ACKs, no retries. The field is a CRDT-like eventually-consistent surface.",
                ],
                [
                  "Bit-budget aware",
                  "Pick 2–8 bits per cell and watch convergence quality trade off live.",
                ],
                [
                  "Gossip scaling",
                  "Cost grows linearly with fleet size, not quadratically with pairs.",
                ],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <h4 className="text-[13px] font-semibold text-white">{t}</h4>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- NUMBERS ---------------- */}
      <section className="border-y border-white/[0.07] bg-gradient-to-b from-ink-900/60 to-ink-950">
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-8 px-6 py-12 lg:grid-cols-4">
          {[
            ["25,200", "lattice cells simulated"],
            ["900", "max concurrent agents"],
            ["60 Hz", "deterministic step rate"],
            ["17.9×", "telemetry compression"],
          ].map(([v, k]) => (
            <div key={k} className="text-center">
              <div className="font-mono text-3xl font-semibold text-white sm:text-4xl">{v}</div>
              <div className="mt-1.5 font-mono text-[10px] tracking-[0.18em] text-slate-500 uppercase">
                {k}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- SCENARIOS ---------------- */}
      <section className="mx-auto max-w-[1600px] px-6 py-16 sm:py-20">
        <SectionHead
          eyebrow="where it matters"
          title="Built for comms-starved fleets"
          sub="Anywhere the radio budget is smaller than the coordination problem."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s) => (
            <div
              key={s.t}
              className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 transition hover:border-cyan-400/25 hover:bg-white/[0.04]"
            >
              <div className="text-2xl">{s.icon}</div>
              <h4 className="mt-3 text-sm font-semibold text-white">{s.t}</h4>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="relative overflow-hidden border-t border-white/[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.12),transparent_65%)]" />
        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Drop 900 robots into a field and press play.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-slate-400">
            Nothing to install. The whole engine — physics, agents, compression model and renderer —
            runs in this tab.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/simulator"
              className="rounded-lg bg-cyan-400 px-6 py-3 text-sm font-semibold text-ink-950 shadow-[0_0_40px_-8px_rgba(34,211,238,0.9)] transition hover:bg-cyan-300"
            >
              Open the Simulator
            </Link>
            <Link
              to="/replay"
              className="rounded-lg border border-white/15 px-6 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]"
            >
              Watch a recorded run
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  sub,
  left,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  left?: boolean;
}) {
  return (
    <div className={left ? "max-w-xl" : "mx-auto max-w-2xl text-center"}>
      <div className="font-mono text-[10px] tracking-[0.24em] text-cyan-400/80 uppercase">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h2>
      {sub && <p className="mt-3 text-[13.5px] leading-relaxed text-slate-400">{sub}</p>}
    </div>
  );
}
