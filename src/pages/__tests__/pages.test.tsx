import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "../Home";
import Simulator from "../Simulator";
import Dashboard from "../Dashboard";
import Replay from "../Replay";
import Docs from "../Docs";

function renderAt(path: string, node: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
}

describe("page smoke tests", () => {
  it("Home renders hero copy", () => {
    renderAt("/", <Home />);
    expect(screen.getByText(/Digital Pheromone/i)).toBeInTheDocument();
    expect(screen.getByText(/Launch Simulator/i)).toBeInTheDocument();
  });

  it("Simulator renders control panels", () => {
    renderAt("/simulator", <Simulator />);
    expect(screen.getByText(/Live Swarm Simulator/i)).toBeInTheDocument();
    expect(screen.getByText(/Presets/i)).toBeInTheDocument();
  });

  it("Dashboard renders queue builder", () => {
    renderAt("/dashboard", <Dashboard />);
    expect(screen.getByText(/Multi-Task Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/New task/i)).toBeInTheDocument();
  });

  it("Replay renders player shell", () => {
    renderAt("/replay", <Replay />);
    expect(screen.getByText(/Replay Viewer/i)).toBeInTheDocument();
    expect(screen.getByText(/Library/i)).toBeInTheDocument();
  });

  it("Docs renders section headings", () => {
    renderAt("/docs", <Docs />);
    expect(screen.getByText(/Documentation/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Overview/i })).toBeInTheDocument();
  });
});
