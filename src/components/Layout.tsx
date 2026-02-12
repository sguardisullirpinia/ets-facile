import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BottomBar from "./BottomBar";
import { LogOut, ChevronRight, User } from "lucide-react";

function pageLabel(pathname: string) {
  if (pathname.startsWith("/entrate-uscite")) return "Entrate/Uscite";
  if (pathname.startsWith("/aig")) return "AIG";
  if (pathname.startsWith("/attivita-diverse")) return "Attività Diverse";
  if (pathname.startsWith("/raccolte-fondi")) return "Raccolte Fondi";
  if (pathname.startsWith("/test")) return "Test";
  if (pathname.startsWith("/ires")) return "IRES";
  if (pathname.startsWith("/annualita")) return "Annualità";
  return "Prima Nota";
}

export default function Layout({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();

  const annualitaId = localStorage.getItem("annualita_id");
  const annoLS = localStorage.getItem("annualita_anno");

  const [anno, setAnno] = useState<string | null>(annoLS);

  useEffect(() => {
    // 🔒 controllo login
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) nav("/login");
    });

    // 🔒 controllo annualità selezionata
    if (!annualitaId) nav("/annualita");

    // prova a caricare anno se manca
    const loadAnno = async () => {
      if (anno) return;
      if (!annualitaId) return;

      const { data, error } = await supabase
        .from("annualita")
        .select("anno")
        .eq("id", annualitaId)
        .single();

      if (!error && data?.anno) {
        const v = String(data.anno);
        setAnno(v);
        localStorage.setItem("annualita_anno", v);
      }
    };

    loadAnno();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    nav("/login");
  };

  const crumbCurrent = useMemo(() => pageLabel(loc.pathname), [loc.pathname]);

  return (
    <div className="appShell">
      {/* HEADER */}
      <header className="appHeader">
        <div className="container appHeader__inner">
          {/* BRAND (in futuro: sostituire con logo immagine) */}
          <div
            className="brand"
            onClick={() => nav("/annualita")}
            title="Torna alle annualità"
            style={{ cursor: "pointer" }}
          >
            ETS
            <span aria-hidden="true" style={{ color: "var(--primary)" }}>
              ·
            </span>
            FACILE
          </div>

          {/* ACTIONS */}
          <div className="headerActions">
            {/* ✅ PROFILO (al posto di Help) */}
            <button
              className="btn btn--ghost"
              onClick={() => nav("/profilo")}
              title="Profilo"
            >
              <User size={16} />
              <span className="hide-mobile">Profilo</span>
            </button>

            <button className="btn" onClick={logout} title="Esci">
              <LogOut size={16} />
              <span className="hide-mobile">Esci</span>
            </button>
          </div>
        </div>

        {/* BREADCRUMB */}
        <div className="appCrumbBar">
          <div className="container appCrumbInner">
            <span
              className="crumbLink"
              onClick={() => nav("/annualita")}
              title="Torna alle annualità"
            >
              {anno ? `Annualità ${anno}` : "Annualità"}
            </span>

            <ChevronRight size={16} />

            <span className="crumbCurrent">{crumbCurrent}</span>
          </div>
        </div>
      </header>

      {/* CONTENUTO */}
      <main className="appMain">
        <div className="appContent">{children}</div>
      </main>

      {/* BOTTOM BAR */}
      <BottomBar />
    </div>
  );
}
