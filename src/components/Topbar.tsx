import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type TopbarProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  logoSrc?: string;
  logoAlt?: string;
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
          <button className="topbarBack" onClick={onBack} aria-label="Indietro">
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
