import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State { error: Error | null }

/**
 * Route-level crash containment. Wrapping each page in one of these means a
 * runtime error inside the simulator (bad canvas, invalid state, etc.) will
 * not blank the whole app — the user can navigate away or reset the boundary.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.props.onError) this.props.onError(error, info);
     
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div
        role="alert"
        className="mx-auto mt-16 max-w-xl rounded-xl border border-rose-500/30 bg-rose-500/[0.05] p-6 text-slate-200"
      >
        <h2 className="font-mono text-sm tracking-wider text-rose-300 uppercase">
          Something went wrong
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
          The simulation crashed. This is a bug — please try reloading, or reset the view.
        </p>
        <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-white/10 bg-ink-950/60 p-3 font-mono text-[11px] text-slate-400">
          {error.message}
        </pre>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="rounded-md border border-white/15 px-3 py-1.5 text-[12px] text-slate-200 hover:bg-white/[0.05]"
          >
            Reset view
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-cyan-400 px-3 py-1.5 text-[12px] font-semibold text-ink-950 hover:bg-cyan-300"
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
