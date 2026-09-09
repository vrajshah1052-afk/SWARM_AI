import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Chip, Panel } from "../components/ui";
import { cn } from "../utils/cn";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quick start" },
  { id: "physics", label: "Pheromone physics" },
  { id: "behaviours", label: "Robot behaviours" },
  { id: "bandwidth", label: "Bandwidth model" },
  { id: "parameters", label: "Parameter reference" },
  { id: "api", label: "API reference" },
  { id: "recording", label: "Recording format" },
  { id: "faq", label: "FAQ" },
];

const PARAMS: [string, string, string, string][] = [
  ["robots", "int", "20 – 900", "Fleet size. Cost scales linearly; trail competition emerges above ~500."],
  ["speed", "float", "0.3 – 2.0", "Cells travelled per tick. High speed under-samples the field and blurs trails."],
  ["evaporation", "float λ", "0.001 – 0.05", "Fraction of every cell's intensity removed per tick. Sets the memory horizon ≈ 1/λ ticks."],
  ["diffusion", "float D", "0 – 0.6", "Blend factor toward the 3×3 mean. Widens the sensing basin, softens gradients."],
  ["deposit", "float δ", "4 – 80", "Trace written per agent per tick, attenuated by e^(−age/τ) with τ = 340."],
  ["sensorAngle", "deg σ", "8 – 80", "Half-angle between the left/right whiskers and the heading."],
  ["sensorDist", "cells", "2 – 16", "Whisker reach. Long whiskers create smoother, wider highways."],
  ["turnRate", "rad", "0.05 – 1.4", "Maximum yaw applied when a side sensor wins."],
  ["wander", "float w", "0 – 1", "Uniform noise added to heading each tick — the exploration pressure."],
  ["foodClusters", "int", "1 – 9", "Number of radial resource deposits scattered 34–86 cells from the nest."],
  ["quantBits", "bits", "1 – 8", "Quantisation depth of a transmitted field patch."],
  ["msgHz", "Hz", "1 – 20", "Per-agent broadcast cadence used by the bandwidth estimator."],
];

export default function Docs() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="mb-6">
        <div className="font-mono text-[10px] tracking-[0.24em] text-emerald-400/80 uppercase">
          module 04 · reference
        </div>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Documentation</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-slate-400">
          The algorithms, physics and wire format behind the Digital Pheromone engine.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[210px_minmax(0,1fr)_220px]">
        {/* nav */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-0.5">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={cn(
                  "block rounded-md border-l-2 px-3 py-1.5 text-[12px] transition",
                  active === s.id
                    ? "border-cyan-400 bg-white/[0.05] text-cyan-300"
                    : "border-transparent text-slate-500 hover:text-slate-200",
                )}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* content */}
        <article className="min-w-0 space-y-12 pb-16">
          <Section id="overview" title="Overview">
            <P>
              <B>Digital Pheromone</B> is a browser-native research engine for stigmergic multi-robot
              coordination. Agents never exchange plans, maps or goals. They write scalar traces into
              a shared lattice and read the traces left by others — a mechanism biologists call{" "}
              <em>stigmergy</em>, first described in termite nest construction by Grassé in 1959.
            </P>
            <P>
              Two independent fields are maintained. <Code>Φ_home</Code> is deposited by searching
              agents and forms a gradient back to the nest. <Code>Φ_food</Code> is deposited by loaded
              carriers and recruits others to a resource. The interaction of deposition, diffusion and
              evaporation performs a distributed, anytime shortest-path computation — with no global
              state and no consensus protocol.
            </P>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["No planner", "Purely reactive 3-whisker controller, 40 lines of logic."],
                ["No map", "The environment is the memory. Robots are stateless apart from a carry flag."],
                ["No leader", "Removing 90% of the fleet degrades throughput, never correctness."],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <h4 className="text-[13px] font-semibold text-white">{t}</h4>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{d}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="quickstart" title="Quick start">
            <P>Everything runs client-side. Import the engine and step it in your own loop:</P>
            <Pre>{`import { SwarmEngine } from "./sim/engine";
import { renderEngine, DEFAULT_VIEW } from "./sim/render";

const engine = new SwarmEngine({ robots: 300, evaporation: 0.008 }, /* seed */ 7);

function frame() {
  engine.step();                                  // advance the field + agents
  renderEngine(canvas, engine, DEFAULT_VIEW);     // heatmap + agents
  requestAnimationFrame(frame);
}
frame();`}</Pre>
            <P>
              Or skip rendering entirely and batch a parameter sweep — that is exactly what the{" "}
              <Link to="/dashboard" className="text-cyan-300 hover:underline">
                dashboard
              </Link>{" "}
              does:
            </P>
            <Pre>{`import { runHeadless } from "./sim/engine";

for (const robots of [80, 240, 480, 800]) {
  const { engine } = runHeadless({ robots }, 900, 8);
  console.log(robots, engine.stats.collected, engine.stats.bandwidthKbps);
}`}</Pre>
          </Section>

          <Section id="physics" title="Pheromone physics">
            <P>Each field evolves under an explicit Euler integration of a reaction–diffusion equation:</P>
            <Pre>{`Φ(x, t+1) = (1 − λ)·Φ(x, t) + D·(K₃ₓ₃ ∗ Φ − Φ) + Σᵢ δᵢ·e^(−ageᵢ/τ)·1[xᵢ = x]`}</Pre>
            <ul className="ml-4 list-disc space-y-2 text-[13px] leading-relaxed text-slate-400 marker:text-cyan-500">
              <li>
                <B>Evaporation (λ)</B> gives the system a finite memory of ~1/λ ticks. At λ = 0.008
                that is 125 ticks — long enough to sustain a highway, short enough to abandon a
                depleted patch.
              </li>
              <li>
                <B>Diffusion (D)</B> is implemented as a separable 3-tap box blur blended by D. It
                widens the attraction basin so a robot can detect a trail it never physically crossed.
              </li>
              <li>
                <B>Deposition (δ)</B> is attenuated by time since the agent's last certainty event
                (leaving the nest or picking up food). Long, meandering paths therefore write weaker
                traces than short ones — the core of the shortest-path bias.
              </li>
            </ul>
            <Callout tone="cyan" title="Why trails shorten over time">
              Two agents leaving a resource simultaneously reach the nest at different times. The one
              that took the shorter route reinforces its path sooner and with less age attenuation, so
              the shorter branch accrues intensity faster. Evaporation removes the loser. Convergence
              is positive feedback plus forgetting — nothing else.
            </Callout>
          </Section>

          <Section id="behaviours" title="Robot behaviours">
            <P>
              Every agent is a finite-state machine with exactly two states and no memory of the world
              beyond its own heading.
            </P>
            <div className="grid gap-3 sm:grid-cols-2">
              <StateCard
                title="SEARCH"
                color="text-cyan-300"
                lines={[
                  "target field ← Φ_food",
                  "deposit 0.85·δ into Φ_home",
                  "on resource cell → take 1 unit, reverse, age ← 0",
                ]}
              />
              <StateCard
                title="RETURN"
                color="text-emerald-300"
                lines={[
                  "target field ← Φ_home",
                  "deposit δ into Φ_food",
                  "9% per-tick heading bias toward nest",
                  "within 4.5 cells of nest → drop, reverse, age ← 0",
                ]}
              />
            </div>
            <P>The steering kernel evaluated every tick:</P>
            <Pre>{`const F = sense(target, pos + r·û(a));
const L = sense(target, pos + r·û(a − σ));
const R = sense(target, pos + r·û(a + σ));

if      (F >= L && F >= R) { /* hold heading */ }
else if (L > R)            a -= turnRate · 𝒰(0.4, 1.0);
else if (R > L)            a += turnRate · 𝒰(0.4, 1.0);
else                       a += 𝒰(−turnRate, turnRate);

a += 𝒰(−w, w);                       // wander
pos = clamp(pos + speed · û(a));      // walls reflect or slide`}</Pre>
            <P>
              Obstacles are handled by returning −6 for any whisker inside a wall, which makes solid
              geometry strongly repulsive without a dedicated avoidance controller. If all three
              directions are blocked the agent scatters by a random half-turn.
            </P>
          </Section>

          <Section id="bandwidth" title="Bandwidth model">
            <P>
              Real swarms are bounded by radio, not compute. The engine estimates the uplink required
              to keep a shared field coherent across the fleet.
            </P>
            <Pre>{`patch        = 5 × 5 cells around the agent
rawBits      = 25 · quantBits
bytesPerMsg  = 6 (header) + rawBits/8 · 0.55 (run-length factor)
kbps         = robots · msgHz · bytesPerMsg · 8 / 1000

naiveBytes   = 6 + 25 · 4          // float32, uncompressed
compression  = naiveKbps / kbps`}</Pre>
            <div className="grid gap-3 sm:grid-cols-2">
              <Panel title="Why it compresses">
                <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-slate-400 marker:text-cyan-500">
                  <li>Fields are spatially smooth → neighbouring cells share high bits.</li>
                  <li>Most cells are zero → run-length encoding collapses them.</li>
                  <li>Only deltas beyond the quantisation step are worth sending.</li>
                  <li>Values are logarithmically perceived by the controller — precision is cheap to lose.</li>
                </ul>
              </Panel>
              <Panel title="Why loss is tolerable">
                <ul className="ml-4 list-disc space-y-1.5 text-[12px] text-slate-400 marker:text-amber-500">
                  <li>A dropped packet costs one deposit, not a plan.</li>
                  <li>Evaporation erases stale disagreement automatically.</li>
                  <li>The field is monotone-mergeable — max() is a valid conflict resolver.</li>
                  <li>No ACKs, no retries, no ordering guarantees required.</li>
                </ul>
              </Panel>
            </div>
            <Callout tone="amber" title="Practical floor">
              Below 2 bits per cell the gradient quantises into plateaus and whisker comparisons start
              tying, which the controller resolves as random turns. Yield collapses roughly 30–45%.
              Run the <Link to="/dashboard" className="underline">bit-budget sweep</Link> to see it.
            </Callout>
          </Section>

          <Section id="parameters" title="Parameter reference">
            <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
              <table className="w-full min-w-[680px] text-left">
                <thead className="bg-white/[0.03]">
                  <tr className="font-mono text-[9.5px] tracking-[0.14em] text-slate-500 uppercase">
                    <th className="px-3 py-2.5 font-medium">name</th>
                    <th className="px-3 py-2.5 font-medium">type</th>
                    <th className="px-3 py-2.5 font-medium">range</th>
                    <th className="px-3 py-2.5 font-medium">effect</th>
                  </tr>
                </thead>
                <tbody>
                  {PARAMS.map(([n, t, r, d]) => (
                    <tr key={n} className="border-t border-white/[0.05]">
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-cyan-300">{n}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{t}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-amber-300">{r}</td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-400">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="api" title="API reference">
            <ApiBlock
              sig="new SwarmEngine(params?: Partial<Params>, seed = 1337)"
              desc="Allocates the lattice, seeds a deterministic mulberry32 PRNG, scatters obstacles and resources, and spawns the fleet at the nest."
            />
            <ApiBlock sig="engine.step(): void" desc="Advances one tick: evaporate → diffuse → move & deposit → interact → accumulate statistics (every 6 ticks) and history (every 12)." />
            <ApiBlock sig="engine.setParams(p: Partial<Params>): void" desc="Hot-swaps parameters mid-run. Changing `robots` adds or removes agents without resetting the field." />
            <ApiBlock sig="engine.reset(seed?: number): void" desc="Clears both fields, regenerates obstacles and resources, and re-spawns the fleet. Pass a seed for reproducibility." />
            <ApiBlock sig="engine.snapshot(): Frame" desc="Returns a compact, structured-cloneable frame: ≤500 quantised agent poses plus 100 × 63 uint8 copies of both fields." />
            <ApiBlock sig="runHeadless(params, ticks, every, seed?)" desc="Runs a full experiment with no renderer attached and returns { engine, frames }." />
            <ApiBlock sig="renderEngine(canvas, engine, view)" desc="Paints an ImageData heatmap at lattice resolution, upscales it, then overlays the nest glow and agents." />
            <ApiBlock sig="renderIso(canvas, frame, rotate, height)" desc="Isometric bar-field projection of a captured frame — the dashboard's pseudo-3D relief view." />
            <div className="rounded-xl border border-white/[0.07] bg-ink-950/60 p-4">
              <div className="font-mono text-[10px] tracking-[0.16em] text-slate-500 uppercase">Stats object</div>
              <Pre small>{`{ tick, collected, trips, avgTrip, bandwidthKbps, naiveKbps,
  compression, coverage, trailMass, carrying, foodRemaining, efficiency }`}</Pre>
            </div>
          </Section>

          <Section id="recording" title="Recording format">
            <P>
              A <Code>Recording</Code> is a plain object — safe to postMessage, IndexedDB or JSON.
              Frames are captured every 6 ticks in the simulator and every 8 in batch mode.
            </P>
            <Pre>{`type Frame = {
  t: number;            // source tick
  rx: Uint8Array;       // agent x, quantised to 0..255 over the arena width
  ry: Uint8Array;       // agent y
  rc: Uint8Array;       // 1 = carrying a resource unit
  food: Uint8Array;     // 100 × 63 down-sample of Φ_food
  home: Uint8Array;     // 100 × 63 down-sample of Φ_home
  stats: Stats;
};

type Recording = {
  id, name, createdAt, params, frames, foodSites, nest, history
};`}</Pre>
            <P>
              At 500 agents and a 100 × 63 field a frame costs ≈ 7.9 kB, so a 260-frame capture is
              about 2 MB in memory. Recordings are session-scoped by design — export the JSON summary
              if you need to keep results.
            </P>
          </Section>

          <Section id="faq" title="FAQ">
            {[
              [
                "Is this a real robotics stack?",
                "It is a faithful simulation of the coordination layer. The physics, controller and bandwidth accounting mirror what you would deploy, but there is no hardware abstraction, localisation error or battery model — yet.",
              ],
              [
                "Is the simulation deterministic?",
                "Yes. Given the same seed and parameter set, every tick is reproducible. The dashboard assigns a random seed per task so re-runs explore variance; pass an explicit seed to lock it.",
              ],
              [
                "Why two fields instead of one?",
                "A single field cannot encode direction. Two counter-propagating gradients let an agent choose which way to walk along the same trail, which is precisely how real ant trails become bidirectional highways.",
              ],
              [
                "How large can the swarm get?",
                "The renderer comfortably handles 900 agents at 60 fps on a laptop. The field update dominates cost above ~1200 agents; a WebGL or WASM backend is the obvious next step.",
              ],
              [
                "Can I paint my own environment?",
                "Yes — the simulator has food, wall and erase brushes. Trails typically re-route around a new obstacle within roughly 200 ticks.",
              ],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-slate-100 marker:hidden">
                  <span className="mr-2 text-cyan-400 transition group-open:rotate-90 inline-block">▸</span>
                  {q}
                </summary>
                <p className="mt-2.5 pl-5 text-[12.5px] leading-relaxed text-slate-400">{a}</p>
              </details>
            ))}
          </Section>
        </article>

        {/* right rail */}
        <aside className="hidden xl:block">
          <div className="sticky top-20 space-y-4">
            <Panel title="Jump in" dense>
              <div className="space-y-1.5">
                {[
                  ["🎮", "Live Simulator", "/simulator"],
                  ["📊", "Dashboard", "/dashboard"],
                  ["📹", "Replay Viewer", "/replay"],
                ].map(([i, l, to]) => (
                  <Link
                    key={l}
                    to={to}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.07] px-3 py-2 text-[12px] text-slate-300 transition hover:border-cyan-400/30 hover:bg-white/[0.04]"
                  >
                    <span>{i}</span>
                    {l}
                  </Link>
                ))}
              </div>
            </Panel>
            <Panel title="Further reading" dense>
              <ul className="space-y-2 text-[11.5px] text-slate-400">
                <li>Grassé (1959) — <span className="text-slate-500">La théorie de la stigmergie</span></li>
                <li>Deneubourg et al. (1990) — <span className="text-slate-500">The self-organizing exploratory pattern of the Argentine ant</span></li>
                <li>Dorigo &amp; Stützle (2004) — <span className="text-slate-500">Ant Colony Optimization</span></li>
                <li>Payton et al. (2001) — <span className="text-slate-500">Pheromone robotics</span></li>
              </ul>
            </Panel>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <Chip color="emerald">MIT licensed</Chip>
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-500">
                Fork the engine, swap the controller, publish the results. Deterministic seeds make
                every figure reproducible.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="border-b border-white/[0.07] pb-2 text-xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-[13.5px] leading-relaxed text-slate-400">{children}</p>;
}
function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-slate-200">{children}</strong>;
}
function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[12px] text-cyan-300">{children}</code>
  );
}
function Pre({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-xl border border-white/[0.07] bg-ink-950/80 p-4 font-mono leading-relaxed text-slate-300",
        small ? "text-[10.5px]" : "text-[11.5px]",
      )}
    >
      {children}
    </pre>
  );
}
function Callout({ tone, title, children }: { tone: "cyan" | "amber"; title: string; children: ReactNode }) {
  const map = {
    cyan: "border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-200",
    amber: "border-amber-400/25 bg-amber-400/[0.06] text-amber-200",
  };
  return (
    <div className={cn("rounded-xl border p-4", map[tone])}>
      <div className="font-mono text-[10px] tracking-[0.16em] uppercase opacity-80">{title}</div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">{children}</p>
    </div>
  );
}
function StateCard({ title, color, lines }: { title: string; color: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className={cn("font-mono text-[12px] font-semibold tracking-widest", color)}>{title}</div>
      <ul className="mt-2.5 space-y-1.5 font-mono text-[11px] text-slate-400">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <span className="text-slate-600">›</span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
function ApiBlock({ sig, desc }: { sig: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
      <code className="font-mono text-[12px] text-cyan-300">{sig}</code>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}
