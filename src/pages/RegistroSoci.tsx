import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";

type Socio = {
  id: string;
  numero: number;
  nome: string;
  cognome: string;
  data_nascita: string | null;
  luogo_nascita: string | null;
  residenza: string | null;
};

type QuotaRow = {
  id: string;
  socio_id: string;
  annualita_id: string;
  versata: boolean;
  data_versamento: string | null;
  importo: number | null;
};

function onlyDateISO(v: string) {
  // input type="date" già in YYYY-MM-DD
  return v || null;
}

export default function RegistroSoci() {
  const annualitaId = localStorage.getItem("annualita_id");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [soci, setSoci] = useState<Socio[]>([]);
  const [quoteMap, setQuoteMap] = useState<Record<string, QuotaRow | undefined>>(
    {},
  );

  // modal create/edit
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Socio | null>(null);

  // form socio
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [dataNascita, setDataNascita] = useState<string>("");
  const [luogoNascita, setLuogoNascita] = useState("");
  const [residenza, setResidenza] = useState("");

  const resetForm = () => {
    setNome("");
    setCognome("");
    setDataNascita("");
    setLuogoNascita("");
    setResidenza("");
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const openEdit = (s: Socio) => {
    setEditing(s);
    setNome(s.nome || "");
    setCognome(s.cognome || "");
    setDataNascita(s.data_nascita || "");
    setLuogoNascita(s.luogo_nascita || "");
    setResidenza(s.residenza || "");
    setOpen(true);
  };

  const loadAll = async () => {
    setError(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Utente non autenticato.");
      setLoading(false);
      return;
    }

    // 1) soci (stabili)
    const { data: sociData, error: sociErr } = await supabase
      .from("soci")
      .select("id, numero, nome, cognome, data_nascita, luogo_nascita, residenza")
      .order("numero", { ascending: true });

    if (sociErr) {
      setError(sociErr.message);
      setLoading(false);
      return;
    }

    const sociRows = (sociData || []) as Socio[];
    setSoci(sociRows);

    // 2) quote per annualità selezionata
    if (!annualitaId) {
      setQuoteMap({});
      setLoading(false);
      return;
    }

    const { data: qData, error: qErr } = await supabase
      .from("quote_associative")
      .select("id, socio_id, annualita_id, versata, data_versamento, importo")
      .eq("annualita_id", annualitaId);

    if (qErr) {
      setError(qErr.message);
      setLoading(false);
      return;
    }

    const map: Record<string, QuotaRow> = {};
    (qData || []).forEach((r: any) => {
      map[r.socio_id] = r as QuotaRow;
    });
    setQuoteMap(map);

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualitaId]);

  const saveSocio = async () => {
    setError(null);

    const n = nome.trim();
    const c = cognome.trim();
    if (!n || !c) {
      setError("Nome e cognome sono obbligatori.");
      return;
    }

    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      setError("Utente non autenticato.");
      return;
    }

    const payload = {
      nome: n,
      cognome: c,
      data_nascita: dataNascita ? onlyDateISO(dataNascita) : null,
      luogo_nascita: luogoNascita.trim() || null,
      residenza: residenza.trim() || null,
    };

    if (editing) {
      const { error: updErr } = await supabase
        .from("soci")
        .update(payload)
        .eq("id", editing.id);

      if (updErr) {
        setError(updErr.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insErr } = await supabase.from("soci").insert({
        user_id: userData.user.id,
        ...payload,
        // numero viene assegnato dal trigger
      });

      if (insErr) {
        setError(insErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setOpen(false);
    setEditing(null);
    await loadAll();
  };

  const toggleQuota = async (socioId: string, next: boolean) => {
    if (!annualitaId) {
      setError("Annualità non selezionata.");
      return;
    }

    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Utente non autenticato.");
      return;
    }

    const existing = quoteMap[socioId];

    // se spunto "SI" imposto anche data versamento a oggi (opzionale)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayISO = `${yyyy}-${mm}-${dd}`;

    const payload = {
      versata: next,
      data_versamento: next ? todayISO : null,
    };

    if (existing) {
      const { error } = await supabase
        .from("quote_associative")
        .update(payload)
        .eq("id", existing.id);

      if (error) {
        setError(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("quote_associative").insert({
        user_id: userData.user.id,
        socio_id: socioId,
        annualita_id: annualitaId,
        ...payload,
      });

      if (error) {
        setError(error.message);
        return;
      }
    }

    await loadAll();
  };

  const fabStyle: React.CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: 84,
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
    zIndex: 200,
    fontSize: 28,
    lineHeight: 1,
  };

  const quotaBadge = (socioId: string) => {
    const q = quoteMap[socioId];
    if (!annualitaId) return <Badge>—</Badge>;
    if (q?.versata) return <Badge tone="green">SI</Badge>;
    return <Badge tone="blue">NO</Badge>;
  };

  const modalTitle = useMemo(
    () => (editing ? "Modifica socio" : "Nuovo socio"),
    [editing],
  );

  return (
    <Layout>
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">Registro Soci</h2>
          <div className="pageHelp">
            L’elenco è unico. La quota associativa si aggiorna in base
            all’annualità selezionata.
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      <Card title="Elenco soci">
        {loading ? (
          <div style={{ color: "#6b7280", fontWeight: 700 }}>Caricamento…</div>
        ) : soci.length === 0 ? (
          <div style={{ color: "#6b7280", fontWeight: 700 }}>
            Nessun socio inserito. Tocca “+” per aggiungerne uno.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {soci.map((s) => (
              <div
                key={s.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  background: "#fff",
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, color: "#111827" }}>
                    #{s.numero} · {s.cognome} {s.nome}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                    {s.data_nascita ? `Nato/a il ${s.data_nascita}` : "—"}
                    {s.luogo_nascita ? ` · ${s.luogo_nascita}` : ""}
                    {s.residenza ? ` · Res.: ${s.residenza}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "grid", justifyItems: "end", gap: 6 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
                      Quota {annualitaId ? "annuale" : "(seleziona annualità)"}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {quotaBadge(s.id)}
                      {annualitaId && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => toggleQuota(s.id, !(quoteMap[s.id]?.versata ?? false))}
                          title="Cambia stato quota"
                        >
                          Cambia
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => openEdit(s)}
                    title="Modifica socio"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* FAB */}
      <button style={fabStyle} onClick={openCreate} type="button" aria-label="Aggiungi socio">
        +
      </button>

      {/* MODALE */}
      {open && (
        <div
          onClick={() => !saving && setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: 12,
            zIndex: 99999,
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
              <div style={{ fontWeight: 950, color: "#111827" }}>{modalTitle}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Inserisci i dati anagrafici del socio.
              </div>
            </div>

            <div style={{ padding: 14, display: "grid", gap: 12, overflowY: "auto" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 900 }}>Nome *</div>
                <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 900 }}>Cognome *</div>
                <input className="input" value={cognome} onChange={(e) => setCognome(e.target.value)} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 900 }}>Data di nascita</div>
                <input
                  className="input"
                  type="date"
                  value={dataNascita}
                  onChange={(e) => setDataNascita(e.target.value)}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 900 }}>Luogo di nascita</div>
                <input className="input" value={luogoNascita} onChange={(e) => setLuogoNascita(e.target.value)} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#374151", fontWeight: 900 }}>Residenza</div>
                <input className="input" value={residenza} onChange={(e) => setResidenza(e.target.value)} />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <PrimaryButton onClick={saveSocio} disabled={saving}>
                  {saving ? "Salvataggio…" : editing ? "Salva modifiche" : "Crea socio"}
                </PrimaryButton>
                <SecondaryButton onClick={() => !saving && setOpen(false)}>
                  Annulla
                </SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
