import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, Euro, PrimaryButton } from "../components/ui";

type RfRow = {
  id: string;
  nome: string;
  descrizione: string | null;
};

type Movimento = {
  id: string;
  tipologia: "ENTRATA" | "USCITA";
  data: string;
  macro: string;
  descrizione_code: number | null;
  descrizione_label: string | null;

  descrizione_operazione?: string | null;
  descrizione_libera?: string | null;

  importo: number;
  iva: number;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function bestDescr(m: Movimento) {
  const a = (m.descrizione_label || "").trim();
  const b = ((m.descrizione_operazione as any) || "").trim();
  const c = ((m.descrizione_libera as any) || "").trim();
  return a || b || c || "—";
}

function EuroFmt({ v }: { v: number }) {
  const n = Number.isFinite(v) ? v : 0;
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>€ {n.toFixed(2)}</span>
  );
}

function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button title={title} onClick={onClick} className="iconBtn" type="button">
      {children}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 6h18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6V4h8v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function RaccolteFondi() {
  const annualitaId = localStorage.getItem("annualita_id");

  const [error, setError] = useState<string | null>(null);

  // lista
  const [items, setItems] = useState<RfRow[]>([]);

  // creazione/modifica (bottom sheet)
  const [openModal, setOpenModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descr, setDescr] = useState("");

  // dettaglio (MODALE FULLSCREEN)
  const [active, setActive] = useState<RfRow | null>(null);

  // movimenti disponibili/assegnati
  const [availEntrate, setAvailEntrate] = useState<Movimento[]>([]);
  const [availUscite, setAvailUscite] = useState<Movimento[]>([]);
  const [assEntrate, setAssEntrate] = useState<Movimento[]>([]);
  const [assUscite, setAssUscite] = useState<Movimento[]>([]);

  // selezione multipla
  const [selEntrate, setSelEntrate] = useState<Record<string, boolean>>({});
  const [selUscite, setSelUscite] = useState<Record<string, boolean>>({});

  // costi generali imputati per Raccolte Fondi (mappa per rfId)
  const [cgMap, setCgMap] = useState<Record<string, number>>({});

  // =========================
  // STILI NO-ELLIPSIS
  // =========================
  const noEllipsis: React.CSSProperties = {
    whiteSpace: "normal",
    overflow: "visible",
    textOverflow: "clip",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    minWidth: 0,
  };

  // =========================
  // MODALE FULLSCREEN STYLES (come AIG)
  // =========================
  const fullModalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    zIndex: 9999,
    display: "flex",
  };

  const fullModalSheet: React.CSSProperties = {
    background: "#fff",
    width: "100%",
    height: "100%",
    borderRadius: 0,
    overflow: "auto",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 120,
  };

  // helper per far andare le Card a filo schermo nel modale
  const fullBleed: React.CSSProperties = {
    marginLeft: -14,
    marginRight: -14,
  };

  // blocca scroll body quando modale dettaglio aperto
  useEffect(() => {
    if (active) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  // =========================
  // CARD MOVIMENTO DISPONIBILE (checkbox)
  // =========================
  const AvailableMoveCard = ({
    m,
    tone,
    macroLabelTxt,
    checked,
    onToggle,
  }: {
    m: Movimento;
    tone: "green" | "red";
    macroLabelTxt: string;
    checked: boolean;
    onToggle: (v: boolean) => void;
  }) => {
    const isEntrata = m.tipologia === "ENTRATA";
    const title = (m.descrizione_label || "").trim() || bestDescr(m);
    const sub = (m.descrizione_operazione || "").trim() || "—";

    return (
      <label
        className="listRow"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "start",
          columnGap: 12,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          style={{
            width: 18,
            height: 18,
            marginTop: 6,
            cursor: "pointer",
            flex: "0 0 auto",
          }}
        />

        <div className="rowMain" style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 850,
              opacity: 0.7,
              marginBottom: 8,
              ...noEllipsis,
            }}
          >
            {fmtDate(m.data)}
          </div>

          <div className="rowMeta" style={{ marginTop: 0, marginBottom: 8 }}>
            <Badge tone={tone as any}>{isEntrata ? "Entrata" : "Uscita"}</Badge>
            <Badge tone="neutral">{macroLabelTxt}</Badge>
          </div>

          <div className="rowTitle" style={noEllipsis}>
            {title}
          </div>
          <div className="rowSub" style={noEllipsis}>
            {sub}
          </div>
        </div>

        <div
          className="rowAmount"
          style={{
            justifySelf: "end",
            textAlign: "right",
            fontWeight: 950,
            paddingTop: 22,
          }}
        >
          <EuroFmt v={num(m.importo)} />
        </div>
      </label>
    );
  };

  // =========================
  // CARD MOVIMENTO ASSEGNATO (con cestino "stacca")
  // =========================
  const AssignedMoveCard = ({
    m,
    tone,
    macroLabelTxt,
    onUnassign,
  }: {
    m: Movimento;
    tone: "green" | "red";
    macroLabelTxt: string;
    onUnassign: (id: string) => void;
  }) => {
    const isEntrata = m.tipologia === "ENTRATA";
    const title = (m.descrizione_label || "").trim() || bestDescr(m);
    const sub = (m.descrizione_operazione || "").trim() || "—";

    return (
      <div
        className="listRow"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "start",
          columnGap: 12,
        }}
      >
        <div className="rowMain" style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 850,
              opacity: 0.7,
              marginBottom: 8,
              ...noEllipsis,
            }}
          >
            {fmtDate(m.data)}
          </div>

          <div className="rowMeta" style={{ marginTop: 0, marginBottom: 8 }}>
            <Badge tone={tone as any}>{isEntrata ? "Entrata" : "Uscita"}</Badge>
            <Badge tone="neutral">{macroLabelTxt}</Badge>
          </div>

          <div className="rowTitle" style={noEllipsis}>
            {title}
          </div>
          <div className="rowSub" style={noEllipsis}>
            {sub}
          </div>
        </div>

        <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
          <div
            className="rowAmount"
            style={{ justifySelf: "end", textAlign: "right", fontWeight: 950 }}
          >
            <EuroFmt v={num(m.importo)} />
          </div>

          <button
            className="iconBtn"
            type="button"
            title="Rimuovi assegnazione (torna tra disponibili)"
            onClick={() => onUnassign(m.id)}
            aria-label="Rimuovi assegnazione"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    );
  };

  // =========================
  // LOAD LISTA
  // =========================
  const loadItems = async () => {
    setError(null);
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("raccolte_fondi")
      .select("id, nome, descrizione")
      .eq("annualita_id", annualitaId)
      .order("nome", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setItems((data || []) as RfRow[]);
  };

  // carica mappa costi generali imputati (per tutte le RF)
  const loadCostiGeneraliMap = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("v_costi_generali_imputati")
      .select("allocated_to_id, costi_generali_imputati")
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "RACCOLTE_FONDI");

    if (error) {
      setError(error.message);
      return;
    }

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

  // =========================
  // MODAL CREA/MODIFICA (bottom sheet)
  // =========================
  const openCreate = () => {
    setEditMode(false);
    setEditingId(null);
    setNome("");
    setDescr("");
    setOpenModal(true);
  };

  const closeModal = () => {
    setOpenModal(false);
    setEditMode(false);
    setEditingId(null);
  };

  // =========================
  // CREA / UPDATE
  // =========================
  const saveItem = async () => {
    setError(null);
    if (!annualitaId) return;

    const n = nome.trim();
    if (!n) return alert("Nome obbligatorio");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return alert("Utente non autenticato");

    if (!editMode) {
      const { error } = await supabase.from("raccolte_fondi").insert({
        user_id: userData.user.id,
        annualita_id: annualitaId,
        nome: n,
        descrizione: descr.trim() || null,
      });

      if (error) {
        alert(error.message);
        return;
      }
    } else {
      if (!editingId) return;

      const { error } = await supabase
        .from("raccolte_fondi")
        .update({
          nome: n,
          descrizione: descr.trim() || null,
        })
        .eq("id", editingId);

      if (error) {
        alert(error.message);
        return;
      }

      // se sto modificando quella attiva, aggiorno anche la view del dettaglio
      setActive((p) =>
        p && p.id === editingId
          ? { ...p, nome: n, descrizione: descr.trim() || null }
          : p,
      );
    }

    closeModal();
    loadItems();
    loadCostiGeneraliMap();
  };

  // =========================
  // DELETE (libera movimenti + cancella)
  // =========================
  const deleteItem = async (id: string) => {
    const ok = confirm(
      "Vuoi eliminare questa Raccolta Fondi? I movimenti assegnati torneranno disponibili.",
    );
    if (!ok) return;

    const { error: unErr } = await supabase.rpc(
      "unassign_movimenti_for_activity",
      {
        p_type: "RACCOLTE_FONDI",
        p_id: id,
      },
    );

    if (unErr) {
      alert("Errore sblocco movimenti: " + unErr.message);
      return;
    }

    const { error } = await supabase
      .from("raccolte_fondi")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    if (active?.id === id) setActive(null);
    loadItems();
    loadCostiGeneraliMap();
  };

  // =========================
  // DETTAGLIO: carica movimenti
  // =========================
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

  const openItem = async (it: RfRow) => {
    setActive(it);
    await loadMovimentiForItem(it.id);
    await loadCostiGeneraliMap();
  };

  // rimuove assegnazione singolo movimento
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

    if (error) {
      alert(error.message);
      return;
    }

    await loadMovimentiForItem(active.id);
    await loadCostiGeneraliMap();
  };

  // =========================
  // ASSEGNA SELEZIONATI
  // =========================
  const assignSelected = async (kind: "ENTRATA" | "USCITA") => {
    if (!active) return;

    const selectedIds = Object.entries(
      kind === "ENTRATA" ? selEntrate : selUscite,
    )
      .filter(([, v]) => v)
      .map(([id]) => id);

    if (selectedIds.length === 0) return alert("Seleziona almeno un movimento");

    for (const id of selectedIds) {
      const { error } = await supabase
        .from("movimenti")
        .update({
          allocated_to_type: "RACCOLTE_FONDI",
          allocated_to_id: active.id,
        })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }
    }

    await loadMovimentiForItem(active.id);
    await loadCostiGeneraliMap();
  };

  // =========================
  // TOTALI
  // =========================
  const totEntrate = useMemo(
    () => assEntrate.reduce((s, m) => s + num(m.importo), 0),
    [assEntrate],
  );
  const totUscite = useMemo(
    () => assUscite.reduce((s, m) => s + num(m.importo), 0),
    [assUscite],
  );

  const cgImputati = useMemo(() => {
    if (!active) return 0;
    return num(cgMap[active.id] ?? 0);
  }, [active, cgMap]);

  const totUsciteEff = useMemo(
    () => totUscite + cgImputati,
    [totUscite, cgImputati],
  );

  const row2Cols: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "start",
    columnGap: 12,
  };

  return (
    <Layout>
      {/* HEADER + FAB */}
      <div className="pageHeader" style={{ paddingTop: 10 }}>
        <div>
          <h2 className="pageTitle">Raccolte Fondi</h2>
          <div className="pageHelp">
            Crea le Raccolte Fondi occasionali che l'Ente ha organizzato e
            gestito nell'annualità di riferimento. Sono iniziative organizzate
            in occasione di celebrazioni, ricorrenze o campagne di
            sensibilizzazione (ad esempio, la vendita di uova di Pasqua in
            piazza o una cena di beneficenza una volta l'anno). Assegna a
            ciascuna Raccolta Fondi occasionale le entrate e le uscite sostenute
            per realizzarla.
            <br />
            <br />
            Qualora l’ETS acquisisca la qualifica di ente non commerciale,
            laddove le raccolte fondi non prevedano la vendita di beni o servizi
            (es. sollecitazione donazioni, lasciti testamentari, ecc.) e,
            dunque, non vi sia sotteso alcun rapporto sinallagmatico, esse
            devono considerarsi non commerciali,{" "}
            <u>
              indipendentemente dalla frequenza (quindi dall’occasionalità o
              meno) e dalle modalità (anche se non in concomitanza con
              celebrazioni, ricorrenze o campagne di sensibilizzazione) con cui
              sono realizzate.
            </u>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      <button
        className="fab"
        onClick={openCreate}
        type="button"
        aria-label="Nuova raccolta fondi"
      >
        +
      </button>

      {/* MODAL crea/modifica (bottom sheet) */}
      {openModal && (
        <div className="sheetOverlay" onClick={closeModal}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheetHandle" />

            <div className="sheetHeader">
              <div className="sheetTitle">
                {editMode ? "Modifica Raccolta Fondi" : "Crea Raccolta Fondi"}
              </div>

              <button className="btn" type="button" onClick={closeModal}>
                Chiudi
              </button>
            </div>

            <div className="sheetGrid" style={{ gap: 12 }}>
              <div>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>
                  Nome (obbligatorio)
                </div>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="input"
                  placeholder="Es. Lotteria, Cena solidale..."
                />
              </div>

              <div>
                <div style={{ fontWeight: 950, marginBottom: 6 }}>
                  Descrizione
                </div>
                <input
                  value={descr}
                  onChange={(e) => setDescr(e.target.value)}
                  className="input"
                  placeholder="Descrizione sintetica (opzionale)"
                />
              </div>

              <button
                className="btn btn--primary btn--block"
                type="button"
                onClick={saveItem}
              >
                {editMode ? "Salva modifiche" : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ELENCO */}
      <div className="section">
        <div className="sectionTitle">Elenco Raccolte Fondi</div>

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
                style={row2Cols}
                onClick={() => openItem(it)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openItem(it);
                }}
              >
                <div className="rowMain" style={{ minWidth: 0 }}>
                  <div className="rowTitle" style={noEllipsis}>
                    {it.nome}
                  </div>

                  <div
                    className="rowSub"
                    style={{ marginTop: 6, ...noEllipsis }}
                  >
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

      {/* DETTAGLIO (MODALE FULLSCREEN) */}
      {active && (
        <div
          className="sheetOverlay"
          style={fullModalOverlay}
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="sheet"
            style={fullModalSheet}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header sticky */}
            <div
              className="sheetHeader"
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "#fff",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div className="sheetTitle" style={{ fontWeight: 950 }}>
                {active.nome}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setActive(null)}
                >
                  Chiudi
                </button>
              </div>
            </div>

            <div style={{ padding: 14 }}>
              {active.descrizione && (
                <div style={{ marginTop: 10, ...noEllipsis }}>
                  {active.descrizione}
                </div>
              )}

              <div className="mt-3" />

              {/* CARD A FILO SCHERMO */}
              <div style={fullBleed}>
                <Card title="Movimenti disponibili (non assegnati)">
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
                            <AvailableMoveCard
                              key={m.id}
                              m={m}
                              tone="green"
                              macroLabelTxt="Raccolte Fondi"
                              checked={!!selEntrate[m.id]}
                              onToggle={(v) =>
                                setSelEntrate((p) => ({
                                  ...p,
                                  [m.id]: v,
                                }))
                              }
                            />
                          ))}
                        </div>
                      )}

                      <div className="panelActions">
                        <PrimaryButton
                          onClick={() => assignSelected("ENTRATA")}
                          className="btn--block"
                        >
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
                            <AvailableMoveCard
                              key={m.id}
                              m={m}
                              tone="red"
                              macroLabelTxt="Raccolte Fondi"
                              checked={!!selUscite[m.id]}
                              onToggle={(v) =>
                                setSelUscite((p) => ({
                                  ...p,
                                  [m.id]: v,
                                }))
                              }
                            />
                          ))}
                        </div>
                      )}

                      <div className="panelActions">
                        <PrimaryButton
                          onClick={() => assignSelected("USCITA")}
                          className="btn--block"
                        >
                          Assegna Uscite selezionate
                        </PrimaryButton>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="mt-3" />

              <div style={fullBleed}>
                <Card title="Movimenti assegnati">
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
                            <AssignedMoveCard
                              key={m.id}
                              m={m}
                              tone="green"
                              macroLabelTxt="Raccolte Fondi"
                              onUnassign={unassignMovimento}
                            />
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
                            <AssignedMoveCard
                              key={m.id}
                              m={m}
                              tone="red"
                              macroLabelTxt="Raccolte Fondi"
                              onUnassign={unassignMovimento}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>

              <div className="mt-3" />

              <div style={fullBleed}>
                <Card title="Totali raccolta fondi">
                  <div
                    className="listRow"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      padding: "10px 0",
                    }}
                  >
                    <div className="rowMain">
                      <div className="rowTitle">Totale entrate assegnate</div>
                    </div>
                    <div
                      className="rowAmount"
                      style={{ justifySelf: "end", textAlign: "right" }}
                    >
                      <Euro v={totEntrate} />
                    </div>
                  </div>

                  <div
                    className="listRow"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      padding: "10px 0",
                    }}
                  >
                    <div className="rowMain">
                      <div className="rowTitle">Totale uscite assegnate</div>
                    </div>
                    <div
                      className="rowAmount"
                      style={{ justifySelf: "end", textAlign: "right" }}
                    >
                      <Euro v={totUscite} />
                    </div>
                  </div>

                  <div
                    className="listRow"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      padding: "10px 0",
                    }}
                  >
                    <div className="rowMain">
                      <div className="rowTitle">Costi generali imputati</div>
                    </div>
                    <div
                      className="rowAmount"
                      style={{ justifySelf: "end", textAlign: "right" }}
                    >
                      <Euro v={cgImputati} />
                    </div>
                  </div>

                  <div
                    className="listRow"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      padding: "10px 0",
                    }}
                  >
                    <div className="rowMain">
                      <div className="rowTitle">
                        Totale uscite effettive (incl. costi generali)
                      </div>
                    </div>
                    <div
                      className="rowAmount"
                      style={{ justifySelf: "end", textAlign: "right" }}
                    >
                      <Euro v={totUsciteEff} />
                    </div>
                  </div>
                </Card>
              </div>

              <div className="mt-3" />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
