// RaccolteFondi.tsx
import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, PrimaryButton, Euro } from "../components/ui";

type RfRow = {
  id: string;
  nome: string;
  descrizione: string | null;
  data: string | null; // DATE
};

type Movimento = {
  id: string;
  tipologia: "ENTRATA" | "USCITA";
  data: string | null;
  macro: string;
  descrizione_code: number | null;
  descrizione_label: string | null;

  descrizione_operazione?: string | null;
  descrizione_libera?: string | null;

  importo: any;
  iva: any;
};

function num(v: any) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  let s = String(v).trim();
  if (!s) return 0;

  s = s.replace(/[^\d,.\-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function totaleMov(m: Movimento) {
  return num(m.importo) + num(m.iva);
}

function dateParts(d: string | null) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { day: "—", mon: "" };
  const [, m, day] = d.split("-");
  const months = ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"];
  const mi = Math.max(1, Math.min(12, Number(m))) - 1;
  return { day, mon: months[mi] };
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function bestDescr(m: Movimento) {
  const a = (m.descrizione_label || "").trim();
  const b = (m.descrizione_operazione || "").trim();
  const c = (m.descrizione_libera || "").trim();
  return a || b || c || "—";
}

function MiniTag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "green" | "red" | "blue" | "amber" | "yellow" | "neutral";
}) {
  return (
    <span className={`miniTag ${tone ? `miniTag--${tone}` : "miniTag--neutral"}`}>
      {children}
    </span>
  );
}

function IconButton({
  title,
  onClick,
  children,
  className,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={className ? `iconBtn ${className}` : "iconBtn"}
      type="button"
    >
      {children}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RaccolteFondi() {
  const annualitaId = localStorage.getItem("annualita_id");

  const [error, setError] = useState<string | null>(null);

  // lista
  const [items, setItems] = useState<RfRow[]>([]);

  // create/edit (bottom sheet)
  const [openModal, setOpenModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descr, setDescr] = useState("");
  const [rfData, setRfData] = useState("");

  // dettaglio fullscreen
  const [active, setActive] = useState<RfRow | null>(null);

  // movimenti
  const [availEntrate, setAvailEntrate] = useState<Movimento[]>([]);
  const [availUscite, setAvailUscite] = useState<Movimento[]>([]);
  const [assEntrate, setAssEntrate] = useState<Movimento[]>([]);
  const [assUscite, setAssUscite] = useState<Movimento[]>([]);

  const [selEntrate, setSelEntrate] = useState<Record<string, boolean>>({});
  const [selUscite, setSelUscite] = useState<Record<string, boolean>>({});

  const [cgMap, setCgMap] = useState<Record<string, number>>({});

  // ====== STILI BASE ======
  const noEllipsis: React.CSSProperties = {
    whiteSpace: "normal",
    overflow: "visible",
    textOverflow: "clip",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    minWidth: 0,
  };

  const row2Cols: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "start",
    columnGap: 12,
  };

  // ====== MODALE FULLSCREEN (margini come AIG/Att.Diverse) ======
  const fullModalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 9999,
    display: "flex",
    overflow: "hidden",
  };

  const fullModalSheet: React.CSSProperties = {
    background: "#fff",
    width: "100%",
    height: "100%",
    borderRadius: 0,
    margin: 0,
    padding: 0,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 120,
  };

  const modalContainer: React.CSSProperties = {
    maxWidth: 1150,
    margin: "0 auto",
    padding: "0 20px",
  };

  // blocca scroll body
  useEffect(() => {
    if (active) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  // ====== MOVIMENTI (UGUALI ad Attività Diverse / AIG / Entrate-Uscite) ======
  const MovRowSelectable = ({
    m,
    checked,
    onToggle,
  }: {
    m: Movimento;
    checked: boolean;
    onToggle: (v: boolean) => void;
  }) => {
    const isEntrata = m.tipologia === "ENTRATA";
    const { day, mon } = dateParts(m.data);
    const title = (m.descrizione_label || "").trim() || bestDescr(m);
    const sub = (m.descrizione_operazione || "").trim() || "—";

    return (
      <label className="movRow" style={{ cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ width: 18, height: 18, marginRight: 10, alignSelf: "center" }}
        />

        <div className="movDate">
          <div className="movDay">{day}</div>
          <div className="movMon">{mon}</div>
        </div>

        <div className="movMain">
          <div className="movTop">
            <div className="movTags">
              <MiniTag tone={isEntrata ? "green" : "red"}>{isEntrata ? "Entrata" : "Uscita"}</MiniTag>
              <MiniTag tone="yellow">Raccolte Fondi</MiniTag>
            </div>
          </div>

          <div className="movTitle">{title}</div>
          <div className="movSub">{sub}</div>
        </div>

        <div className="movRight">
          <div className="movAmount">
            <Euro v={totaleMov(m)} />
          </div>
        </div>
      </label>
    );
  };

  const MovRowAssigned = ({ m }: { m: Movimento }) => {
    const isEntrata = m.tipologia === "ENTRATA";
    const { day, mon } = dateParts(m.data);
    const title = (m.descrizione_label || "").trim() || bestDescr(m);
    const sub = (m.descrizione_operazione || "").trim() || "—";

    return (
      <div className="movRow" role="group">
        <div className="movDate">
          <div className="movDay">{day}</div>
          <div className="movMon">{mon}</div>
        </div>

        <div className="movMain">
          <div className="movTop">
            <div className="movTags">
              <MiniTag tone={isEntrata ? "green" : "red"}>{isEntrata ? "Entrata" : "Uscita"}</MiniTag>
              <MiniTag tone="yellow">Raccolte Fondi</MiniTag>
            </div>
          </div>

          <div className="movTitle">{title}</div>
          <div className="movSub">{sub}</div>
        </div>

        <div className="movRight">
          <div className="movAmount">
            <Euro v={totaleMov(m)} />
          </div>

          <IconButton
            title="Rimuovi assegnazione"
            className="iconBtn--sm"
            onClick={(e) => {
              e.stopPropagation();
              unassignMovimento(m.id);
            }}
          >
            <TrashIcon />
          </IconButton>
        </div>
      </div>
    );
  };

  // ====== RIEPILOGO stile AIG ======
  const wrapRowBox: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "flex-start",
    padding: "10px 0",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
  };

  const wrapRowLabel: React.CSSProperties = {
    flex: "1 1 240px",
    minWidth: 0,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    lineHeight: 1.25,
    textTransform: "uppercase",
    fontWeight: 400,
  };

  const wrapRowValue: React.CSSProperties = {
    flex: "0 0 auto",
    marginLeft: "auto",
    textAlign: "right",
    whiteSpace: "nowrap",
    fontWeight: 950,
  };

  const WrapRowValue = ({ label, value }: { label: React.ReactNode; value: React.ReactNode }) => (
    <div style={wrapRowBox}>
      <div style={wrapRowLabel}>{label}</div>
      <div style={wrapRowValue}>{value}</div>
    </div>
  );

  // ====== LOAD LISTA ======
  const loadItems = async () => {
    setError(null);
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("raccolte_fondi")
      .select("id, nome, descrizione, data")
      .eq("annualita_id", annualitaId)
      .order("data", { ascending: false })
      .order("nome", { ascending: true });

    if (error) return setError(error.message);
    setItems((data || []) as RfRow[]);
  };

  const loadCostiGeneraliMap = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("v_costi_generali_imputati")
      .select("allocated_to_id, costi_generali_imputati")
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "RACCOLTE_FONDI");

    if (error) return setError(error.message);

    const m: Record<string, number> = {};
    for (const r of (data || []) as any[]) {
      const id = String(r.allocated_to_id || "");
      if (!id) continue;
      m[id] = num(r.costi_generali_imputati);
    }
    setCgMap(m);
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!annualitaId) return;
    loadCostiGeneraliMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualitaId, items.length]);

  // ====== CREATE / EDIT SHEET ======
  const openCreate = () => {
    setError(null);
    setEditMode(false);
    setEditingId(null);
    setNome("");
    setDescr("");
    setRfData("");
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditMode(false);
    setEditingId(null);
  };

  const saveItem = async () => {
    setError(null);
    if (!annualitaId) return;

    const n = nome.trim();
    if (!n) return alert("Nome obbligatorio");
    if (!rfData) return alert("Data obbligatoria");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return alert("Utente non autenticato");

    if (!editMode) {
      const { error } = await supabase.from("raccolte_fondi").insert({
        user_id: userData.user.id,
        annualita_id: annualitaId,
        nome: n,
        descrizione: descr.trim() || null,
        data: rfData,
      });
      if (error) return alert(error.message);
    } else {
      if (!editingId) return;
      const { error } = await supabase
        .from("raccolte_fondi")
        .update({
          nome: n,
          descrizione: descr.trim() || null,
          data: rfData,
        })
        .eq("id", editingId);

      if (error) return alert(error.message);

      setActive((p) =>
        p && p.id === editingId ? { ...p, nome: n, descrizione: descr.trim() || null, data: rfData } : p,
      );
    }

    closeModal();
    await loadItems();
    await loadCostiGeneraliMap();
  };

  const deleteItem = async (id: string) => {
    const ok = confirm("Vuoi eliminare questa Raccolta Fondi? I movimenti assegnati torneranno disponibili.");
    if (!ok) return;

    const { error: unErr } = await supabase.rpc("unassign_movimenti_for_activity", {
      p_type: "RACCOLTE_FONDI",
      p_id: id,
    });

    if (unErr) return alert("Errore sblocco movimenti: " + unErr.message);

    const { error } = await supabase.from("raccolte_fondi").delete().eq("id", id);
    if (error) return alert(error.message);

    if (active?.id === id) setActive(null);
    await loadItems();
    await loadCostiGeneraliMap();
  };

  // ====== DETTAGLIO: LOAD MOVIMENTI ======
  const loadMovimentiForItem = async (rfId: string) => {
    setError(null);
    if (!annualitaId) return;

    const baseSelect =
      "id, tipologia, data, macro, descrizione_code, descrizione_label, descrizione_operazione, descrizione_libera, importo, iva";

    const { data: ae, error: aeErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("macro", "RACCOLTE_FONDI")
      .eq("tipologia", "ENTRATA")
      .is("allocated_to_id", null)
      .neq("macro", "COSTI_GENERALI")
      .order("data", { ascending: true });

    if (aeErr) return setError(aeErr.message);

    const { data: au, error: auErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("macro", "RACCOLTE_FONDI")
      .eq("tipologia", "USCITA")
      .is("allocated_to_id", null)
      .neq("macro", "COSTI_GENERALI")
      .order("data", { ascending: true });

    if (auErr) return setError(auErr.message);

    const { data: se, error: seErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "RACCOLTE_FONDI")
      .eq("allocated_to_id", rfId)
      .eq("tipologia", "ENTRATA")
      .order("data", { ascending: true });

    if (seErr) return setError(seErr.message);

    const { data: su, error: suErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "RACCOLTE_FONDI")
      .eq("allocated_to_id", rfId)
      .eq("tipologia", "USCITA")
      .order("data", { ascending: true });

    if (suErr) return setError(suErr.message);

    setAvailEntrate((ae || []) as Movimento[]);
    setAvailUscite((au || []) as Movimento[]);
    setAssEntrate((se || []) as Movimento[]);
    setAssUscite((su || []) as Movimento[]);
    setSelEntrate({});
    setSelUscite({});
  };

  const openItem = (it: RfRow) => {
    setError(null);
    setOpenModal(false);
    setEditMode(false);
    setEditingId(null);

    setActive(it);

    void (async () => {
      await loadMovimentiForItem(it.id);
      await loadCostiGeneraliMap();
    })();
  };

  const unassignMovimento = async (movId: string) => {
    if (!active) return;

    const ok = confirm(
      "Vuoi rimuovere l’assegnazione di questo movimento?\n(Il movimento NON verrà eliminato e tornerà tra quelli disponibili.)",
    );
    if (!ok) return;

    const { error } = await supabase
      .from("movimenti")
      .update({ allocated_to_type: null, allocated_to_id: null })
      .eq("id", movId);

    if (error) return alert(error.message);

    await loadMovimentiForItem(active.id);
    await loadCostiGeneraliMap();
  };

  const assignSelected = async (kind: "ENTRATA" | "USCITA") => {
    if (!active) return;

    const selectedIds = Object.entries(kind === "ENTRATA" ? selEntrate : selUscite)
      .filter(([, v]) => v)
      .map(([id]) => id);

    if (selectedIds.length === 0) return alert("Seleziona almeno un movimento");

    for (const id of selectedIds) {
      const { error } = await supabase
        .from("movimenti")
        .update({ allocated_to_type: "RACCOLTE_FONDI", allocated_to_id: active.id })
        .eq("id", id);

      if (error) return alert(error.message);
    }

    await loadMovimentiForItem(active.id);
    await loadCostiGeneraliMap();
  };

  // ====== TOTALI (lordo) ======
  const totEntrate = useMemo(() => assEntrate.reduce((s, m) => s + totaleMov(m), 0), [assEntrate]);
  const totUscite = useMemo(() => assUscite.reduce((s, m) => s + totaleMov(m), 0), [assUscite]);

  const cgImputati = useMemo(() => {
    if (!active) return 0;
    return num(cgMap[active.id] ?? 0);
  }, [active, cgMap]);

  const totUsciteEff = useMemo(() => totUscite + cgImputati, [totUscite, cgImputati]);

  return (
    <Layout>
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">RACCOLTE FONDI</h2>
          <div className="pageHelp">
            Crea le Raccolte Fondi e assegna a ciascuna le entrate e le uscite sostenute per realizzarla.
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      <button className="fab" onClick={openCreate} type="button" aria-label="Nuova raccolta fondi">
        +
      </button>

      {/* SHEET CREATE/EDIT */}
      {openModal && (
        <div className="sheetOverlay" onClick={closeModal}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheetHandle" />

            <div className="sheetHeader">
              <div className="sheetTitle">{editMode ? "Modifica Raccolta Fondi" : "Crea Raccolta Fondi"}</div>
              <button className="btn" type="button" onClick={closeModal}>
                Chiudi
              </button>
            </div>

            <div className="sheetGrid" style={{ gap: 12 }}>
              <div>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>Nome (obbligatorio)</div>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input"
                  placeholder="Es. Lotteria, Cena solidale..."
                />
              </div>

              <div>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>Data (obbligatoria)</div>
                <input type="date" value={rfData} onChange={(e) => setRfData(e.target.value)} className="input" />
                <div className="rowSub" style={{ marginTop: 6 }}>
                  Verrà mostrata nell’elenco generale.
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>Descrizione</div>
                <input
                  value={descr}
                  onChange={(e) => setDescr(e.target.value)}
                  className="input"
                  placeholder="Descrizione sintetica (opzionale)"
                />
              </div>

              <button className="btn btn--primary btn--block" type="button" onClick={saveItem}>
                {editMode ? "Salva modifiche" : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ELENCO */}
      <div className="section">
        <div className="sectionTitle">ELENCO RACCOLTE FONDI</div>

        <div className="listBox">
          {items.length === 0 ? (
            <div className="listRow">
              <div className="rowMain">
                <div className="rowSub">Nessuna raccolta fondi creata</div>
              </div>
            </div>
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                role="button"
                tabIndex={0}
                className="listRow"
                style={{ ...row2Cols, cursor: "pointer" }}
                onClick={() => openItem(it)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openItem(it);
                }}
              >
                <div className="rowMain" style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 850, opacity: 0.7, marginBottom: 8, ...noEllipsis }}>
                    {fmtDate(it.data)}
                  </div>

                  <div className="rowTitle" style={noEllipsis}>
                    {it.nome}
                  </div>

                  <div className="rowSub" style={{ marginTop: 6, ...noEllipsis }}>
                    {it.descrizione || "—"}
                  </div>
                </div>

                <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                  <IconButton
                    title="Elimina"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteItem(it.id);
                    }}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* DETTAGLIO FULLSCREEN */}
      {active && (
        <div className="sheetOverlay" style={fullModalOverlay} onClick={() => setActive(null)} role="dialog" aria-modal="true">
          <div className="sheet" style={{ ...fullModalSheet, maxWidth: "none", margin: 0 }} onClick={(e) => e.stopPropagation()}>
            {/* HEADER sticky: titolo sx / chiudi dx + margini coerenti */}
            <div
              className="sheetHeader"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "rgba(246, 245, 241)",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div
                style={{
                  maxWidth: 1150,
                  margin: "0 auto",
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div className="sheetTitle" style={{ fontWeight: 950 }}>
                  {active.nome}
                </div>

                <button className="btn" type="button" onClick={() => setActive(null)}>
                  Chiudi
                </button>
              </div>
            </div>

            {/* BODY allineato */}
            <div style={modalContainer}>
              <div style={{ paddingTop: 14, paddingBottom: 24 }}>
                <div style={{ marginTop: 6 }}>
                  <Badge tone="neutral">DATA: {fmtDate(active.data)}</Badge>
                </div>

                {active.descrizione && <div style={{ marginTop: 10, ...noEllipsis }}>{active.descrizione}</div>}

                <div className="mt-3" />

                <Card title="MOVIMENTI NON ASSEGNATI">
                  <div className="splitGrid">
                    <div className="panel">
                      <div className="panelTitle">Entrate disponibili</div>

                      {availEntrate.length === 0 ? (
                        <div className="muted" style={{ fontWeight: 800 }}>
                          Nessuna
                        </div>
                      ) : (
                        <div className="movList listBox">
                          {availEntrate.map((m) => (
                            <MovRowSelectable
                              key={m.id}
                              m={m}
                              checked={!!selEntrate[m.id]}
                              onToggle={(v) => setSelEntrate((p) => ({ ...p, [m.id]: v }))}
                            />
                          ))}
                        </div>
                      )}

                      <div className="panelActions">
                        <PrimaryButton onClick={() => assignSelected("ENTRATA")} className="btn--block">
                          Assegna Entrate selezionate
                        </PrimaryButton>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panelTitle">Uscite disponibili</div>

                      {availUscite.length === 0 ? (
                        <div className="muted" style={{ fontWeight: 800 }}>
                          Nessuna
                        </div>
                      ) : (
                        <div className="movList listBox">
                          {availUscite.map((m) => (
                            <MovRowSelectable
                              key={m.id}
                              m={m}
                              checked={!!selUscite[m.id]}
                              onToggle={(v) => setSelUscite((p) => ({ ...p, [m.id]: v }))}
                            />
                          ))}
                        </div>
                      )}

                      <div className="panelActions">
                        <PrimaryButton onClick={() => assignSelected("USCITA")} className="btn--block">
                          Assegna Uscite selezionate
                        </PrimaryButton>
                      </div>
                    </div>
                  </div>
                </Card>

                <div className="mt-3" />

                <Card title="MOVIMENTI ASSEGNATI">
                  <div className="splitGrid">
                    <div className="panel">
                      <div className="panelTitle">Entrate assegnate</div>

                      {assEntrate.length === 0 ? (
                        <div className="muted" style={{ fontWeight: 800 }}>
                          Nessuna
                        </div>
                      ) : (
                        <div className="listBox movList">
                          {assEntrate.map((m) => (
                            <MovRowAssigned key={m.id} m={m} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="panel">
                      <div className="panelTitle">Uscite assegnate</div>

                      {assUscite.length === 0 ? (
                        <div className="muted" style={{ fontWeight: 800 }}>
                          Nessuna
                        </div>
                      ) : (
                        <div className="listBox movList">
                          {assUscite.map((m) => (
                            <MovRowAssigned key={m.id} m={m} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <div className="mt-3" />

                <Card title="TOTALE RACCOLTA FONDI">
                  <div style={noEllipsis}>
                    <WrapRowValue label={<span style={noEllipsis}>TOTALE ENTRATE ASSEGNATE</span>} value={<Euro v={totEntrate} />} />
                    <WrapRowValue label={<span style={noEllipsis}>TOTALE USCITE ASSEGNATE</span>} value={<Euro v={totUscite} />} />
                    <WrapRowValue label={<span style={noEllipsis}>COSTI GENERALI IMPUTATI</span>} value={<Euro v={cgImputati} />} />
                    <WrapRowValue
                      label={<span style={noEllipsis}>TOTALE USCITE EFFETTIVE (INCL. COSTI GENERALI)</span>}
                      value={<Euro v={totUsciteEff} />}
                    />
                  </div>
                </Card>

                <div className="mt-3" />
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
