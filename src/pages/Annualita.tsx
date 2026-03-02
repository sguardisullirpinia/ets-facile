import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, Badge } from "../components/ui";
import { LogOut, Trash2, User, Pencil } from "lucide-react";

type Regime = "FORFETTARIO" | "ORDINARIO";

type Annualita = {
  id: string;
  anno: number;
  ricavi_annualita_precedente: number;
  regime: Regime;
};

function numEuro(v: any) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  const s = String(v).trim();
  if (!s) return 0;

  // gestisce "1.234,56" e "1234.56"
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function fmtEuro(n: any) {
  const x = Number(n);
  const v = Number.isFinite(x) ? x : 0;
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

export default function Annualita() {
  const nav = useNavigate();

  const [list, setList] = useState<Annualita[]>([]);
  const [anno, setAnno] = useState<number>(new Date().getFullYear());
  const [ricaviPrec, setRicaviPrec] = useState<string>("");
  const [regime, setRegime] = useState<Regime>("ORDINARIO");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ stato edit
  const [editing, setEditing] = useState<Annualita | null>(null);

  const [openCreate, setOpenCreate] = useState(false);

  const suggestedYears = useMemo(() => {
    const y = new Date().getFullYear();
    return [y + 1, y, y - 1].filter((v, i, a) => a.indexOf(v) === i);
  }, []);

  // forza ORDINARIO se > 85k
  useEffect(() => {
    const r = numEuro(ricaviPrec);
    if (r > 85000 && regime !== "ORDINARIO") setRegime("ORDINARIO");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ricaviPrec]);

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
      .select("id, anno, ricavi_annualita_precedente, regime")
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

  // ✅ quando entro in modalità modifica, precompilo i campi
  useEffect(() => {
    if (!openCreate) return;

    if (editing) {
      setAnno(editing.anno);
      setRicaviPrec(String(editing.ricavi_annualita_precedente ?? 0));
      setRegime(editing.regime);
    }
  }, [openCreate, editing]);

  // ✅ Salva annualità (CREATE o UPDATE)
  const saveAnnualita = async () => {
    setError(null);

    if (!Number.isFinite(anno) || anno < 1900 || anno > 2100) {
      setError("Inserisci un anno valido (1900–2100).");
      return;
    }

    const ricavi_annualita_precedente = numEuro(ricaviPrec);
    if (ricavi_annualita_precedente < 0) {
      setError(
        "I ricavi dell'annualità precedente non possono essere negativi.",
      );
      return;
    }

    const regimeFinale: Regime =
      ricavi_annualita_precedente > 85000 ? "ORDINARIO" : regime;

    setCreating(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setCreating(false);
      nav("/login");
      return;
    }

    if (editing) {
      // ✅ UPDATE
      const { error: updErr } = await supabase
        .from("annualita")
        .update({
          anno,
          ricavi_annualita_precedente,
          regime: regimeFinale,
        })
        .eq("id", editing.id);

      if (updErr) {
        setError(updErr.message);
        setCreating(false);
        return;
      }

      // opzionale: se vuoi tenere allineata anche la tabella ires
      await supabase
        .from("ires")
        .update({ ricavi_precedente: ricavi_annualita_precedente })
        .eq("annualita_id", editing.id);

      setCreating(false);
      setOpenCreate(false);
      setEditing(null);
      await loadAnnualita();
      return;
    }

    // ✅ CREATE
    const { data: inserted, error: insErr } = await supabase
      .from("annualita")
      .insert({
        user_id: userData.user.id,
        anno,
        ricavi_annualita_precedente,
        regime: regimeFinale,
      })
      .select("id")
      .single();

    if (insErr) {
      setError("Annualità già esistente oppure errore di salvataggio.");
      setCreating(false);
      return;
    }

    // ✅ crea riga ires collegata (se ti serve sempre)
    if (inserted?.id) {
      await supabase.from("ires").insert({
        annualita_id: inserted.id,
        ricavi_precedente: ricavi_annualita_precedente,
      });
    }

    setCreating(false);
    setOpenCreate(false);
    await loadAnnualita();
  };

  // ✅ Seleziona annualità (apri workspace)
  const selectAnnualita = (a: Annualita) => {
    localStorage.setItem("annualita_id", a.id);
    localStorage.setItem("annualita_anno", String(a.anno));
    localStorage.setItem("annualita_regime", a.regime);
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

  const miniBtnStyle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#fff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };

  const ricaviNum = numEuro(ricaviPrec);
  const under85k = ricaviNum <= 85000;

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
            <button
              onClick={() => nav("/profilo")}
              style={iconBtn}
              title="Profilo"
              aria-label="Profilo"
            >
              <User size={18} />
            </button>

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
                            fontWeight: 800,
                            marginTop: 4,
                          }}
                        >
                          Ricavi prec.: {fmtEuro(a.ricavi_annualita_precedente)}
                          {" · "}
                          Regime:{" "}
                          {a.regime === "FORFETTARIO"
                            ? "Forfettario"
                            : "Ordinario"}
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

                      {/* ✅ azioni: Modifica + Elimina */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          title="Modifica"
                          aria-label={`Modifica annualità ${a.anno}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditing(a);
                            setOpenCreate(true);
                          }}
                          style={{ ...miniBtnStyle, color: "#2563eb" }}
                        >
                          <Pencil size={18} />
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
                          style={{ ...miniBtnStyle, color: "#6b7280" }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
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
            onClick={() => {
              setEditing(null);
              setAnno(new Date().getFullYear());
              setRicaviPrec("");
              setRegime("ORDINARIO");
              setOpenCreate(true);
            }}
            type="button"
            aria-label="Crea nuova annualità"
          >
            +
          </button>
        )}

        {/* MODALE CREATE/EDIT */}
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
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
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
                maxHeight: "calc(100vh - 24px)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ padding: 14, borderBottom: "1px solid #e5e7eb" }}>
                <div style={{ fontWeight: 950, color: "#111827" }}>
                  {editing ? "Modifica annualità" : "Nuova annualità"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  Inserisci anno, ricavi dell’anno precedente e seleziona il
                  regime (se consentito).
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  display: "grid",
                  gap: 12,
                  overflowY: "auto",
                }}
              >
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

                {/* Ricavi annualità precedente */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div
                    style={{ fontSize: 12, color: "#374151", fontWeight: 900 }}
                  >
                    Ricavi annualità precedente
                  </div>

                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Es. 35.000,00"
                    value={ricaviPrec}
                    onChange={(e) => setRicaviPrec(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 12px",
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      fontWeight: 900,
                      outline: "none",
                    }}
                    aria-label="Ricavi annualità precedente"
                  />

                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Soglia: 85.000 € (se superata, il regime ordinario è
                    obbligatorio).
                  </div>
                </div>

                {/* Regime: condizionale */}
                {under85k ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#374151",
                        fontWeight: 900,
                      }}
                    >
                      Regime fiscale
                    </div>

                    {/* Opzione FORFETTARIO */}
                    <button
                      type="button"
                      onClick={() => setRegime("FORFETTARIO")}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        background:
                          regime === "FORFETTARIO" ? "#eff6ff" : "#fff",
                        padding: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        cursor: "pointer",
                      }}
                      aria-label="Seleziona regime forfettario"
                    >
                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={{ fontWeight: 950, color: "#111827" }}>
                          Regime forfettario
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            fontWeight: 700,
                          }}
                        >
                          Semplificato (se consentito sotto soglia).
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={regime === "FORFETTARIO"}
                        onChange={() => setRegime("FORFETTARIO")}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                        aria-label="Checkbox forfettario"
                      />
                    </button>

                    {/* Opzione ORDINARIO */}
                    <button
                      type="button"
                      onClick={() => setRegime("ORDINARIO")}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        background: regime === "ORDINARIO" ? "#eff6ff" : "#fff",
                        padding: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        cursor: "pointer",
                      }}
                      aria-label="Seleziona regime ordinario"
                    >
                      <div style={{ display: "grid", gap: 2 }}>
                        <div style={{ fontWeight: 950, color: "#111827" }}>
                          Regime ordinario
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6b7280",
                            fontWeight: 700,
                          }}
                        >
                          Gestione completa (obbligatorio oltre 85.000 €).
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={regime === "ORDINARIO"}
                        onChange={() => setRegime("ORDINARIO")}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                        aria-label="Checkbox ordinario"
                      />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#374151",
                        fontWeight: 900,
                      }}
                    >
                      Regime fiscale
                    </div>
                    <div
                      style={{
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 14,
                        fontWeight: 950,
                        color: "#111827",
                        background: "#f9fafb",
                      }}
                    >
                      Regime ordinario (obbligatorio oltre 85.000 €)
                    </div>
                  </div>
                )}

                <PrimaryButton onClick={saveAnnualita} disabled={creating}>
                  {creating
                    ? editing
                      ? "Salvataggio…"
                      : "Creazione…"
                    : editing
                      ? "Salva modifiche"
                      : "Crea annualità"}
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
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (creating) return;
                    setOpenCreate(false);
                    setEditing(null);
                  }}
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
