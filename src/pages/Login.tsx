import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, SecondaryButton, Badge } from "../components/ui";

export default function Login() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length > 0 && !loading;
  }, [email, password, loading]);

  const handleLogin = async () => {
    if (!canSubmit) return;

    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      setError("Credenziali non valide. Controlla email e password.");
      return;
    }

    nav("/annualita");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background:
          "radial-gradient(1200px 600px at 50% -20%, #e0f2fe 0%, #f9fafb 55%, #f9fafb 100%)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        {/* HEADER */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          {/* LOGO */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 10,
            }}
          >
            <img
              src="/logo.png" // 👈 metti logo.png dentro /public
              alt="ETS-FACILE"
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                objectFit: "contain",
              }}
              onError={(e) => {
                // se manca il file, non mostriamo l’immagine (evita “icona rotta”)
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: -0.2,
              color: "#0f172a",
            }}
          >
            ETS-FACILE
          </div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Accedi per gestire la prima nota, le Attività di Interesse Generale
            ex art. 5, le Attività Diverse ex art. 6, le Raccolte Fondi e i test
            di commercialità e secondarietà previsti dal codice.
          </div>
        </div>

        <Card
          title="Accesso"
          style={{
            width: "100%",
            borderRadius: 18,
            boxShadow: "0 14px 35px rgba(15, 23, 42, 0.10)",
            overflow: "hidden",
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {error && (
              <div
                style={{
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Badge tone="red">Errore</Badge>
                  <div style={{ color: "#991b1b", fontWeight: 800 }}>
                    Accesso non riuscito
                  </div>
                </div>
                <div
                  style={{ color: "#7f1d1d", marginTop: 8, lineHeight: 1.3 }}
                >
                  {error}
                </div>
              </div>
            )}

            {/* EMAIL */}
            <div>
              <label
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 8,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                <span>Email</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  obbligatoria
                </span>
              </label>

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@email.it"
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                  background: "#fff",
                  fontSize: 14,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid #93c5fd";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 4px rgba(59,130,246,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid #e5e7eb";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 8,
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                <span>Password</span>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  obbligatoria
                </span>
              </label>

              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  outline: "none",
                  background: "#fff",
                  fontSize: 14,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = "1px solid #93c5fd";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 4px rgba(59,130,246,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = "1px solid #e5e7eb";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* CTA */}
            <div style={{ display: "grid", gap: 10, marginTop: 2 }}>
              <PrimaryButton
                onClick={handleLogin}
                disabled={!canSubmit}
                style={{ width: "100%" }}
              >
                {loading ? "Accesso in corso…" : "Accedi"}
              </PrimaryButton>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  justifyContent: "center",
                  marginTop: 2,
                }}
              >
                <div style={{ height: 1, background: "#e5e7eb", flex: 1 }} />
                <div style={{ fontSize: 12, color: "#64748b" }}>oppure</div>
                <div style={{ height: 1, background: "#e5e7eb", flex: 1 }} />
              </div>

              <SecondaryButton
                onClick={() => nav("/register")}
                style={{ width: "100%" }}
              >
                Crea un account
              </SecondaryButton>

              <div
                style={{
                  textAlign: "center",
                  fontSize: 12,
                  color: "#64748b",
                  marginTop: 4,
                  lineHeight: 1.3,
                }}
              >
                Suggerimento: su mobile usa la tastiera con <b>Invio</b> per
                accedere più velocemente.
              </div>
            </div>
          </div>
        </Card>

        {/* FOOTER */}
        <div
          style={{
            marginTop: 12,
            textAlign: "center",
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          © {new Date().getFullYear()} ETS-FACILE
        </div>
      </div>
    </div>
  );
}
