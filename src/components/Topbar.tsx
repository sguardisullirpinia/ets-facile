import type { ReactNode } from "react";

type TopbarProps = {
  title?: string;
  right?: ReactNode;
};

export default function Topbar({ title, right }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbarLeft">
        <img src="/logo.png" alt="Logo" className="appLogo" />
        {title && <h2 style={{ margin: 0 }}>{title}</h2>}
      </div>

      <div className="topbarRight">{right}</div>
    </header>
  );
}
