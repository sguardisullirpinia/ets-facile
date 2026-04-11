import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import BottomBar from "./BottomBar";
import {
  LogOut,
  ChevronRight,
  User,
  Menu,
  X,
  Home,
  BookOpen,
  Shapes,
  Target,
  Users,
  FlaskConical,
  Receipt,
  FileText,
} from "lucide-react";

type Regime = "FORFETTARIO" | "ORDINARIO";

type MenuItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  show?: boolean;
};

function pageLabel(pathname: string) {
  const p = pathname.toLowerCase();

  if (p.startsWith("/entrateuscite")) return "Prima Nota";
  if (p.startsWith("/entrate-uscite")) return "Prima Nota";
  if (p.startsWith("/aig")) return "AIG";
  if (p.startsWith("/attivita-diverse")) return "Attività Diverse";
  if (p.startsWith("/raccolte-fondi")) return "Raccolte Fondi";
  if (p.startsWith("/test")) return "Test";
  if (p.startsWith("/iva")) return "Iva";
  if (p.startsWith("/ires")) return "IRES";
  if (p.startsWith("/rendiconto")) return "Rendiconto";
  if (p.startsWith("/annualita")) return "Annualità";
  if (p.startsWith("/registro-soci")) return "Registro Soci";
  if (p.startsWith("/profilo")) return "Profilo";

  return "Prima Nota";
}

function isActivePath(currentPath: string, itemPath: string) {
  const current = currentPath.toLowerCase();
  const item = itemPath.toLowerCase();
  return current === item || current.startsWith(item + "/");
}

function SidebarMenu({
  items,
  currentPath,
  onNavigate,
}: {
  items: MenuItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {items
        .filter((item) => item.show !== false)
        .map((item) => {
          const active = isActivePath(currentPath, item.path);

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={active ? "page" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "9px 10px",
                borderRadius: 10,
                border: active
                  ? "1px solid rgba(37,99,235,0.18)"
                  : "1px solid rgba(0,0,0,0.08)",
                background: active ? "rgba(37,99,235,0.08)" : "#fff",
                color: active ? "#1d4ed8" : "#111827",
                fontWeight: active ? 800 : 600,
                fontSize: 13,
                lineHeight: 1.2,
                cursor: "pointer",
                textAlign: "left",
                boxShadow: active ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                minHeight: 38,
              }}
            >
              <span
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  opacity: active ? 1 : 0.85,
                }}
              >
                {item.icon}
              </span>

              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
    </nav>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();

  const annualitaId = localStorage.getItem("annualita_id");
  const annoLS = localStorage.getItem("annualita_anno");
  const regimeLS = localStorage.getItem("annualita_regime");

  const [anno, setAnno] = useState<string | null>(annoLS);
  const [regime, setRegime] = useState<Regime>(
    regimeLS === "FORFETTARIO" || regimeLS === "ORDINARIO"
      ? (regimeLS as Regime)
      : "ORDINARIO",
  );
  const [openMenu, setOpenMenu] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) nav("/login");
    });

    if (!annualitaId) nav("/annualita");

    const loadAnnualitaInfo = async () => {
      if (!annualitaId) return;

      if (anno && (regime === "FORFETTARIO" || regime === "ORDINARIO")) return;

      const { data, error } = await supabase
        .from("annualita")
        .select("anno, regime")
        .eq("id", annualitaId)
        .single();

      if (error) return;

      if (data?.anno) {
        const v = String(data.anno);
        setAnno(v);
        localStorage.setItem("annualita_anno", v);
      }

      if (data?.regime === "FORFETTARIO" || data?.regime === "ORDINARIO") {
        setRegime(data.regime);
        localStorage.setItem("annualita_regime", data.regime);
      }
    };

    loadAnnualitaInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onStorage = () => {
      const r = localStorage.getItem("annualita_regime");
      if (r === "FORFETTARIO" || r === "ORDINARIO") setRegime(r);

      const a = localStorage.getItem("annualita_anno");
      setAnno(a || null);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
  const isRegimeOrdinario = regime === "ORDINARIO";

  const coreItems: MenuItem[] = [
    {
      label: "Prima Nota",
      path: "/EntrateUscite",
      icon: <Home size={16} strokeWidth={2} />,
    },
    {
      label: "AIG",
      path: "/aig",
      icon: <BookOpen size={16} strokeWidth={2} />,
    },
    {
      label: "A. Diverse",
      path: "/attivita-diverse",
      icon: <Shapes size={16} strokeWidth={2} />,
    },
    {
      label: "R. Fondi",
      path: "/raccolte-fondi",
      icon: <Target size={16} strokeWidth={2} />,
    },
  ];

  const extraItems: MenuItem[] = [
    {
      label: "Registro Soci",
      path: "/registro-soci",
      icon: <Users size={16} strokeWidth={2} />,
    },
    {
      label: "Test",
      path: "/test",
      icon: <FlaskConical size={16} strokeWidth={2} />,
    },
    {
      label: "Ires",
      path: "/ires",
      icon: <Receipt size={16} strokeWidth={2} />,
    },
    {
      label: "Rendiconto",
      path: "/rendiconto",
      icon: <FileText size={16} strokeWidth={2} />,
    },
    {
      label: "Liquidazione IVA",
      path: "/Iva",
      icon: <FileText size={16} strokeWidth={2} />,
      show: isRegimeOrdinario,
    },
  ];

  const navigateAndClose = (path: string) => {
    nav(path);
    setOpenMenu(false);
  };

  return (
    <>
      <div className="layoutShell">
        <aside className="layoutSidebar">
          <div className="layoutSidebarInner">
            <div
              className="layoutBrand"
              onClick={() => nav("/annualita")}
              title="Torna alle annualità"
            >
              ETS
              <span aria-hidden="true" style={{ color: "var(--primary)" }}>
                ·
              </span>
              FACILE
            </div>

            <div className="layoutSidebarSection">
              <div className="layoutSidebarSectionTitle">Operatività</div>
              <SidebarMenu
                items={coreItems}
                currentPath={loc.pathname}
                onNavigate={nav}
              />
            </div>

            <div className="layoutSidebarSection">
              <div className="layoutSidebarSectionTitle">Strumenti</div>
              <SidebarMenu
                items={extraItems}
                currentPath={loc.pathname}
                onNavigate={nav}
              />
            </div>
          </div>
        </aside>

        <div className="layoutMainArea">
          <header className="appHeader">
            <div className="layoutTopbar">
              <div className="layoutTopbarLeft">
                <button
                  className="btn btn--ghost mobileOnly"
                  type="button"
                  title="Menu"
                  aria-label="Apri menu"
                  onClick={() => setOpenMenu(true)}
                >
                  <Menu size={20} />
                </button>

                <div
                  className="brand brandMobileOnly"
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

              <div className="layoutTopbarRight">
                <button
                  className="btn btn--ghost"
                  onClick={() => nav("/profilo")}
                  title="Profilo"
                  type="button"
                >
                  <User size={16} />
                  <span className="hide-mobile">Profilo</span>
                </button>

                <button
                  className="btn"
                  onClick={logout}
                  title="Esci"
                  type="button"
                >
                  <LogOut size={16} />
                  <span className="hide-mobile">Esci</span>
                </button>
              </div>
            </div>

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

          <main className="appMain">
            <div className="appContent layoutContent">{children}</div>
          </main>
        </div>
      </div>

      <div className="bottomBarMobileOnly">
        <BottomBar />
      </div>

      {openMenu && (
        <div className="mobileDrawerOverlay" onClick={() => setOpenMenu(false)}>
          <div
            className="mobileDrawerPanel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="mobileDrawerHeader">
              <span>Menu</span>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => setOpenMenu(false)}
                aria-label="Chiudi menu"
                title="Chiudi"
              >
                <X size={18} />
              </button>
            </div>

            <div className="layoutSidebarSection">
              <div className="layoutSidebarSectionTitle">Operatività</div>
              <SidebarMenu
                items={coreItems}
                currentPath={loc.pathname}
                onNavigate={navigateAndClose}
              />
            </div>

            <div className="layoutSidebarSection">
              <div className="layoutSidebarSectionTitle">Strumenti</div>
              <SidebarMenu
                items={extraItems}
                currentPath={loc.pathname}
                onNavigate={navigateAndClose}
              />
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          .layoutShell {
            min-height: 100vh;
            display: grid;
            grid-template-columns: 220px minmax(0, 1fr);
            background: #f3f4f6;
          }

          .layoutSidebar {
            background: #ffffff;
            border-right: 1px solid rgba(0,0,0,0.08);
            height: 100vh;
            position: sticky;
            top: 0;
            align-self: start;
            overflow: hidden;
          }

          .layoutSidebarInner {
            height: 100%;
            padding: 14px 12px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            overflow-y: auto;
          }

          .layoutBrand {
            cursor: pointer;
            font-size: 22px;
            font-weight: 900;
            letter-spacing: -0.02em;
            line-height: 1;
            padding-bottom: 10px;
            border-bottom: 1px solid rgba(0,0,0,0.08);
          }

          .layoutSidebarSection {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .layoutSidebarSectionTitle {
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
            padding-left: 2px;
          }

          .layoutMainArea {
            min-width: 0;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
          }

          .layoutTopbar {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            box-sizing: border-box;
            gap: 12px;
            background: #fff;
            border-bottom: 1px solid rgba(0,0,0,0.06);
          }

          .layoutTopbarLeft,
          .layoutTopbarRight {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .layoutTopbarLeft {
            flex: 1 1 auto;
          }

          .layoutTopbarRight {
            flex: 0 0 auto;
          }

          .brandMobileOnly {
            display: none;
          }

          .layoutContent {
            padding-bottom: 32px !important;
          }

          .mobileOnly {
            display: none !important;
          }

          .bottomBarMobileOnly {
            display: none;
          }

          .mobileDrawerOverlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 9999;
            display: flex;
          }

          .mobileDrawerPanel {
            width: 280px;
            max-width: 88vw;
            height: 100%;
            background: #fff;
            padding: 16px;
            box-shadow: 2px 0 16px rgba(0,0,0,0.15);
            display: flex;
            flex-direction: column;
            gap: 18px;
            overflow-y: auto;
          }

          .mobileDrawerHeader {
            font-weight: 900;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          @media (max-width: 991px) {
            .layoutShell {
              display: block;
            }

            .layoutSidebar {
              display: none;
            }

            .mobileOnly {
              display: inline-flex !important;
            }

            .brandMobileOnly {
              display: block;
            }

            .bottomBarMobileOnly {
              display: block;
            }

            .layoutContent {
              padding-bottom: 90px !important;
            }
          }
        `}
      </style>
    </>
  );
}
