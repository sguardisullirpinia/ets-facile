import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, SecondaryButton, Badge } from "../components/ui";

export default function Register() {
  const nav = useNavigate();

  const [denominazione, setDenominazione] = useState("");
  const [cf, setCf] = useState("");
  const [piva, setPiva] = useState("");
  const [tipoEnte, setTipoEnte] = useState("APS");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    const denOk = denominazione.trim().length >= 2;
    const cfOk = /^[0-9]{11}$/.test(cf);
    const emailOk = email.trim().length > 3 && email.includes("@");
    const passOk = password.length >= 6;
    return denOk && cfOk && emailOk && passOk && !loading && !ok;
  }, [denominazione, cf, email, password, loading, ok]);

  const focusStyle = (el: HTMLInputElement | HTMLSelectElement) => {
    el.style.border = "1px solid #93c5fd";
    el.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.15)";
  };

  const blurStyle = (el: HTMLInputElement | HTMLSelectElement) => {
    el.style.border = "1px solid #e5e7eb";
    el.style.boxShadow = "none";
  };

  const handleRegister = async () => {
    if (!canSubmit) return;

    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      setError(error?.message || "Errore durante la registrazione");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      denominazione: denominazione.trim(),
      cf: cf.trim(),
      piva: piva.trim() ? piva.trim() : null,
      tipo_ente: tipoEnte,
    });

    setLoading(false);

    if (profileError) {
      setError(profileError.message);
      return;
    }

    setOk(true);
    setTimeout(() => nav("/login"), 2500);
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRegister();
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
      <div style={{ width: "100%", maxWidth: 560 }}>
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
              src="/logo.png"
              alt="ETS-FACILE"
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                objectFit: "contain",
              }}
              onError={(e) => {
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
            Crea il tuo account e inserisci i dati dell’ente
          </div>
        </div>

        <Card
          title=""
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
                    Registrazione non riuscita
                  </div>
                </div>
                <div
                  style={{ color: "#7f1d1d", marginTop: 8, lineHeight: 1.3 }}
                >
                  {error}
                </div>
              </div>
            )}

            {ok && (
              <div
                style={{
                  border: "1px solid #bbf7d0",
                  background: "#ecfdf5",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Badge tone="green">OK</Badge>
                  <div style={{ color: "#065f46", fontWeight: 900 }}>
                    Registrazione completata
                  </div>
                </div>
                <div style={{ color: "#065f46", marginTop: 8 }}>
                  Tra poco verrai reindirizzato al login…
                </div>
              </div>
            )}

            {/* DATI ENTE */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>
                Dati dell’ente
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <label style={{ fontWeight: 800 }}>Denominazione ente</label>
                  <input
                    value={denominazione}
                    onChange={(e) => setDenominazione(e.target.value)}
                    onKeyDown={onEnter}
                    placeholder="Associazione XYZ APS"
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "12px",
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      outline: "none",
                    }}
                    onFocus={(e) => focusStyle(e.currentTarget)}
                    onBlur={(e) => blurStyle(e.currentTarget)}
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={{ fontWeight: 800 }}>Codice Fiscale</label>
                    <input
                      value={cf}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={11}
                      onChange={(e) => {
                        const onlyNumbers = e.target.value.replace(/\D/g, "");
                        setCf(onlyNumbers.slice(0, 11));
                      }}
                      onKeyDown={onEnter}
                      placeholder="11 cifre numeriche"
                      style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "12px",
                        borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        outline: "none",
                      }}
                      onFocus={(e) => focusStyle(e.currentTarget)}
                      onBlur={(e) => blurStyle(e.currentTarget)}
                    />

                    {cf.length > 0 && cf.length !== 11 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "#dc2626",
                          marginTop: 6,
                        }}
                      >
                        Il codice fiscale deve contenere esattamente 11 cifre
                        numeriche.
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ fontWeight: 800 }}>
                      Partita IVA{" "}
                      <span style={{ fontWeight: 600 }}>(opz.)</span>
                    </label>
                    <input
                      value={piva}
                      onChange={(e) => setPiva(e.target.value)}
                      onKeyDown={onEnter}
                      style={{
                        width: "100%",
                        marginTop: 8,
                        padding: "12px",
                        borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        outline: "none",
                      }}
                      onFocus={(e) => focusStyle(e.currentTarget)}
                      onBlur={(e) => blurStyle(e.currentTarget)}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontWeight: 800 }}>Tipologia ente</label>
                  <select
                    value={tipoEnte}
                    onChange={(e) => setTipoEnte(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: 8,
                      padding: "12px",
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                    }}
                    onFocus={(e) => focusStyle(e.currentTarget)}
                    onBlur={(e) => blurStyle(e.currentTarget)}
                  >
                    <option value="APS">APS</option>
                    <option value="ODV">ODV</option>
                    <option value="ETS">ETS</option>
                    <option value="NO_RUNTS">NO RUNTS</option>
                  </select>
                </div>
              </div>
            </div>

            {/* CREDENZIALI */}
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>
                Credenziali
              </div>

              <div>
                <label style={{ fontWeight: 800 }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={onEnter}
                  placeholder="nome@email.it"
                  style={{
                    width: "100%",
                    marginTop: 8,
                    padding: "12px",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    outline: "none",
                  }}
                  onFocus={(e) => focusStyle(e.currentTarget)}
                  onBlur={(e) => blurStyle(e.currentTarget)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontWeight: 800 }}>Password</label>
                <div style={{ position: "relative", marginTop: 8 }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={onEnter}
                    placeholder="Minimo 6 caratteri"
                    style={{
                      width: "100%",
                      padding: "12px 44px 12px 12px",
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      outline: "none",
                    }}
                    onFocus={(e) => focusStyle(e.currentTarget)}
                    onBlur={(e) => blurStyle(e.currentTarget)}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#2563eb",
                      cursor: "pointer",
                    }}
                  >
                    {showPassword ? "Nascondi" : "Mostra"}
                  </button>
                </div>
              </div>
            </div>

            {/* CTA */}
            <PrimaryButton
              onClick={handleRegister}
              disabled={!canSubmit}
              style={{ width: "100%" }}
            >
              {loading ? "Registrazione in corso…" : "Registrati"}
            </PrimaryButton>

            <SecondaryButton
              onClick={() => nav("/login")}
              style={{ width: "100%" }}
            >
              Torna al login
            </SecondaryButton>
          </div>
        </Card>

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
