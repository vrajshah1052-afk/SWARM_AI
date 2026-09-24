import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "dp:onboarded:v1";

export interface TourStep {
  /** CSS selector for the element to highlight. If null, the tooltip centers. */
  target: string | null;
  title: string;
  body: string;
  /** Optional link the user can click to jump to another page. */
  jumpTo?: { to: string; label: string };
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: "Welcome to Digital Pheromone",
    body: "Hundreds of tiny robots coordinate by leaving chemical-like trails. Let's do a 30-second tour of the lab.",
  },
  {
    target: "[data-tour='sim-canvas']",
    title: "The live field",
    body: "Cyan = recruitment trail to food. Amber = trail home. Bright dots are agents carrying resources back to the nest.",
    jumpTo: { to: "/simulator", label: "Open the simulator →" },
  },
  {
    target: "[data-tour='brush']",
    title: "Paint the world",
    body: "Drop food, draw walls, or erase — all while the simulation runs. Trails re-route within about 200 ticks.",
  },
  {
    target: "[data-tour='record']",
    title: "Capture a run",
    body: "Record button snapshots the field at 5-tick cadence. The Replay viewer scrubs frame-by-frame with your captured data.",
  },
  {
    target: "[data-tour='nav-compare']",
    title: "Head-to-head benchmark",
    body: "The Compare page pits the pheromone swarm against a centralized planner on the same field. That's the pitch — same yield, tiny radio budget.",
    jumpTo: { to: "/compare", label: "Try the benchmark →" },
  },
];

export function shouldRunTour(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) !== "done";
  } catch {
    return false;
  }
}

export function markTourDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "done");
  } catch {
    /* private-mode; not worth surfacing */
  }
}

/** Reset the flag from anywhere (e.g. a "Take the tour again" button). */
export function resetTour(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = STEPS[i];

  const close = useCallback(() => {
    markTourDone();
    onClose();
  }, [onClose]);

  const measure = useCallback(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    // Scroll the target into view if it's off-screen.
    if (r.top < 60 || r.bottom > window.innerHeight - 60) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [step.target]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "Enter")
        setI((n) => Math.min(STEPS.length - 1, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const isLast = i === STEPS.length - 1;

  // Tooltip placement: below the highlighted element when there's room,
  // above it when there isn't; centered when there's no target.
  const tipStyle: React.CSSProperties = (() => {
    if (!rect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeBelow = spaceBelow > 220;
    const top = placeBelow ? rect.top + rect.height + 12 : rect.top - 12;
    const left = Math.max(16, Math.min(window.innerWidth - 320 - 16, rect.left));
    return {
      position: "fixed",
      top,
      left,
      transform: placeBelow ? undefined : "translateY(-100%)",
      maxWidth: 320,
    };
  })();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label="Guided tour"
    >
      {/* dim overlay with a spotlight cut-out on the target */}
      <div
        className="pointer-events-auto absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity"
        onClick={close}
        aria-hidden="true"
      />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-cyan-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <div
        className="pointer-events-auto rounded-xl border border-cyan-400/40 bg-ink-900/95 p-4 text-slate-200 shadow-2xl backdrop-blur"
        style={tipStyle}
      >
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-cyan-300 uppercase">
          <span>
            step {i + 1} / {STEPS.length}
          </span>
          <button
            onClick={close}
            aria-label="Skip tour"
            className="text-slate-500 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        <h3 className="mt-2 text-[15px] font-semibold text-white">{step.title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">{step.body}</p>
        {step.jumpTo && (
          <Link
            to={step.jumpTo.to}
            onClick={close}
            className="mt-3 inline-flex text-[12px] font-medium text-cyan-300 hover:text-cyan-200"
          >
            {step.jumpTo.label}
          </Link>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            onClick={close}
            className="rounded-md px-2.5 py-1 text-[11px] text-slate-500 hover:text-slate-200"
          >
            Skip
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setI((n) => Math.max(0, n - 1))}
              disabled={i === 0}
              className="rounded-md border border-white/12 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-40"
            >
              Back
            </button>
            {isLast ? (
              <button
                onClick={close}
                className="rounded-md bg-cyan-400 px-3 py-1.5 text-[11px] font-semibold text-ink-950 shadow-[0_0_18px_-6px_rgba(34,211,238,0.9)] hover:bg-cyan-300"
              >
                Get started
              </button>
            ) : (
              <button
                onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))}
                className="rounded-md bg-cyan-400 px-3 py-1.5 text-[11px] font-semibold text-ink-950 shadow-[0_0_18px_-6px_rgba(34,211,238,0.9)] hover:bg-cyan-300"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
