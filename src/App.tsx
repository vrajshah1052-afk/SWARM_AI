import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Simulator from "./pages/Simulator";
import Dashboard from "./pages/Dashboard";
import Replay from "./pages/Replay";
import Docs from "./pages/Docs";

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route
            path="/"
            element={
              <ErrorBoundary>
                <Home />
              </ErrorBoundary>
            }
          />
          <Route
            path="/simulator"
            element={
              <ErrorBoundary>
                <Simulator />
              </ErrorBoundary>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ErrorBoundary>
                <Dashboard />
              </ErrorBoundary>
            }
          />
          <Route
            path="/replay"
            element={
              <ErrorBoundary>
                <Replay />
              </ErrorBoundary>
            }
          />
          <Route
            path="/docs"
            element={
              <ErrorBoundary>
                <Docs />
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
