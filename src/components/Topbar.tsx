import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type TopbarProps = {
  title: string;
  subtitle?: string;
  /** Se true mostra freccia indietro */
  showBack?: boolean;
  /** Dove andare al click “indietro” (se non lo metti fa nav(-1)) */
  backTo?: string;
  /** Percorso del logo (default /logo.png) */
  logoSrc?: string;
  /** Alt text del logo */
  logoAlt?: string;
  /** Bottoni/azioni a destra (es. Ente/Help/Esci) */
  right?: ReactNode;
};

export default function Topbar({
  title,
  subtitle,
  showBack = false,
  backTo,
  logoSrc = "/logo.png",
  logoAlt = "Logo",
  right,
}: TopbarProps) {
  const nav = useNavigate();

  const onBack = () => {
    if (backTo) nav(backTo);
    else nav(-1);
  };

  return (
    <header className="topbar">
      <div className="topbarLeft">
        {showBack && (
          <button className="iconBtn" onClick={onBack} aria-label="Indietro">
            ←
          </button>
        )}

        <img src={logoSrc} alt={logoAlt} className="appLogo" />
        <span className="topbarDivider" />

        <div className="topbarText">
          <div className="topbarTitle">{title}</div>
          {subtitle ? <div className="topbarSubtitle">{subtitle}</div> : null}
        </div>
      </div>

      <div className="topbarRight">{right}</div>
    </header>
  );
}
