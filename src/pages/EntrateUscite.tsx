import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Euro } from "../components/ui";
import * as XLSX from "xlsx";

type Movimento = {
  id: string;
  tipologia: string;
  data: string | null;
  macro: string | null;
  conto: string | null; // ✅ CASSA / BANCA
  descrizione_label: string | null;
  descrizione_operazione: string | null;
  importo: number;
  iva: number;

  // ✅ nuovo
  is_costo_generale?: boolean;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function macroLabel(m: string | null) {
  switch (m) {
    case "COSTI_GENERALI":
      return "Costi generali";
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
    default:
      return "—";
  }
}

function contoLabel(c: string | null) {
  if (c === "CASSA") return "Cassa";
  if (c === "BANCA") return "Banca";
  return "";
}

function ymdKey(d: string | null) {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "—";
}

function fmtDate(d: string | null) {
  if (!d) return "Senza data";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

// ✅ chip data: giorno + mese (es. 09 FEB)
function dateChipParts(d: string | null) {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { day: "—", mon: "" };
  const [, m, day] = d.split("-");
  const months = [
    "GEN",
    "FEB",
    "MAR",
    "APR",
    "MAG",
    "GIU",
    "LUG",
    "AGO",
    "SET",
    "OTT",
    "NOV",
    "DIC",
  ];
  const mi = Math.max(1, Math.min(12, Number(m))) - 1;
  return { day, mon: months[mi] };
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

/** Ordine fisso delle macro per il filtro */
const MACRO_ORDER = [
  "COSTI_GENERALI",
  "AIG",
  "ATTIVITA_DIVERSE",
  "RACCOLTE_FONDI",
  "QUOTE_ASSOCIATIVE",
  "EROGAZIONI_LIBERALI",
  "PROVENTI_5X1000",
  "CONTRIBUTI_PA_SENZA_CORRISPETTIVO",
  "ALTRI_PROVENTI_NON_COMMERCIALI",
] as const;

export default function EntrateUscite() {
  const annualitaId = localStorage.getItem("annualita_id");
  const annualitaAnno = localStorage.getItem("annualita_anno") || "";

  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<Movimento[]>([]);

  // ✅ FILTRI/ORDINAMENTO
  const [search, setSearch] = useState("");
  const [macroFilter, setMacroFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"data" | "importo" | "descrizione">(
    "data",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const HELP_FULL =
    "Inserisci le entrate e le uscite dell’anno, distinguendo tra movimenti di banca e di cassa. \nIndividua sempre una macro-categoria a cui assegnare la posta attiva o passiva, tra AIG (attività di Interesse Generale), Attività diverse, Raccolte Fondi, Quote Associative, Erogazioni Liberali, Proventi 5/1000, Contributi PA senza corrispettivo.\n\nN.B. I Costi Generali che incidono su tutte le attività dell'Ente [es. affitto struttura, luce, acqua, ecc.] vengono dal sistema automaticamente imputati alle varie attività in relazione all'ammontare delle entrate";

  const load = async () => {
    setError(null);
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("movimenti")
      .select(
        "id, tipologia, data, macro, conto, descrizione_label, descrizione_operazione, importo, iva, is_costo_generale",
      )
      .eq("annualita_id", annualitaId)
      .order("data", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }
    setList((data || []) as Movimento[]);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avanzi = useMemo(
    () =>
      list.filter(
        (m) =>
          m.tipologia === "AVANZO_CASSA_T_1" ||
          m.tipologia === "AVANZO_BANCA_T_1",
      ),
    [list],
  );

  const movimenti = useMemo(
    () =>
      list.filter((m) => m.tipologia === "ENTRATA" || m.tipologia === "USCITA"),
    [list],
  );

  // ✅ macro “effettiva”
  const macroEff = (m: Movimento) =>
    m.is_costo_generale ? "COSTI_GENERALI" : m.macro;

  // ✅ opzioni macro sempre complete
  const macroOptions = useMemo(() => {
    const present = new Set<string>();
    for (const m of movimenti) present.add(macroEff(m) || "—");

    const ordered = MACRO_ORDER.slice().map(String);

    const extras = Array.from(present).filter((x) => !ordered.includes(x));
    extras.sort((a, b) => macroLabel(a).localeCompare(macroLabel(b)));

    return [...ordered, ...extras].filter((x) => x !== "—");
  }, [movimenti]);

  const movimentiFilteredSorted = useMemo(() => {
    let res = movimenti.slice();

    if (macroFilter !== "ALL") {
      res = res.filter((m) => (macroEff(m) || "—") === macroFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      res = res.filter((m) => {
        const a = (m.descrizione_label || "").toLowerCase();
        const b = (m.descrizione_operazione || "").toLowerCase();
        const c = macroLabel(macroEff(m)).toLowerCase();
        const d = contoLabel(m.conto).toLowerCase();
        return a.includes(q) || b.includes(q) || c.includes(q) || d.includes(q);
      });
    }

    const dir = sortDir === "asc" ? 1 : -1;

    res.sort((a, b) => {
      if (sortBy === "data") {
        const ak = ymdKey(a.data);
        const bk = ymdKey(b.data);

        const aNo = ak === "—";
        const bNo = bk === "—";
        if (aNo && bNo) return 0;
        if (aNo) return 1;
        if (bNo) return -1;

        if (ak === bk) return 0;
        return ak.localeCompare(bk) * dir;
      }

      if (sortBy === "importo") {
        const av = num(a.importo);
        const bv = num(b.importo);
        if (av === bv) return ymdKey(b.data).localeCompare(ymdKey(a.data));
        return (av - bv) * dir;
      }

      const ad = (
        (a.descrizione_label || "").trim() ||
        (a.descrizione_operazione || "").trim() ||
        "—"
      ).toLowerCase();
      const bd = (
        (b.descrizione_label || "").trim() ||
        (b.descrizione_operazione || "").trim() ||
        "—"
      ).toLowerCase();
      const c = ad.localeCompare(bd);
      if (c !== 0) return c * dir;
      return ymdKey(b.data).localeCompare(ymdKey(a.data));
    });

    return res;
  }, [movimenti, macroFilter, search, sortBy, sortDir]);

  // ✅ TOTALI GENERALI
  const totEntrate = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "ENTRATA")
        .reduce((s, m) => s + num(m.importo), 0),
    [movimenti],
  );

  const totUscite = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "USCITA")
        .reduce((s, m) => s + num(m.importo), 0),
    [movimenti],
  );

  // ✅ TOTALI PER CONTO
  const totEntrateBanca = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "ENTRATA" && m.conto === "BANCA")
        .reduce((s, m) => s + num(m.importo), 0),
    [movimenti],
  );

  const totEntrateCassa = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "ENTRATA" && m.conto === "CASSA")
        .reduce((s, m) => s + num(m.importo), 0),
    [movimenti],
  );

  const totUsciteBanca = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "USCITA" && m.conto === "BANCA")
        .reduce((s, m) => s + num(m.importo), 0),
    [movimenti],
  );

  const totUsciteCassa = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "USCITA" && m.conto === "CASSA")
        .reduce((s, m) => s + num(m.importo), 0),
    [movimenti],
  );

  // ✅ AVANZI T-1
  const avanzoBancaT1 = useMemo(
    () =>
      avanzi
        .filter((m) => m.tipologia === "AVANZO_BANCA_T_1")
        .reduce((s, m) => s + num(m.importo), 0),
    [avanzi],
  );

  const avanzoCassaT1 = useMemo(
    () =>
      avanzi
        .filter((m) => m.tipologia === "AVANZO_CASSA_T_1")
        .reduce((s, m) => s + num(m.importo), 0),
    [avanzi],
  );

  // ✅ DISPONIBILITÀ
  const disponibilitaBanca = useMemo(
    () => avanzoBancaT1 + totEntrateBanca - totUsciteBanca,
    [avanzoBancaT1, totEntrateBanca, totUsciteBanca],
  );

  const disponibilitaCassa = useMemo(
    () => avanzoCassaT1 + totEntrateCassa - totUsciteCassa,
    [avanzoCassaT1, totEntrateCassa, totUsciteCassa],
  );

  // ✅ AVANZO / DISAVANZO DI GESTIONE
  const avanzoGestione = useMemo(
    () => totEntrate - totUscite,
    [totEntrate, totUscite],
  );

  const goNew = (
    tipologia: "ENTRATA" | "USCITA" | "AVANZO_CASSA_T_1" | "AVANZO_BANCA_T_1",
  ) => {
    localStorage.removeItem("movimento_edit_id");
    localStorage.setItem("movimento_tipologia", tipologia);
    window.location.href = "/movimento";
  };

  const openEdit = (id: string) => {
    localStorage.setItem("movimento_edit_id", id);
    window.location.href = "/movimento";
  };

  const elimina = async (id: string) => {
    const ok = confirm("Vuoi eliminare questo movimento?");
    if (!ok) return;

    const { error } = await supabase.from("movimenti").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    load();
  };

  // ✅ EXPORT EXCEL
  const downloadExcel = () => {
    const fileYear = annualitaAnno ? `_${annualitaAnno}` : "";
    const filename = `entrate_uscite${fileYear}.xlsx`;

    const rowsMov = movimenti.map((m) => ({
      ID: m.id,
      Tipologia: m.tipologia,
      Data: m.data ? fmtDate(m.data) : "Senza data",
      Macro: macroLabel(macroEff(m)),
      "Cassa/Banca": contoLabel(m.conto),
      "Descrizione codificata": m.descrizione_label || "",
      "Descrizione operazione": m.descrizione_operazione || "",
      Importo: num(m.importo),
      IVA: num(m.iva),
    }));

    const rowsAvanzi = avanzi.map((m) => ({
      ID: m.id,
      Tipologia:
        m.tipologia === "AVANZO_CASSA_T_1"
          ? "Avanzo cassa (t-1)"
          : "Avanzo banca (t-1)",
      "Cassa/Banca": contoLabel(m.conto),
      Importo: num(m.importo),
      IVA: num(m.iva),
    }));

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(rowsMov);
    XLSX.utils.book_append_sheet(wb, ws1, "Movimenti");

    const ws2 = XLSX.utils.json_to_sheet(rowsAvanzi);
    XLSX.utils.book_append_sheet(wb, ws2, "Avanzi");

    XLSX.writeFile(wb, filename);
  };

  // ✅ layout righe (movimenti)
  const rowLayout: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    alignItems: "start",
    columnGap: 12,
  };

  const chipStyle: React.CSSProperties = {
    width: 44,
    minWidth: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(0,0,0,0.10)",
    background: "rgba(0,0,0,0.02)",
    lineHeight: 1,
    marginTop: 2,
  };

  // UI filtri
  const filterBar: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "var(--card, rgba(0,0,0,0.03))",
    marginBottom: 12,
  };

  const row2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  };

  const ctrl: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    fontSize: 14,
    outline: "none",
  };

  const sumRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "start",
    columnGap: 12,
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    background: "rgba(0,0,0,0.07)",
    margin: "0 14px",
  };

  const blockTitleStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.4,
    opacity: 0.7,
    textTransform: "uppercase",
  };

  const amountBoxStyle: React.CSSProperties = {
    justifySelf: "end",
    textAlign: "right",
  };

  const badgeStackStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  };

  return (
    <Layout>
      {/* HEADER */}
      <div className="pageHeader" style={{ paddingTop: 10 }}>
        <div>
          <h2 className="pageTitle">Prima Nota</h2>
          <div className="pageHelp" style={{ whiteSpace: "pre-line" }}>
            {HELP_FULL}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      {/* ✅ FAB */}
      <button
        className="fab"
        onClick={() => goNew("ENTRATA")}
        type="button"
        aria-label="Nuovo movimento"
      >
        +
      </button>

      {/* AVANZI */}
      <div className="section">
        <div className="sectionTitle">Avanzi da esercizio precedente (t-1)</div>

        <div className="listBox">
          {avanzi.length === 0 ? (
            <div className="listRow">
              <div className="rowMain">
                <div className="rowSub">Nessun avanzo inserito</div>
              </div>
            </div>
          ) : (
            avanzi.map((m) => {
              const label =
                m.tipologia === "AVANZO_CASSA_T_1"
                  ? "Avanzo cassa"
                  : "Avanzo banca";

              return (
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(m.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openEdit(m.id);
                  }}
                  className="listRow"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "start",
                    columnGap: 12,
                  }}
                >
                  <div className="rowMain">
                    <div className="rowTitle">{label}</div>
                    <div className="rowSub">
                      Esercizio precedente
                      {m.conto ? (
                        <>
                          {" "}
                          • <b>{contoLabel(m.conto)}</b>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                    <div className="rowAmount" style={amountBoxStyle}>
                      <Euro v={m.importo} />
                    </div>

                    <IconButton
                      title="Elimina"
                      onClick={(e) => {
                        e.stopPropagation();
                        elimina(m.id);
                      }}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MOVIMENTI */}
      <div className="section">
        <div className="sectionTitle">Movimenti dell’annualità</div>

        <div style={filterBar}>
          <input
            style={ctrl}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca (descrizione, operazione, macro, cassa/banca)..."
          />

          <div style={row2}>
            <select
              style={ctrl}
              value={macroFilter}
              onChange={(e) => setMacroFilter(e.target.value)}
            >
              <option value="ALL">Tutte le macro</option>
              {macroOptions.map((m) => (
                <option key={m} value={m}>
                  {macroLabel(m)}
                </option>
              ))}
            </select>

            <select
              style={ctrl}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="data">Ordina per: Data</option>
              <option value="importo">Ordina per: Importo</option>
              <option value="descrizione">Ordina per: Descrizione</option>
            </select>
          </div>

          <div style={row2}>
            <select
              style={ctrl}
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as any)}
            >
              <option value="desc">Decrescente</option>
              <option value="asc">Crescente</option>
            </select>

            <button
              className="btn btn--block"
              type="button"
              onClick={() => {
                setSearch("");
                setMacroFilter("ALL");
                setSortBy("data");
                setSortDir("desc");
              }}
            >
              Reset filtri
            </button>
          </div>

          <div className="rowSub" style={{ marginTop: -2 }}>
            Visualizzati: <b>{movimentiFilteredSorted.length}</b> /{" "}
            {movimenti.length}
          </div>
        </div>

        <div className="listBox">
          {movimentiFilteredSorted.length === 0 ? (
            <div className="listRow">
              <div className="rowMain">
                <div className="rowSub">Nessun movimento trovato</div>
              </div>
            </div>
          ) : (
            movimentiFilteredSorted.map((m, idx) => {
              const isEntrata = m.tipologia === "ENTRATA";
              const tone = isEntrata ? "green" : "red";

              const codificata = (m.descrizione_label || "").trim() || "N/D";
              const operazione = (m.descrizione_operazione || "").trim() || "—";

              const { day, mon } = dateChipParts(m.data);
              const dataFull = fmtDate(m.data);

              const me = macroEff(m);

              return (
                <div key={m.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openEdit(m.id);
                    }}
                    className="listRow"
                    style={rowLayout}
                  >
                    {/* ✅ CHIP DATA */}
                    <div style={chipStyle} aria-label={`Data: ${dataFull}`}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{day}</div>
                      <div
                        style={{ fontSize: 10, fontWeight: 800, opacity: 0.75 }}
                      >
                        {mon}
                      </div>
                    </div>

                    {/* CONTENUTO */}
                    <div className="rowMain" style={{ minWidth: 0 }}>
                      <div
                        className="rowMeta"
                        style={{ marginTop: 0, marginBottom: 8 }}
                      >
                        <Badge tone={tone}>
                          {isEntrata ? "Entrata" : "Uscita"}
                        </Badge>
                        <Badge tone="neutral">{macroLabel(me)}</Badge>
                        {m.conto ? (
                          <Badge tone="neutral">{contoLabel(m.conto)}</Badge>
                        ) : null}
                      </div>

                      <div
                        className="rowTitle"
                        style={{ whiteSpace: "normal" }}
                      >
                        {codificata}
                      </div>

                      <div className="rowSub" style={{ whiteSpace: "normal" }}>
                        {operazione}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
                        {dataFull}
                      </div>
                    </div>

                    {/* IMPORTO + AZIONI */}
                    <div
                      style={{ display: "grid", justifyItems: "end", gap: 8 }}
                    >
                      <div className="rowAmount" style={amountBoxStyle}>
                        <Euro v={m.importo} />
                      </div>

                      <IconButton
                        title="Elimina"
                        onClick={(e) => {
                          e.stopPropagation();
                          elimina(m.id);
                        }}
                      >
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </div>

                  {idx !== movimentiFilteredSorted.length - 1 && (
                    <div style={dividerStyle} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ✅ RIEPILOGO */}
      <div className="section">
        <div className="sectionTitle">Riepilogo</div>

        <div className="listBox">
          {/* ENTRATE */}
          <div className="listRow">
            <div className="rowMain" style={{ display: "grid", gap: 10 }}>
              <div style={blockTitleStyle}>Entrate</div>

              <div style={sumRowStyle}>
                <div className="rowTitle">Totale entrate banca</div>
                <div className="rowAmount" style={amountBoxStyle}>
                  <Euro v={totEntrateBanca} />
                </div>
              </div>

              <div style={sumRowStyle}>
                <div className="rowTitle">Totale entrate cassa</div>
                <div className="rowAmount" style={amountBoxStyle}>
                  <Euro v={totEntrateCassa} />
                </div>
              </div>

              <div style={dividerStyle} />

              <div style={sumRowStyle}>
                <div className="rowTitle" style={{ fontWeight: 800 }}>
                  TOTALE ENTRATE
                </div>
                <div
                  className="rowAmount"
                  style={{ ...amountBoxStyle, fontWeight: 800 }}
                >
                  <Euro v={totEntrate} />
                </div>
              </div>
            </div>
          </div>

          {/* USCITE */}
          <div className="listRow">
            <div className="rowMain" style={{ display: "grid", gap: 10 }}>
              <div style={blockTitleStyle}>Uscite</div>

              <div style={sumRowStyle}>
                <div className="rowTitle">Totale uscite banca</div>
                <div className="rowAmount" style={amountBoxStyle}>
                  <Euro v={totUsciteBanca} />
                </div>
              </div>

              <div style={sumRowStyle}>
                <div className="rowTitle">Totale uscite cassa</div>
                <div className="rowAmount" style={amountBoxStyle}>
                  <Euro v={totUsciteCassa} />
                </div>
              </div>

              <div style={dividerStyle} />

              <div style={sumRowStyle}>
                <div className="rowTitle" style={{ fontWeight: 800 }}>
                  TOTALE USCITE
                </div>
                <div
                  className="rowAmount"
                  style={{ ...amountBoxStyle, fontWeight: 800 }}
                >
                  <Euro v={totUscite} />
                </div>
              </div>
            </div>
          </div>

          {/* DISPONIBILITÀ */}
          <div className="listRow">
            <div className="rowMain" style={{ display: "grid", gap: 10 }}>
              <div style={blockTitleStyle}>Disponibilità</div>

              <div style={badgeStackStyle}>
                <Badge tone="neutral">
                  Avanzo banca (t-1):{" "}
                  <b>
                    <Euro v={avanzoBancaT1} />
                  </b>
                </Badge>
                <Badge tone="neutral">
                  Avanzo cassa (t-1):{" "}
                  <b>
                    <Euro v={avanzoCassaT1} />
                  </b>
                </Badge>
              </div>

              <div style={sumRowStyle}>
                <div className="rowTitle">DISPONIBILITÀ BANCA</div>
                <div
                  className="rowAmount"
                  style={{ ...amountBoxStyle, fontWeight: 800 }}
                >
                  <Euro v={disponibilitaBanca} />
                </div>
              </div>

              <div style={sumRowStyle}>
                <div className="rowTitle">DISPONIBILITÀ CASSA</div>
                <div
                  className="rowAmount"
                  style={{ ...amountBoxStyle, fontWeight: 800 }}
                >
                  <Euro v={disponibilitaCassa} />
                </div>
              </div>
            </div>
          </div>

          {/* AVANZO / DISAVANZO */}
          <div className="listRow">
            <div className="rowMain" style={{ display: "grid", gap: 8 }}>
              <div style={blockTitleStyle}>Risultato di gestione</div>

              <div style={sumRowStyle}>
                <div className="rowTitle">AVANZO / DISAVANZO DI GESTIONE</div>
                <div
                  className="rowAmount"
                  style={{ ...amountBoxStyle, fontWeight: 900 }}
                >
                  <Euro v={avanzoGestione} />
                </div>
              </div>

              <div className="rowSub">(Totale entrate − Totale uscite)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ EXPORT EXCEL */}
      <div className="section" style={{ paddingBottom: 90 }}>
        <div className="sectionTitle">Esporta</div>
        <div className="listBox">
          <div className="listRow">
            <div className="rowMain">
              <div className="rowTitle">Scarica Entrate/Uscite in Excel</div>
              <div className="rowSub">
                Include movimenti e avanzi (in due fogli separati) + colonna
                Cassa/Banca.
              </div>
            </div>

            <button
              className="btn"
              type="button"
              onClick={downloadExcel}
              disabled={!list.length}
              title={
                !list.length ? "Nessun dato da esportare" : "Scarica Excel"
              }
            >
              Scarica Excel
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
