import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export function Panel({
  children,
  className,
  title,
  right,
  dense,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  right?: ReactNode;
  dense?: boolean;
}) {
  return (
    <div className={cn("glass rounded-xl", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-2.5">
          <h3 className="font-mono text-[11px] font-semibold tracking-[0.16em] text-slate-300 uppercase">
            {title}
          </h3>
          {right}
        </div>
      )}
      <div className={dense ? "p-3" : "p-4"}>{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  accent = "cyan",
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: "cyan" | "amber" | "violet" | "emerald" | "slate";
  hint?: string;
}) {
  const colors: Record<string, string> = {
    cyan: "text-cyan-300",
    amber: "text-amber-300",
    violet: "text-violet-300",
    emerald: "text-emerald-300",
    slate: "text-slate-200",
  };
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <div className="font-mono text-[10px] tracking-[0.14em] text-slate-500 uppercase">{label}</div>
      <div className={cn("mt-1 font-mono text-xl leading-none font-semibold tabular-nums", colors[accent])}>
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-slate-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[10px] text-slate-600">{hint}</div>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  fmt,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  fmt?: (v: number) => string;
  hint?: string;
}) {
  return (
    <label className="block select-none">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-medium tracking-wide text-slate-400">{label}</span>
        <span className="font-mono text-[11px] text-cyan-300 tabular-nums">
          {fmt ? fmt(value) : value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        className="mt-1.5 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${fmt ? fmt(value) : value}${unit ?? ""}`}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <div className="mt-1 text-[10px] leading-snug text-slate-600">{hint}</div>}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  color = "cyan",
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: "cyan" | "amber" | "violet" | "emerald";
}) {
  const on: Record<string, string> = {
    cyan: "bg-cyan-400/80",
    amber: "bg-amber-400/80",
    violet: "bg-violet-400/80",
    emerald: "bg-emerald-400/80",
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-md px-1.5 py-1 text-[11px] text-slate-300 transition hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:outline-none"
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-8 rounded-full transition",
          checked ? on[color] : "bg-slate-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-ink-950 transition-all",
            checked ? "left-4.5" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  className,
  disabled,
  size = "md",
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "soft";
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-cyan-400 text-ink-950 hover:bg-cyan-300 shadow-[0_0_24px_-6px_rgba(34,211,238,0.7)] font-semibold",
    ghost: "border border-white/12 text-slate-300 hover:bg-white/[0.06] hover:text-white",
    soft: "bg-white/[0.06] text-slate-200 hover:bg-white/[0.11]",
    danger: "border border-rose-500/40 text-rose-300 hover:bg-rose-500/10",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:outline-none",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
        variants[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Chip({ children, color = "slate" }: { children: ReactNode; color?: string }) {
  const map: Record<string, string> = {
    slate: "border-white/10 text-slate-400",
    cyan: "border-cyan-400/30 text-cyan-300 bg-cyan-400/5",
    amber: "border-amber-400/30 text-amber-300 bg-amber-400/5",
    violet: "border-violet-400/30 text-violet-300 bg-violet-400/5",
    emerald: "border-emerald-400/30 text-emerald-300 bg-emerald-400/5",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase",
        map[color],
      )}
    >
      {children}
    </span>
  );
}

export interface Series { name: string; color: string; data: number[] }

export function LineChart({
  series,
  height = 150,
  yUnit,
  fill = true,
}: {
  series: Series[];
  height?: number;
  yUnit?: string;
  fill?: boolean;
}) {
  const W = 600;
  const H = height;
  const pad = { l: 34, r: 8, t: 10, b: 16 };
  const all = series.flatMap((s) => s.data);
  const max = Math.max(1e-6, ...all);
  const len = Math.max(2, ...series.map((s) => s.data.length));
  const px = (i: number) => pad.l + (i / (len - 1)) * (W - pad.l - pad.r);
  const py = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={py(max * f)}
              y2={py(max * f)}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
            <text x={2} y={py(max * f) + 3} fill="#4c5670" fontSize={9} fontFamily="monospace">
              {formatNum(max * f)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          if (s.data.length < 2) return null;
          const d = s.data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
          const area = `${d} L${px(s.data.length - 1)},${H - pad.b} L${px(0)},${H - pad.b} Z`;
          return (
            <g key={s.name}>
              {fill && <path d={area} fill={s.color} opacity={0.1} />}
              <path d={d} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinejoin="round" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
            <i className="h-1.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.name}
            {yUnit ? ` (${yUnit})` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarRow({
  label,
  value,
  max,
  color = "#22d3ee",
  display,
}: {
  label: string;
  value: number;
  max: number;
  color?: string;
  display?: string;
}) {
  const pct = Math.max(2, (value / Math.max(1e-6, max)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-28 shrink-0 truncate font-mono text-[10px] text-slate-400">{label}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 12px -2px ${color}` }}
        />
      </div>
      <div className="w-16 shrink-0 text-right font-mono text-[10px] text-slate-300 tabular-nums">
        {display ?? formatNum(value)}
      </div>
    </div>
  );
}

export function formatNum(v: number) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return (v / 1000).toFixed(1) + "k";
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(3);
}
