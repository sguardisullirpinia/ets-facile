import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BottomBar from "./BottomBar";
import { LogOut, ChevronRight, User, Menu } from "lucide-react";

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
  const [openMenu, setOpenMenu] = useState(false);

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

  // chiudi menu con ESC
  useEffect(() => {
    if (!openMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openMenu]);

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
        {/* ✅ TOP ROW FULL-WIDTH (robusta, non dipende dal CSS esterno) */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            boxSizing: "border-box",
            gap: 12,
          }}
        >
          {/* SINISTRA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
              flex: "1 1 auto",
            }}
          >
            <button
              className="btn btn--ghost"
              type="button"
              title="Menu"
              aria-label="Apri menu"
              onClick={() => setOpenMenu(true)}
              style={{ flexShrink: 0 }}
            >
              <Menu size={20} />
            </button>

            <div
              className="brand"
              onClick={() => nav("/annualita")}
              title="Torna alle annualità"
              style={{
                cursor: "pointer",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              ETS
              <span aria-hidden="true" style={{ color: "var(--primary)" }}>
                ·
              </span>
              FACILE
            </div>
          </div>

          {/* DESTRA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "flex-end",
              flex: "0 0 auto",
              flexShrink: 0,
            }}
          >
            <button
              className="btn btn--ghost"
              onClick={() => nav("/profilo")}
              title="Profilo"
              type="button"
            >
              <User size={16} />
              <span className="hide-mobile">Profilo</span>
            </button>

            <button className="btn" onClick={logout} title="Esci" type="button">
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
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") nav("/annualita");
              }}
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

      {/* DRAWER MENU (SOLO TEST) */}
      {openMenu && (
        <div
          onClick={() => setOpenMenu(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 9999,
            display: "flex",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 280,
              maxWidth: "85vw",
              height: "100%",
              background: "#fff",
              padding: 16,
              boxShadow: "2px 0 16px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div
              style={{
                fontWeight: 900,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <span>Menu</span>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => setOpenMenu(false)}
                aria-label="Chiudi menu"
                title="Chiudi"
              >
                ✕
              </button>
            </div>

            <button
              className="btn btn--block"
              type="button"
              onClick={() => {
                nav("/test");
                setOpenMenu(false);
              }}
            >
              Test
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
