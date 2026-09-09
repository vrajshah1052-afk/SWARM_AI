import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
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
          <Route path="/" element={<Home />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/replay" element={<Replay />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
