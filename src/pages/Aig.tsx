import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";

type AigRow = {
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

  allocated_to_id?: string | null;
};

type EsitoAig = {
  TE: number;
  TU: number; // TU reale (uscite assegnate)
  CG: number; // costi generali imputati
  TU_EFF: number; // TU + CG
  TER: number;
  soglia: number;
  esito: "COMMERCIALE" | "NON COMMERCIALE";
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

function calcEsitoForMovimenti(
  tipoEnte: string,
  entrate: Movimento[],
  uscite: Movimento[],
  costiGeneraliImputati: number,
) {
  const TE = entrate.reduce((s, m) => s + num(m.importo), 0);
  const TU = uscite.reduce((s, m) => s + num(m.importo), 0);

  const CG = num(costiGeneraliImputati);
  const TU_EFF = TU + CG;

  const TER =
    tipoEnte !== "APS"
      ? TE
      : entrate
          .filter((m) => ![1, 2].includes(Number(m.descrizione_code ?? -1)))
          .reduce((s, m) => s + num(m.importo), 0);

  const soglia = TU_EFF * 1.06;
  const esito: "COMMERCIALE" | "NON COMMERCIALE" =
    TER > soglia ? "COMMERCIALE" : "NON COMMERCIALE";

  return { TE, TU, CG, TU_EFF, TER, soglia, esito } as EsitoAig;
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

function EuroFmt({ v }: { v: number }) {
  const n = Number.isFinite(v) ? v : 0;
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>€ {n.toFixed(2)}</span>
  );
}

export default function Aig() {
  const annualitaId = localStorage.getItem("annualita_id");

  const [error, setError] = useState<string | null>(null);
  const [tipoEnte, setTipoEnte] = useState<string>("ETS");
  const [aigs, setAigs] = useState<AigRow[]>([]);

  // ✅ costi generali imputati per AIG (da view)
  const [cgMap, setCgMap] = useState<Record<string, number>>({});

  // esiti in elenco
  const [esitiMap, setEsitiMap] = useState<Record<string, EsitoAig>>({});

  // creazione (modal bottom sheet)
  const [openSheet, setOpenSheet] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newDescr, setNewDescr] = useState("");

  // dettaglio (MODALE FULLSCREEN)
  const [activeAig, setActiveAig] = useState<AigRow | null>(null);

  const [availEntrate, setAvailEntrate] = useState<Movimento[]>([]);
  const [availUscite, setAvailUscite] = useState<Movimento[]>([]);
  const [assEntrate, setAssEntrate] = useState<Movimento[]>([]);
  const [assUscite, setAssUscite] = useState<Movimento[]>([]);

  const [selEntrate, setSelEntrate] = useState<Record<string, boolean>>({});
  const [selUscite, setSelUscite] = useState<Record<string, boolean>>({});

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

  // separatore orizzontale tra righe elenco AIG
  const rowDivider: React.CSSProperties = {
    height: 1,
    background: "rgba(0,0,0,0.07)",
    margin: "0 14px",
  };

  // =========================
  // ✅ Row wrapper: se label è lunga, il valore va a capo ma resta a destra
  // =========================
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
  };

  const wrapRowValue: React.CSSProperties = {
    flex: "0 0 auto",
    marginLeft: "auto",
    textAlign: "right",
    whiteSpace: "nowrap",
    fontWeight: 950,
  };

  const WrapRowValue = ({
    label,
    value,
  }: {
    label: React.ReactNode;
    value: React.ReactNode;
  }) => (
    <div style={wrapRowBox}>
      <div style={wrapRowLabel}>{label}</div>
      <div style={wrapRowValue}>{value}</div>
    </div>
  );

  // =========================
  // ✅ MODALE FULLSCREEN STYLES
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
    if (activeAig) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeAig]);

  // =========================
  // ✅ RIMUOVI ASSEGNAZIONE MOVIMENTO (torna tra disponibili)
  // =========================
  const unassignMovimento = async (movId: string) => {
    if (!activeAig) return;

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

    await loadMovimentiForAig(activeAig.id);
    loadEsitiAllAigs();
  };

  // =========================
  // ✅ CARD MOVIMENTO ASSEGNATO (con cestino "stacca")
  // =========================
  const AssignedMoveCard = ({
    m,
    tone,
    macroLabelTxt,
  }: {
    m: Movimento;
    tone: "green" | "red";
    macroLabelTxt: string;
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
            onClick={() => unassignMovimento(m.id)}
            aria-label="Rimuovi assegnazione"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    );
  };

  // =========================
  // ✅ CARD MOVIMENTO DISPONIBILE (checkbox)
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
  // LOAD PROFILO
  // =========================
  const loadTipoEnte = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("tipo_ente")
      .eq("id", userData.user.id)
      .single();

    if (!error && data?.tipo_ente) setTipoEnte(data.tipo_ente);
  };

  // =========================
  // LOAD LISTA AIG
  // =========================
  const loadAigs = async () => {
    setError(null);
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("aig")
      .select("id, nome, descrizione")
      .eq("annualita_id", annualitaId)
      .order("nome", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setAigs((data || []) as AigRow[]);
  };

  // =========================
  // LOAD COSTI GENERALI IMPUTATI (VIEW)
  // =========================
  const loadCostiGeneraliMap = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("v_costi_generali_imputati")
      .select("allocated_to_id, costi_generali_imputati")
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "AIG");

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

  // =========================
  // LOAD ESITI (tutte le AIG)
  // =========================
  const loadEsitiAllAigs = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("movimenti")
      .select("id, tipologia, importo, descrizione_code, allocated_to_id")
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "AIG")
      .not("allocated_to_id", "is", null);

    if (error) {
      setError(error.message);
      return;
    }

    const byAig: Record<string, { entrate: Movimento[]; uscite: Movimento[] }> =
      {};

    for (const r of (data || []) as any[]) {
      const aigId = String(r.allocated_to_id || "");
      if (!aigId) continue;

      if (!byAig[aigId]) byAig[aigId] = { entrate: [], uscite: [] };

      const movItem: Movimento = {
        id: r.id,
        tipologia: r.tipologia,
        data: "—",
        macro: "AIG",
        descrizione_code: r.descrizione_code ?? null,
        descrizione_label: null,
        importo: Number(r.importo) || 0,
        iva: 0,
        allocated_to_id: r.allocated_to_id ?? null,
      };

      if (r.tipologia === "ENTRATA") byAig[aigId].entrate.push(movItem);
      if (r.tipologia === "USCITA") byAig[aigId].uscite.push(movItem);
    }

    const next: Record<string, EsitoAig> = {};
    for (const [aigId, pack] of Object.entries(byAig)) {
      const cg = num(cgMap[aigId] ?? 0);
      next[aigId] = calcEsitoForMovimenti(
        tipoEnte,
        pack.entrate,
        pack.uscite,
        cg,
      );
    }

    setEsitiMap(next);
  };

  useEffect(() => {
    loadTipoEnte();
    loadAigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!annualitaId) return;
    loadCostiGeneraliMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualitaId, aigs.length]);

  useEffect(() => {
    if (!annualitaId) return;
    if (aigs.length === 0) {
      setEsitiMap({});
      return;
    }
    loadEsitiAllAigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aigs, tipoEnte, annualitaId, cgMap]);

  // =========================
  // CREA AIG
  // =========================
  const openCreate = () => {
    setError(null);
    setNewNome("");
    setNewDescr("");
    setOpenSheet(true);
  };

  const createAig = async () => {
    setError(null);
    if (!annualitaId) return;

    const nome = newNome.trim();
    if (!nome) return alert("Nome AIG obbligatorio");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return alert("Utente non autenticato");

    const { error } = await supabase.from("aig").insert({
      user_id: userData.user.id,
      annualita_id: annualitaId,
      nome,
      descrizione: newDescr.trim() || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewNome("");
    setNewDescr("");
    setOpenSheet(false);
    loadAigs();
  };

  // =========================
  // DELETE AIG
  // =========================
  const deleteAig = async (id: string) => {
    const ok = confirm(
      "Vuoi eliminare questa AIG? I movimenti assegnati torneranno disponibili.",
    );
    if (!ok) return;

    const { error: unErr } = await supabase.rpc(
      "unassign_movimenti_for_activity",
      {
        p_type: "AIG",
        p_id: id,
      },
    );

    if (unErr) {
      alert("Errore sblocco movimenti: " + unErr.message);
      return;
    }

    const { error } = await supabase.from("aig").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    if (activeAig?.id === id) setActiveAig(null);
    loadAigs();
  };

  // =========================
  // DETTAGLIO: movimenti disponibili + assegnati
  // =========================
  const loadMovimentiForAig = async (aigId: string) => {
    setError(null);
    if (!annualitaId) return;

    const baseSelect =
      "id, tipologia, data, macro, descrizione_code, descrizione_label, descrizione_operazione, descrizione_libera, importo, iva";

    const { data: ae, error: aeErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("macro", "AIG")
      .eq("tipologia", "ENTRATA")
      .is("allocated_to_id", null)
      .order("data", { ascending: true });

    if (aeErr) return setError(aeErr.message);

    const { data: au, error: auErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("macro", "AIG")
      .eq("tipologia", "USCITA")
      .is("allocated_to_id", null)
      .order("data", { ascending: true });

    if (auErr) return setError(auErr.message);

    const { data: se, error: seErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "AIG")
      .eq("allocated_to_id", aigId)
      .eq("tipologia", "ENTRATA")
      .order("data", { ascending: true });

    if (seErr) return setError(seErr.message);

    const { data: su, error: suErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "AIG")
      .eq("allocated_to_id", aigId)
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

  const openAig = async (a: AigRow) => {
    setActiveAig(a);
    await loadMovimentiForAig(a.id);
  };

  // =========================
  // ASSEGNA SELEZIONATI
  // =========================
  const assignSelected = async (kind: "ENTRATA" | "USCITA") => {
    if (!activeAig) return;

    const selectedIds = Object.entries(
      kind === "ENTRATA" ? selEntrate : selUscite,
    )
      .filter(([, v]) => v)
      .map(([id]) => id);

    if (selectedIds.length === 0) {
      alert("Seleziona almeno un movimento");
      return;
    }

    for (const id of selectedIds) {
      const { error } = await supabase
        .from("movimenti")
        .update({
          allocated_to_type: "AIG",
          allocated_to_id: activeAig.id,
        })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }
    }

    await loadMovimentiForAig(activeAig.id);
    await loadCostiGeneraliMap();
    loadEsitiAllAigs();
  };

  // =========================
  // CALCOLI TEST AIG (DETTAGLIO)
  // =========================
  const TE = useMemo(
    () => assEntrate.reduce((s, m) => s + num(m.importo), 0),
    [assEntrate],
  );

  const TU = useMemo(
    () => assUscite.reduce((s, m) => s + num(m.importo), 0),
    [assUscite],
  );

  const CG = useMemo(() => {
    if (!activeAig) return 0;
    return num(cgMap[activeAig.id] ?? 0);
  }, [activeAig, cgMap]);

  const TU_EFF = useMemo(() => TU + CG, [TU, CG]);

  const TER = useMemo(() => {
    if (tipoEnte !== "APS") return TE;
    return assEntrate
      .filter((m) => ![1, 2].includes(Number(m.descrizione_code ?? -1)))
      .reduce((s, m) => s + num(m.importo), 0);
  }, [TE, assEntrate, tipoEnte]);

  const soglia = useMemo(() => TU_EFF * 1.06, [TU_EFF]);

  const esito = useMemo(
    () => (TER > soglia ? "COMMERCIALE" : "NON COMMERCIALE"),
    [TER, soglia],
  );

  const esitoTone = esito === "COMMERCIALE" ? "red" : "green";

  // =========================
  // UI
  // =========================
  return (
    <Layout>
      <div className="pageTopbar">
        <h2 className="pageTitle">AIG</h2>
        <div className="pageHelp">
          Crea le attività di interesse generale svolte dall'Ente, ed assegna ad
          ogni AIG creata le entrate e uscite sostenute per la realizzazione di
          quella specifica attività. <br />
          <br />
          <u>
            N.B. Gli Enti con entrate non superiori a € 300.000,00 possono
            considerare le diverse attività di interesse generale (AIG) svolte
            come se fossero un'unica attività ai fini della verifica del test di
            non commercialità.
          </u>
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
        aria-label="Crea nuova AIG"
      >
        +
      </button>

      {/* MODAL CREA AIG (bottom sheet) */}
      {openSheet && (
        <div className="sheetOverlay" onClick={() => setOpenSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheetHandle" />

            <div className="sheetHeader">
              <div className="sheetTitle">Crea nuova AIG</div>
              <button
                className="btn"
                onClick={() => setOpenSheet(false)}
                type="button"
              >
                Chiudi
              </button>
            </div>

            <div className="sheetGrid" style={{ gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>
                  Nome (obbligatorio)
                </div>
                <input
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  className="input"
                  placeholder="Es. Doposcuola, Laboratorio, Assistenza..."
                />
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>
                  Descrizione
                </div>
                <input
                  value={newDescr}
                  onChange={(e) => setNewDescr(e.target.value)}
                  className="input"
                  placeholder="Descrizione sintetica (opzionale)"
                />
              </div>

              <PrimaryButton onClick={createAig} className="btn--block">
                Salva AIG
              </PrimaryButton>

              <SecondaryButton
                onClick={() => {
                  setOpenSheet(false);
                  setNewNome("");
                  setNewDescr("");
                }}
                className="btn--block"
              >
                Annulla
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3" />

      {/* ✅ ELENCO AIG (NO "CARD DENTRO CARD"):
          - tolgo listBox (che spesso ha un bordo/padding tipo card)
          - uso un semplice contenitore + separatore orizzontale tra righe */}
      <Card title="Elenco AIG">
        {aigs.length === 0 ? (
          <div className="muted" style={{ fontWeight: 800 }}>
            Nessuna AIG creata
          </div>
        ) : (
          <div>
            {aigs.map((a, idx) => {
              const e = esitiMap[a.id];
              const esitoTxt = e?.esito || "—";
              const esitoToneList =
                esitoTxt === "COMMERCIALE"
                  ? "red"
                  : esitoTxt === "NON COMMERCIALE"
                    ? "green"
                    : "neutral";

              return (
                <div key={a.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openAig(a)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") openAig(a);
                    }}
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
                        className="rowMeta"
                        style={{ marginTop: 0, marginBottom: 8 }}
                      >
                        <Badge tone={esitoToneList as any}>{esitoTxt}</Badge>
                      </div>

                      <div className="rowTitle" style={noEllipsis}>
                        {a.nome}
                      </div>

                      <div className="rowSub" style={noEllipsis}>
                        {a.descrizione || "—"}
                      </div>
                    </div>

                    <div
                      style={{ display: "grid", justifyItems: "end", gap: 8 }}
                    >
                      <button
                        className="iconBtn"
                        type="button"
                        title="Elimina"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          deleteAig(a.id);
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>

                  {idx !== aigs.length - 1 && <div style={rowDivider} />}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* DETTAGLIO (MODALE FULLSCREEN) */}
      {activeAig && (
        <div
          className="sheetOverlay"
          style={fullModalOverlay}
          onClick={() => setActiveAig(null)}
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
                {activeAig.nome}
              </div>

              <button
                className="btn"
                onClick={() => setActiveAig(null)}
                type="button"
              >
                Chiudi
              </button>
            </div>

            <div style={{ padding: 14 }}>
              {activeAig.descrizione && (
                <div style={{ marginTop: 10, ...noEllipsis }}>
                  {activeAig.descrizione}
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
                              macroLabelTxt="AIG"
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
                              macroLabelTxt="AIG"
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
                              macroLabelTxt="AIG"
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
                              macroLabelTxt="AIG"
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
                <Card
                  title="Test AIG (6%)"
                  right={<Badge tone={esitoTone as any}>{esito}</Badge>}
                >
                  <div style={noEllipsis}>
                    <WrapRowValue
                      label={
                        <span style={noEllipsis}>TOTALE ENTRATE ASSEGNATE</span>
                      }
                      value={<EuroFmt v={TE} />}
                    />

                    <WrapRowValue
                      label={
                        <span style={noEllipsis}>TOTALE USCITE ASSEGNATE</span>
                      }
                      value={<EuroFmt v={TU} />}
                    />

                    <WrapRowValue
                      label={
                        <span style={noEllipsis}>COSTI GENERALI IMPUTATI</span>
                      }
                      value={<EuroFmt v={CG} />}
                    />

                    <WrapRowValue
                      label={
                        <span style={noEllipsis}>
                          TOTALE COSTI EFFETTIVI (TU + CG)
                        </span>
                      }
                      value={<EuroFmt v={TU_EFF} />}
                    />

                    <WrapRowValue
                      label={
                        <span style={noEllipsis}>
                          TOTALE ENTRATE RILEVANTI
                          {tipoEnte === "APS"
                            ? " – APS: escluse prestazioni a favore di iscritti, soci e fondatori"
                            : ""}
                        </span>
                      }
                      value={<EuroFmt v={TER} />}
                    />

                    <WrapRowValue
                      label={
                        <span style={noEllipsis}>
                          SOGLIA = TOTALE COSTI EFFETTIVI × 1,06
                        </span>
                      }
                      value={<EuroFmt v={soglia} />}
                    />
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
