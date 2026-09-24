import { NavLink, Link, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { OnboardingTour, shouldRunTour } from "./OnboardingTour";

const NAV = [
  { to: "/", label: "Overview", icon: "◈" },
  { to: "/simulator", label: "Simulator", icon: "🎮" },
  { to: "/compare", label: "Compare", icon: "⚖" },
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/replay", label: "Replay", icon: "📹" },
  { to: "/docs", label: "Docs", icon: "📚" },
];

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/90 to-violet-500/90 shadow-[0_0_22px_-4px_rgba(34,211,238,0.8)]">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-ink-950" fill="currentColor">
          <circle cx="12" cy="5" r="2.1" />
          <circle cx="5.5" cy="15" r="2.1" />
          <circle cx="18.5" cy="15" r="2.1" />
          <circle cx="12" cy="19.5" r="1.6" opacity="0.7" />
          <path
            d="M12 7v4M10.4 12.2 7 13.8M13.6 12.2 17 13.8M7.2 16.6 11 18.6M16.8 16.6 13 18.6"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
          />
        </svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-mono text-[13px] font-semibold tracking-tight text-white">
            DIGITAL<span className="text-cyan-300">·</span>PHEROMONE
          </span>
          <span className="block font-mono text-[9px] tracking-[0.22em] text-slate-500 uppercase">
            swarm intelligence lab
          </span>
        </span>
      )}
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    // Defer to next tick so the first route paints before we spotlight.
    const t = window.setTimeout(() => {
      if (shouldRunTour()) setTourOpen(true);
    }, 400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-full flex-col bg-ink-950">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                data-tour={n.to === "/compare" ? "nav-compare" : undefined}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-medium transition",
                    isActive
                      ? "bg-white/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,0.25)]"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
                  )
                }
              >
                <span className="mr-1.5 text-[11px] opacity-70">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/5 px-2.5 py-1 font-mono text-[10px] tracking-wider text-emerald-300 uppercase lg:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
              </span>
              engine v3.9 online
            </span>
            <button
              className="rounded-md border border-white/12 p-1.5 text-slate-300 md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="menu"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-white/[0.07] bg-ink-900 px-4 py-2 md:hidden">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "block rounded-md px-3 py-2 text-sm",
                    isActive ? "bg-white/[0.07] text-cyan-300" : "text-slate-400",
                  )
                }
              >
                <span className="mr-2">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {tourOpen && <OnboardingTour onClose={() => setTourOpen(false)} />}

      <footer className="border-t border-white/[0.07] bg-ink-900/60">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-slate-500">
              An open research sandbox for stigmergic coordination: pheromone fields, bandwidth-aware
              trail compression, and emergent multi-robot foraging.
            </p>
          </div>
          <FooterCol
            title="Product"
            links={[
              ["Live Simulator", "/simulator"],
              ["Multi-Task Dashboard", "/dashboard"],
              ["Replay Viewer", "/replay"],
              ["Documentation", "/docs"],
            ]}
          />
          <FooterCol
            title="Reference"
            links={[
              ["Pheromone Physics", "/docs#physics"],
              ["Robot Behaviours", "/docs#behaviours"],
              ["Bandwidth Model", "/docs#bandwidth"],
              ["API Reference", "/docs#api"],
            ]}
          />
          <div>
            <h4 className="font-mono text-[10px] tracking-[0.2em] text-slate-400 uppercase">Telemetry</h4>
            <div className="mt-3 space-y-1.5 font-mono text-[11px] text-slate-500">
              <div className="flex justify-between">
                <span>lattice</span>
                <span className="text-slate-300">200 × 126</span>
              </div>
              <div className="flex justify-between">
                <span>fields</span>
                <span className="text-slate-300">Φ_food, Φ_home</span>
              </div>
              <div className="flex justify-between">
                <span>integrator</span>
                <span className="text-slate-300">explicit euler</span>
              </div>
              <div className="flex justify-between">
                <span>licence</span>
                <span className="text-slate-300">MIT</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] px-6 py-4 font-mono text-[10px] tracking-wider text-slate-600">
          <span>
            © {new Date().getFullYear()} DIGITAL PHEROMONE LAB · SIMULATED DATA, NO ROBOTS WERE HARMED
          </span>
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="text-slate-500 uppercase transition hover:text-cyan-300"
          >
            ↻ replay tour
          </button>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="font-mono text-[10px] tracking-[0.2em] text-slate-400 uppercase">{title}</h4>
      <ul className="mt-3 space-y-1.5">
        {links.map(([label, to]) => (
          <li key={label}>
            <Link to={to} className="text-[12px] text-slate-500 transition hover:text-cyan-300">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
