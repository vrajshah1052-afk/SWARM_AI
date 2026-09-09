import { useEffect, useRef } from "react";
import { SwarmEngine } from "../sim/engine";
import { renderEngine } from "../sim/render";

/** Ambient background swarm used on the landing hero. */
export default function HeroSwarm({
  className,
  robots = 420,
  opacity = 0.55,
  onStats,
}: {
  className?: string;
  robots?: number;
  opacity?: number;
  onStats?: (s: { collected: number; kbps: number; coverage: number; carrying: number }) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const engine = new SwarmEngine(
      {
        robots,
        evaporation: 0.006,
        deposit: 40,
        diffusion: 0.18,
        foodClusters: 5,
        obstacles: false,
        wander: 0.22,
        speed: 1,
      },
      42,
    );
    // warm start so trails already exist when the page loads
    for (let i = 0; i < 260; i++) engine.step();

    let raf = 0;
    let alive = true;
    let last = 0;
    const view = { showFood: true, showHome: true, showRobots: true, showResource: true, gain: 1 };
    const loop = (t: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (t - last < 28) return;
      last = t;
      if (document.hidden) return;
      for (let i = 0; i < 2; i++) engine.step();
      renderEngine(canvas, engine, view);
      if (onStats && engine.stats.tick % 12 === 0) {
        onStats({
          collected: engine.stats.collected,
          kbps: engine.stats.bandwidthKbps,
          coverage: engine.stats.coverage,
          carrying: engine.stats.carrying,
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [robots, onStats]);

  return <canvas ref={ref} className={className} style={{ opacity }} />;
}
