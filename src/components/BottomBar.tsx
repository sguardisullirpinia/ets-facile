import { useLocation, useNavigate } from "react-router-dom";
import { Home, BookOpen, Shapes, Target, Calculator } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tab = {
  label: string;
  path: string;
  Icon: LucideIcon;
};

const tabs: Tab[] = [
  { label: "Prima Nota", path: "/EntrateUscite", Icon: Home },
  { label: "AIG", path: "/aig", Icon: BookOpen },
  { label: "A. Diverse", path: "/attivita-diverse", Icon: Shapes },
  { label: "R. Fondi", path: "/raccolte-fondi", Icon: Target },
  { label: "Test", path: "/test", Icon: Calculator },
];

export default function BottomBar() {
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <nav className="bottomBar" aria-label="Navigazione annualità">
      <div className="container bottomBar__inner">
        {tabs.map(({ label, path, Icon }) => {
          const active =
            loc.pathname === path || loc.pathname.startsWith(path + "/");

          return (
            <button
              key={path}
              onClick={() => nav(path)}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`bottomTab ${active ? "bottomTab--active" : ""}`}
              type="button"
            >
              <Icon size={18} strokeWidth={2} />
              <span className="bottomTab__label">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
