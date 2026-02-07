import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Anno from "./pages/Anno";
import Ente from "./pages/Ente";

import AigEditor from "./pages/AigEditor";
import Art6Editor from "./pages/Art6Editor";
import RaccoltaFondiEditor from "./pages/RaccoltaFondiEditor";
import RfEditor from "./pages/RfEditor";
import Help from "./pages/Help";
import IresPage from "./pages/IresPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* default */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* dashboard + profilo ente */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ente" element={<Ente />} />

        {/* Ires */}
        <Route path="/anno/:annualitaId/ires" element={<IresPage />} />

        {/* help */}
        <Route path="/help" element={<Help />} />

        {/* annualità (contenitore con bottom nav) */}
        <Route path="/anno/:annualitaId" element={<Anno />} />

        {/* editor */}
        <Route path="/anno/:annualitaId/aig/:aigId" element={<AigEditor />} />
        <Route path="/anno/:annualitaId/art6/:art6Id" element={<Art6Editor />} />
        <Route path="/anno/:annualitaId/rf/:rfId" element={<RfEditor />} />

        {/* se vuoi usare RaccoltaFondiEditor, usa un path diverso da RfEditor */}
        <Route
          path="/anno/:annualitaId/rf/:rfId/edit"
          element={<RaccoltaFondiEditor />}
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
