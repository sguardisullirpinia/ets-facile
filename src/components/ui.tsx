import React from "react";

/**
 * ✅ UI base ETS-FACILE
 * Versione compatibile TypeScript strict + Vercel
 */

export const safeFormStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  outline: "none",
};

/* =========================
   CARD
========================= */

type CardProps = {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

export function Card({ title, right, children, style, className }: CardProps) {
  return (
    <div
      className={className}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        marginBottom: 14,
        overflow: "hidden",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        ...style, // ✅ ora puoi passare style da fuori
      }}
    >
      {(title || right) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          {title ? (
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#111827",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
          ) : (
            <div />
          )}
          <div style={{ flexShrink: 0 }}>{right}</div>
        </div>
      )}

      <div style={{ minWidth: 0, maxWidth: "100%" }}>{children}</div>
    </div>
  );
}

/* =========================
   BADGE
========================= */

type BadgeProps = {
  tone?: "neutral" | "green" | "red" | "blue" | "amber";
  children: React.ReactNode;
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  const map: Record<string, { bg: string; fg: string; bd: string }> = {
    neutral: { bg: "#f3f4f6", fg: "#111827", bd: "#e5e7eb" },
    green: { bg: "#ecfdf5", fg: "#065f46", bd: "#a7f3d0" },
    red: { bg: "#fef2f2", fg: "#991b1b", bd: "#fecaca" },
    blue: { bg: "#eff6ff", fg: "#1d4ed8", bd: "#bfdbfe" },
    amber: { bg: "#fffbeb", fg: "#92400e", bd: "#fde68a" },
  };

  const c = map[tone] || map.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${c.bd}`,
        background: c.bg,
        color: c.fg,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
        maxWidth: "100%",
      }}
    >
      {children}
    </span>
  );
}

/* =========================
   BUTTONS
========================= */

type ButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties; // ✅ AGGIUNTO
};

export function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  style,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn--primary ${className || ""}`}
      style={style} // ✅ ORA supporta style
      type="button"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
  style,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn--secondary ${className || ""}`}
      style={style} // ✅ ORA supporta style
      type="button"
    >
      {children}
    </button>
  );
}

/* =========================
   ROW
========================= */

type RowProps = {
  label: string;
  value: React.ReactNode;
};

export function Row({ label, value }: RowProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px dashed #e5e7eb",
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#374151",
          fontWeight: 700,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      <div
        style={{
          color: "#111827",
          fontWeight: 900,
          minWidth: 0,
          maxWidth: "60%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* =========================
   EURO FORMAT
========================= */

export function Euro({ v }: { v: number }) {
  return <>{`€ ${Number.isFinite(v) ? v.toFixed(2) : "0.00"}`}</>;
}
