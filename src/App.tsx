import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Anno from "./pages/Anno";
import Ente from "./pages/Ente";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* redirect base */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* app */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ente" element={<Ente />} />

        {/* annualità */}
        <Route path="/anno/:annualitaId" element={<Anno />} />
        <Route path="/anno/:annualitaId/*" element={<Anno />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
