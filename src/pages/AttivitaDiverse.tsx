import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Euro, Card, PrimaryButton } from "../components/ui";

type AttDivRow = {
  id: string;
  nome: string;
  descrizione: string | null;
  occasionale: boolean;
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

  importo: any; // può arrivare number o string
  iva: any; // può arrivare number o string
};

/** ✅ robusta: gestisce formati IT "1.234,56" e EN "1234.56" */
function num(v: any) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  let s = String(v).trim();
  if (!s) return 0;

  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** ✅ totale movimento LORDO = importo + iva */
function totaleMov(m: Movimento) {
  return num(m.importo) + num(m.iva);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = (d || "").split("-");
  if (!y || !m || !day) return d || "—";
  return `${day}/${m}/${y}`;
}

function macroLabel(m: string | null) {
  switch (m) {
    case "AIG":
      return "AIG";
    case "ATTIVITA_DIVERSE":
      return "Attività Diverse";
    case "RACCOLTE_FONDI":
      return "Raccolte Fondi";
    case "QUOTE_ASSOCIATIVE":
      return "Quote associative";
    case "EROGAZIONI_LIBERALI":
      return "Erogazioni liberali";
    case "PROVENTI_5X1000":
      return "5×1000";
    case "CONTRIBUTI_PA_SENZA_CORRISPETTIVO":
      return "Contributi PA";
    case "ALTRI_PROVENTI_NON_COMMERCIALI":
      return "Altri proventi NC";
    case "COSTI_GENERALI":
      return "Costi generali";
    default:
      return "—";
  }
}

function getDescrPair(m: Movimento) {
  const cod = (m.descrizione_label || "").trim();
  const op = ((m.descrizione_operazione as any) || "").trim();
  const lib = ((m.descrizione_libera as any) || "").trim();
  const oper = op || lib;
  return { cod: cod || "N/D", oper: oper || "—" };
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

export default function AttivitaDiverse() {
  const annualitaId = localStorage.getItem("annualita_id");

  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AttDivRow[]>([]);

  const [newNome, setNewNome] = useState("");
  const [newDescr, setNewDescr] = useState("");
  const [newOcc, setNewOcc] = useState(false);

  // ✅ dettaglio in modale fullscreen
  const [active, setActive] = useState<AttDivRow | null>(null);

  const [availEntrate, setAvailEntrate] = useState<Movimento[]>([]);
  const [availUscite, setAvailUscite] = useState<Movimento[]>([]);
  const [assEntrate, setAssEntrate] = useState<Movimento[]>([]);
  const [assUscite, setAssUscite] = useState<Movimento[]>([]);

  const [selEntrate, setSelEntrate] = useState<Record<string, boolean>>({});
  const [selUscite, setSelUscite] = useState<Record<string, boolean>>({});

  const [openSheet, setOpenSheet] = useState(false);

  // ✅ costi generali imputati per Attività Diverse
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

  // Layout helper
  const row2Cols: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "start",
    columnGap: 12,
  };

  // =========================
  // ✅ MODALE FULLSCREEN STYLES (come Raccolte Fondi)
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

  // ✅ helper per far andare le Card a filo schermo nel modale
  const fullBleed: React.CSSProperties = {
    marginLeft: -14,
    marginRight: -14,
  };

  // blocca scroll body quando modale aperto
  useEffect(() => {
    if (active) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [active]);

  // =========================
  // ✅ COMPONENTI “STILE RACCOLTE FONDI”
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
    const title = (m.descrizione_label || "").trim() || getDescrPair(m).cod;
    const sub =
      (m.descrizione_operazione || "").trim() ||
      (m.descrizione_libera || "").trim() ||
      "—";

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
          {/* ✅ LORDO = importo + iva */}
          <Euro v={totaleMov(m)} />
        </div>
      </label>
    );
  };

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
    const title = (m.descrizione_label || "").trim() || getDescrPair(m).cod;
    const sub =
      (m.descrizione_operazione || "").trim() ||
      (m.descrizione_libera || "").trim() ||
      "—";

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
            <Badge tone="yellow">{macroLabelTxt}</Badge>
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
            {/* ✅ LORDO = importo + iva */}
            <Euro v={totaleMov(m)} />
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
      .from("attivita_diverse")
      .select("id, nome, descrizione, occasionale")
      .eq("annualita_id", annualitaId)
      .order("nome", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setItems((data || []) as AttDivRow[]);
  };

  // ✅ carica mappa costi generali imputati
  const loadCostiGeneraliMap = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("v_costi_generali_imputati")
      .select("allocated_to_id, costi_generali_imputati")
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "ATTIVITA_DIVERSE");

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

  const createItem = async () => {
    setError(null);
    if (!annualitaId) return;

    const nome = newNome.trim();
    if (!nome) return alert("Nome obbligatorio");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return alert("Utente non autenticato");

    const { error } = await supabase.from("attivita_diverse").insert({
      user_id: userData.user.id,
      annualita_id: annualitaId,
      nome,
      descrizione: newDescr.trim() || null,
      occasionale: newOcc,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewNome("");
    setNewDescr("");
    setNewOcc(false);
    setOpenSheet(false);
    loadItems();
  };

  const updateOccasionale = async (id: string, occasionale: boolean) => {
    const { error } = await supabase
      .from("attivita_diverse")
      .update({ occasionale })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setActive((p) => (p ? { ...p, occasionale } : p));
    loadItems();
  };

  const deleteItem = async (id: string) => {
    const ok = confirm(
      "Vuoi eliminare questa Attività Diversa? I movimenti assegnati torneranno disponibili.",
    );
    if (!ok) return;

    const { error: unErr } = await supabase.rpc("unassign_movimenti_for_activity", {
      p_type: "ATTIVITA_DIVERSE",
      p_id: id,
    });

    if (unErr) {
      alert("Errore sblocco movimenti: " + unErr.message);
      return;
    }

    const { error } = await supabase.from("attivita_diverse").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    if (active?.id === id) setActive(null);
    loadItems();
  };

  // ✅ Rimuove assegnazione del singolo movimento
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

  const loadMovimentiForItem = async (attId: string) => {
    setError(null);
    if (!annualitaId) return;

    const baseSelect =
      "id, tipologia, data, macro, descrizione_code, descrizione_label, descrizione_operazione, descrizione_libera, importo, iva";

    const { data: ae, error: aeErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("macro", "ATTIVITA_DIVERSE")
      .eq("tipologia", "ENTRATA")
      .is("allocated_to_id", null)
      .neq("macro", "COSTI_GENERALI")
      .order("data", { ascending: true });

    if (aeErr) return setError(aeErr.message);

    const { data: au, error: auErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("macro", "ATTIVITA_DIVERSE")
      .eq("tipologia", "USCITA")
      .is("allocated_to_id", null)
      .neq("macro", "COSTI_GENERALI")
      .order("data", { ascending: true });

    if (auErr) return setError(auErr.message);

    const { data: se, error: seErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "ATTIVITA_DIVERSE")
      .eq("allocated_to_id", attId)
      .eq("tipologia", "ENTRATA")
      .order("data", { ascending: true });

    if (seErr) return setError(seErr.message);

    const { data: su, error: suErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "ATTIVITA_DIVERSE")
      .eq("allocated_to_id", attId)
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

  // ✅ apre MODALE dettaglio
  const openItem = async (it: AttDivRow) => {
    setActive(it);
    await loadMovimentiForItem(it.id);
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
        .update({
          allocated_to_type: "ATTIVITA_DIVERSE",
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

  // ✅ TOTALI: somma LORDO (importo+iva)
  const totEntrate = useMemo(
    () => assEntrate.reduce((s, m) => s + totaleMov(m), 0),
    [assEntrate],
  );

  const totUscite = useMemo(
    () => assUscite.reduce((s, m) => s + totaleMov(m), 0),
    [assUscite],
  );

  const cgImputati = useMemo(() => {
    if (!active) return 0;
    return num(cgMap[active.id] ?? 0);
  }, [active, cgMap]);

  const totUsciteEff = useMemo(() => totUscite + cgImputati, [totUscite, cgImputati]);

  return (
    <Layout>
      <div className="pageHeader" style={{ paddingTop: 10 }}>
        <div>
          <h2 className="pageTitle">Attività Diverse</h2>
          <div className="pageHelp">
            Crea le Attività Diverse di cui all'art. 6 del CTS e assegna a ciascuna
            attività le entrate e le uscite sostenute per la sua realizzazione.
            <br />
            <br />
            <u>
              Le attività diverse sono iniziative di natura commerciale (es. gestione
              di un punto ristoro/bar durante l'evento o affitto della propria sede a
              privati per feste di compleanno) che devono restare secondarie e
              strumentali rispetto alle attività di interesse generale.
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
        onClick={() => setOpenSheet(true)}
        type="button"
        aria-label="Nuova attività diversa"
      >
        +
      </button>

      {/* MODAL CREATE (bottom sheet) */}
      {openSheet && (
        <div onClick={() => setOpenSheet(false)} className="sheetOverlay">
          <div onClick={(e) => e.stopPropagation()} className="sheet">
            <div className="sheetHandle" />

            <div className="sheetHeader">
              <div className="sheetTitle">Crea Attività Diversa</div>
              <button className="btn" onClick={() => setOpenSheet(false)} type="button">
                Chiudi
              </button>
            </div>

            <div className="sheetGrid" style={{ gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Nome (obbligatorio)</div>
                <input
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  className="input"
                  placeholder="Es. Sponsorizzazioni, Merchandising..."
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>Descrizione (opzionale)</div>
                <input
                  value={newDescr}
                  onChange={(e) => setNewDescr(e.target.value)}
                  className="input"
                  placeholder="Descrizione sintetica"
                />
              </div>

              <div className="listRow" style={{ ...row2Cols, padding: "12px 14px" }}>
                <div className="rowMain">
                  <div className="rowTitle">Attività svolta occasionalmente</div>
                  <div className="rowSub">
                    Se spuntata: i ricavi NON si considerano nel test di commercialità dell’Ente.
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={newOcc}
                  onChange={(e) => setNewOcc(e.target.checked)}
                  className="checkBox"
                />
              </div>

              <button className="btn btn--primary btn--block" onClick={createItem} type="button">
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ELENCO */}
      <div className="section">
        <div className="sectionTitle">Elenco Attività Diverse</div>

        <div className="listBox">
          {items.length === 0 ? (
            <div className="listRow">
              <div className="rowMain">
                <div className="rowSub">Nessuna attività diversa creata</div>
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
                  <div className="rowSub" style={{ ...noEllipsis, marginTop: 6 }}>
                    {it.descrizione || "—"}
                  </div>

                  <div className="rowMeta" style={{ marginTop: 10 }}>
                    <Badge tone={it.occasionale ? "amber" : "green"}>
                      OCCASIONALE: {it.occasionale ? "SI" : "NO"}
                    </Badge>
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
          style={{ ...fullModalOverlay, width: "100vw", height: "100vh" }}
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="sheet" style={fullModalSheet} onClick={(e) => e.stopPropagation()}>
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

              <button className="btn" onClick={() => setActive(null)} type="button">
                Chiudi
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {active.descrizione && <div style={{ ...noEllipsis }}>{active.descrizione}</div>}

              <div style={{ marginTop: 10 }}>
                <Badge tone={active.occasionale ? "amber" : "green"}>
                  Occasionale: {active.occasionale ? "Sì" : "No"}
                </Badge>
              </div>

              <div className="mt-3" />

              {/* Flag occasionale (a filo schermo) */}
              <div style={fullBleed}>
                <div className="listBox">
                  <div className="listRow" style={row2Cols}>
                    <div className="rowMain">
                      <div className="rowTitle">Attività Diversa “Occasionale”</div>
                      <div className="rowSub">
                        Spuntare se l'attività è svolta in modo occasionale. In questo caso i
                        ricavi di questa attività <b>non</b> saranno considerati nel test di
                        commercialità dell’Ente.
                      </div>
                    </div>

                    <input
                      type="checkbox"
                      checked={active.occasionale}
                      onChange={(e) => updateOccasionale(active.id, e.target.checked)}
                      className="checkBox"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3" />

              {/* ✅ MOVIMENTI DISPONIBILI — STILE COME RACCOLTE FONDI */}
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
                              macroLabelTxt={macroLabel(m.macro)}
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
                              macroLabelTxt={macroLabel(m.macro)}
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

              {/* ✅ MOVIMENTI ASSEGNATI — STILE COME RACCOLTE FONDI */}
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
                              macroLabelTxt={macroLabel(m.macro)}
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
                              macroLabelTxt={macroLabel(m.macro)}
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

              {/* TOTALI — puoi lasciarli come erano (qui li lascio a “box” semplice) */}
              <div style={fullBleed}>
                <Card title="Totali attività diversa">
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
                    <div className="rowAmount" style={{ justifySelf: "end", textAlign: "right" }}>
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
                    <div className="rowAmount" style={{ justifySelf: "end", textAlign: "right" }}>
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
                    <div className="rowAmount" style={{ justifySelf: "end", textAlign: "right" }}>
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
                    <div className="rowAmount" style={{ justifySelf: "end", textAlign: "right" }}>
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
