import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, Badge } from "../components/ui";
import { LogOut, Trash2, User } from "lucide-react";

type Annualita = {
  id: string;
  anno: number;
};

export default function Annualita() {
  const nav = useNavigate();

  const [list, setList] = useState<Annualita[]>([]);
  const [anno, setAnno] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);

  const suggestedYears = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1].filter((v, i, a) => a.indexOf(v) === i);
  }, []);

  // 🔹 Carica annualità
  const loadAnnualita = async () => {
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      nav("/login");
      return;
    }

    const { data, error } = await supabase
      .from("annualita")
      .select("id, anno")
      .order("anno", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setList((data || []) as Annualita[]);
    setLoading(false);
  };

  useEffect(() => {
    loadAnnualita();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔹 Crea nuova annualità
  const createAnnualita = async () => {
    setError(null);

    if (!Number.isFinite(anno) || anno < 1900 || anno > 2100) {
      setError("Inserisci un anno valido (1900–2100).");
      return;
    }

    setCreating(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setCreating(false);
      nav("/login");
      return;
    }

    const { error } = await supabase.from("annualita").insert({
      user_id: userData.user.id,
      anno,
    });

    if (error) {
      setError("Annualità già esistente oppure errore di salvataggio.");
      setCreating(false);
      return;
    }

    setCreating(false);
    setOpenCreate(false);
    await loadAnnualita();
  };

  // ✅ Seleziona annualità
  const selectAnnualita = (a: Annualita) => {
    localStorage.setItem("annualita_id", a.id);
    localStorage.setItem("annualita_anno", String(a.anno));
    localStorage.removeItem("movimento_edit_id");
    localStorage.removeItem("movimento_tipologia");

    window.location.href = "/EntrateUscite";
  };

  // 🔹 Elimina annualità
  const deleteAnnualita = async (a: Annualita) => {
    const ok = window.confirm(
      `Vuoi eliminare l'annualità ${a.anno}? Questa azione non è reversibile.`,
    );
    if (!ok) return;

    setError(null);

    const { error } = await supabase.from("annualita").delete().eq("id", a.id);
    if (error) {
      setError(error.message);
      return;
    }

    await loadAnnualita();
  };

  // 🔹 Logout
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    nav("/login");
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

  // FAB +
  const fabStyle: React.CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.05)",
    background: "#2563eb",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(37, 99, 235, 0.28)",
    zIndex: 20,
    fontSize: 28,
    lineHeight: 1,
  };

  const rowBtnStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "#fff",
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    textAlign: "left",
  };

  const trashBtnStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "#6b7280",
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
      {/* BACKGROUND LOGO */}
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

      {/* ✅ TUTTO IL CONTENUTO SOPRA IL BACKGROUND */}
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

          <div style={{ display: "flex", gap: 8 }}>
            {/* PROFILO */}
            <button
              onClick={() => nav("/profilo")}
              style={iconBtn}
              title="Profilo"
              aria-label="Profilo"
            >
              <User size={18} />
            </button>

            {/* LOGOUT */}
            <button
              onClick={logout}
              style={iconBtn}
              title="Esci"
              aria-label="Esci"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <h2 style={{ margin: "8px 4px 14px", color: "#111827" }}>
            Annualità
          </h2>

          {error && (
            <div style={{ margin: "0 4px 12px" }}>
              <Badge tone="red">Errore</Badge>
              <div style={{ color: "#991b1b", fontWeight: 900, marginTop: 6 }}>
                {error}
              </div>
            </div>
          )}

          {/* LISTA */}
          <Card title="Le tue annualità">
            {loading ? (
              <div style={{ color: "#6b7280", fontWeight: 700 }}>
                Caricamento…
              </div>
            ) : list.length === 0 ? (
              <div style={{ color: "#6b7280", fontWeight: 700 }}>
                Nessuna annualità creata. Tocca “+” per aggiungerne una.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {list.map((a) => (
                  <div key={a.id} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => selectAnnualita(a)}
                      style={rowBtnStyle}
                      aria-label={`Apri Annualità ${a.anno}`}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontWeight: 950, color: "#111827" }}>
                          Annualità {a.anno}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            fontWeight: 700,
                            marginTop: 2,
                          }}
                        >
                          Tocca per aprire il workspace
                        </div>
                      </div>

                      <div style={{ width: 40 }} />
                    </button>

                    <button
                      type="button"
                      title="Elimina"
                      aria-label={`Elimina annualità ${a.anno}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deleteAnnualita(a);
                      }}
                      style={{
                        ...trashBtnStyle,
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* FAB + */}
        {!openCreate && (
          <button
            style={fabStyle}
            onClick={() => setOpenCreate(true)}
            type="button"
            aria-label="Crea nuova annualità"
          >
            +
          </button>
        )}

        {/* MODALE CREA */}
        {openCreate && (
          <div
            onClick={() => !creating && setOpenCreate(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              padding: 12,
              zIndex: 50,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 560,
                background: "#fff",
                borderRadius: 18,
                boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ fontWeight: 950, color: "#111827" }}>
                  Nuova annualità
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  Seleziona un anno oppure inseriscilo manualmente.
                </div>
              </div>

              <div style={{ padding: 14, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {suggestedYears.map((y) => (
                    <button
                      key={y}
                      onClick={() => setAnno(y)}
                      type="button"
                      style={{
                        border: "1px solid #e5e7eb",
                        background: anno === y ? "#eff6ff" : "#fff",
                        color: anno === y ? "#2563eb" : "#374151",
                        padding: "8px 10px",
                        borderRadius: 999,
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>

                <input
                  type="number"
                  value={anno}
                  onChange={(e) => setAnno(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    fontWeight: 900,
                    outline: "none",
                  }}
                  aria-label="Anno"
                />

                <PrimaryButton onClick={createAnnualita} disabled={creating}>
                  {creating ? "Creazione…" : "Crea annualità"}
                </PrimaryButton>

                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Nota: non puoi creare due annualità con lo stesso anno.
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => !creating && setOpenCreate(false)}
                  style={{
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    padding: "10px 12px",
                    borderRadius: 12,
                    cursor: "pointer",
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
