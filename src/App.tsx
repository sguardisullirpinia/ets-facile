import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Annualita from "./pages/Annualita";
import EntrateUscite from "./pages/EntrateUscite";
import Aig from "./pages/Aig";
import AttivitaDiverse from "./pages/AttivitaDiverse";
import RaccolteFondi from "./pages/RaccolteFondi";
import Test from "./pages/Test";
import Ires from "./pages/Ires";
import MovimentoEditor from "./pages/MovimentoEditor";
import Profilo from "./pages/Profilo"; // ✅ NUOVO

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/annualita" element={<Annualita />} />
      <Route path="/profilo" element={<Profilo />} /> {/* ✅ NUOVO */}
      <Route path="/ires" element={<Ires />} />
      <Route path="/EntrateUscite" element={<EntrateUscite />} />
      <Route path="/aig" element={<Aig />} />
      <Route path="/attivita-diverse" element={<AttivitaDiverse />} />
      <Route path="/raccolte-fondi" element={<RaccolteFondi />} />
      <Route path="/test" element={<Test />} />
      <Route path="/movimento" element={<MovimentoEditor />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
