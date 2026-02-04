import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Anno from "./pages/Anno";
import AigEditor from "./pages/AigEditor";
import Art6Editor from "./pages/Art6Editor";
import RaccoltaFondiEditor from "./pages/RaccoltaFondiEditor";
import RfEditor from "./pages/RfEditor";
import Help from "./pages/Help";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Annualità (contenitore con bottom nav) */}
        <Route path="/anno/:annualitaId" element={<Anno />} />

        {/* Editor full-screen */}
        <Route path="/anno/:annualitaId/aig/:aigId" element={<AigEditor />} />
        <Route path="/anno/:annualitaId/rf/:rfId" element={<RfEditor />} />
        <Route path="/help" element={<Help />} />
        <Route
          path="/anno/:annualitaId/art6/:art6Id"
          element={<Art6Editor />}
        />
        <Route
          path="/anno/:annualitaId/rf/:rfId"
          element={<RaccoltaFondiEditor />}
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
