import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, SecondaryButton, Badge } from "../components/ui";
import { LogOut } from "lucide-react";

type ProfileRow = {
  id: string;
  denominazione: string | null;
  cf: string | null;
  piva: string | null;
  tipo_ente: string | null;
};

export default function Profilo() {
  const nav = useNavigate();

  // profile (db)
  const [denominazione, setDenominazione] = useState("");
  const [cf, setCf] = useState("");
  const [piva, setPiva] = useState("");
  const [tipoEnte, setTipoEnte] = useState("APS");

  // auth
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // ui states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const focusStyle = (el: HTMLInputElement | HTMLSelectElement) => {
    el.style.border = "1px solid #93c5fd";
    el.style.boxShadow = "0 0 0 4px rgba(59,130,246,0.15)";
  };

  const blurStyle = (el: HTMLInputElement | HTMLSelectElement) => {
    el.style.border = "1px solid #e5e7eb";
    el.style.boxShadow = "none";
  };

  const load = async () => {
    setError(null);
    setOk(null);
    setLoading(true);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      nav("/login");
      return;
    }

    setEmail(userData.user.email || "");

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, denominazione, cf, piva, tipo_ente")
      .eq("id", userData.user.id)
      .single();

    if (profErr) {
      setError(profErr.message);
      setLoading(false);
      return;
    }

    const p = (prof || {}) as ProfileRow;

    setDenominazione((p.denominazione || "").trim());
    setCf((p.cf || "").trim());
    setPiva((p.piva || "").trim());
    setTipoEnte((p.tipo_ente || "APS").trim() || "APS");

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSave = useMemo(() => {
    const denOk = denominazione.trim().length >= 2;
    const cfOk = /^[0-9]{11}$/.test(cf); // 11 cifre numeriche
    const emailOk = email.trim().length > 3 && email.includes("@");
    const passOk = newPassword.length === 0 || newPassword.length >= 6; // opzionale
    return denOk && cfOk && emailOk && passOk && !saving && !loading;
  }, [denominazione, cf, email, newPassword, saving, loading]);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    nav("/login");
  };

  const handleSave = async () => {
    if (!canSave) return;

    setError(null);
    setOk(null);
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      nav("/login");
      return;
    }

    // 1) update AUTH (email/password) se cambiati
    const currentEmail = userData.user.email || "";

    // email update (può richiedere conferma via email in base alle impostazioni Supabase)
    if (email.trim() && email.trim() !== currentEmail) {
      const { error: upEmailErr } = await supabase.auth.updateUser({
        email: email.trim(),
      });
      if (upEmailErr) {
        setSaving(false);
        setError(
          upEmailErr.message ||
            "Errore aggiornamento email (potrebbe richiedere conferma).",
        );
        return;
      }
    }

    // password update (solo se compilata)
    if (newPassword.trim().length > 0) {
      const { error: upPassErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (upPassErr) {
        setSaving(false);
        setError(upPassErr.message || "Errore aggiornamento password.");
        return;
      }
    }

    // 2) update PROFILE (db)
    const { error: profErr } = await supabase
      .from("profiles")
      .update({
        denominazione: denominazione.trim(),
        cf: cf.trim(),
        piva: piva.trim() ? piva.trim() : null,
        tipo_ente: tipoEnte,
      })
      .eq("id", userData.user.id);

    setSaving(false);

    if (profErr) {
      setError(profErr.message || "Errore aggiornamento profilo.");
      return;
    }

    setNewPassword("");
    setOk(
      email.trim() !== currentEmail
        ? "Dati salvati. Se hai cambiato email, controlla la posta per confermare."
        : "Dati salvati correttamente.",
    );
  };

  const iconBtn: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#111827",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 16,
        position: "relative",
        backgroundColor: "#f9fafb",
        overflow: "hidden",
      }}
    >
      {/* BACKGROUND LOGO – app moderna */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/logo.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "min(60vw, 420px)",
          opacity: 0.035,
          filter: "grayscale(100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* HEADER */}
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/logo.png"
              alt="ETS-FACILE"
              style={{
                width: 28,
                height: 28,
                objectFit: "contain",
                borderRadius: 8,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div
              style={{
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: 0.2,
                color: "#111827",
                userSelect: "none",
              }}
            >
              ETS<span style={{ color: "#2563eb" }}>·</span>FACILE
            </div>
          </div>

          <button
            onClick={logout}
            style={iconBtn}
            title="Esci"
            aria-label="Esci"
          >
            <LogOut size={18} />
          </button>
        </div>

        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h2 style={{ margin: "8px 4px 14px", color: "#111827" }}>Profilo</h2>

          {error && (
            <div style={{ margin: "0 4px 12px" }}>
              <Badge tone="red">Errore</Badge>
              <div style={{ color: "#991b1b", fontWeight: 900, marginTop: 6 }}>
                {error}
              </div>
            </div>
          )}

          {ok && (
            <div style={{ margin: "0 4px 12px" }}>
              <Badge tone="green">OK</Badge>
              <div style={{ color: "#065f46", fontWeight: 900, marginTop: 6 }}>
                {ok}
              </div>
            </div>
          )}

          <Card title="">
            {loading ? (
              <div style={{ color: "#6b7280", fontWeight: 700 }}>
                Caricamento…
              </div>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {/* DATI ENTE */}
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 10 }}></div>

                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <label style={{ fontWeight: 800 }}>
                        Denominazione ente
                      </label>
                      <input
                        value={denominazione}
                        onChange={(e) => setDenominazione(e.target.value)}
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
                        <label style={{ fontWeight: 800 }}>
                          Codice Fiscale
                        </label>
                        <input
                          value={cf}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={11}
                          onChange={(e) => {
                            const onlyNumbers = e.target.value.replace(
                              /\D/g,
                              "",
                            );
                            setCf(onlyNumbers.slice(0, 11));
                          }}
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
                            Il codice fiscale deve contenere esattamente 11
                            cifre numeriche.
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

                  <div style={{ display: "grid", gap: 12 }}>
                    <div>
                      <label style={{ fontWeight: 800 }}>Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                      <div
                        style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}
                      >
                        Nota: cambiando email potrebbe essere richiesta una
                        conferma via email.
                      </div>
                    </div>

                    <div>
                      <label style={{ fontWeight: 800 }}>
                        Nuova password{" "}
                        <span style={{ fontWeight: 600 }}>(opz.)</span>
                      </label>
                      <div style={{ position: "relative", marginTop: 8 }}>
                        <input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
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

                      {newPassword.length > 0 && newPassword.length < 6 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#dc2626",
                            marginTop: 6,
                          }}
                        >
                          La password deve essere lunga almeno 6 caratteri.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div style={{ display: "grid", gap: 10 }}>
                  <PrimaryButton
                    onClick={handleSave}
                    disabled={!canSave}
                    style={{ width: "100%" }}
                  >
                    {saving ? "Salvataggio…" : "Salva modifiche"}
                  </PrimaryButton>

                  <SecondaryButton
                    onClick={() => nav("/annualita")}
                    style={{ width: "100%" }}
                  >
                    Torna alle annualità
                  </SecondaryButton>
                </div>
              </div>
            )}
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
    </div>
  );
}
