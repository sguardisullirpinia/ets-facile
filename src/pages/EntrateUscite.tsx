// EntrateUscite.tsx
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
  conto: string | null; // CASSA / BANCA
  descrizione_label: string | null;
  descrizione_operazione: string | null;
  importo: number;
  iva: number;
  is_costo_generale?: boolean;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function totaleMov(m: Movimento) {
  return num(m.importo) + num(m.iva);
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

function dateParts(d: string | null) {
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

function MiniTag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "green" | "red" | "blue" | "amber" | "yellow" | "neutral";
}) {
  return (
    <span
      className={`miniTag ${tone ? `miniTag--${tone}` : "miniTag--neutral"}`}
    >
      {children}
    </span>
  );
}

function toneForMacro(m: string | null) {
  if (m === "AIG") return "blue";
  if (m === "RACCOLTE_FONDI") return "yellow";
  if (m === "ATTIVITA_DIVERSE") return "amber";
  return "neutral";
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform .18s ease",
      }}
    >
      <path
        d="M9 18l6-6-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FilterIcon({ open }: { open: boolean }) {
  // icona "sliders"
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ opacity: open ? 1 : 0.85 }}
    >
      <path
        d="M4 21v-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 10V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 21v-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 8V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 21v-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 12V3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M2 14h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 8h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 16h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AccordionHeader({
  title,
  open,
  onToggle,
  right,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="accHeader"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#fff",
      }}
    >
      <span style={{ display: "grid", placeItems: "center" }}>
        <ChevronIcon open={open} />
      </span>

      <span style={{ textAlign: "left", fontWeight: 950, letterSpacing: 0.2 }}>
        {title}
      </span>

      <span style={{ justifySelf: "end" }}>{right}</span>
    </button>
  );
}

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

  // ✅ accordion
  const [openAvanzi, setOpenAvanzi] = useState(false);
  const [openMovimenti, setOpenMovimenti] = useState(true);
  const [openRiepilogo, setOpenRiepilogo] = useState(false);

  // ✅ filtri
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const macroEff = (m: Movimento) =>
    m.is_costo_generale ? "COSTI_GENERALI" : m.macro;

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
        const av = totaleMov(a);
        const bv = totaleMov(b);
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

  // totali generali
  const totEntrate = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "ENTRATA")
        .reduce((s, m) => s + totaleMov(m), 0),
    [movimenti],
  );
  const totUscite = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "USCITA")
        .reduce((s, m) => s + totaleMov(m), 0),
    [movimenti],
  );

  const totEntrateBanca = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "ENTRATA" && m.conto === "BANCA")
        .reduce((s, m) => s + totaleMov(m), 0),
    [movimenti],
  );
  const totEntrateCassa = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "ENTRATA" && m.conto === "CASSA")
        .reduce((s, m) => s + totaleMov(m), 0),
    [movimenti],
  );
  const totUsciteBanca = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "USCITA" && m.conto === "BANCA")
        .reduce((s, m) => s + totaleMov(m), 0),
    [movimenti],
  );
  const totUsciteCassa = useMemo(
    () =>
      movimenti
        .filter((m) => m.tipologia === "USCITA" && m.conto === "CASSA")
        .reduce((s, m) => s + totaleMov(m), 0),
    [movimenti],
  );

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

  const disponibilitaBanca = useMemo(
    () => avanzoBancaT1 + totEntrateBanca - totUsciteBanca,
    [avanzoBancaT1, totEntrateBanca, totUsciteBanca],
  );
  const disponibilitaCassa = useMemo(
    () => avanzoCassaT1 + totEntrateCassa - totUsciteCassa,
    [avanzoCassaT1, totEntrateCassa, totUsciteCassa],
  );

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
      Totale: totaleMov(m),
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
      Totale: totaleMov(m),
    }));

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(rowsMov);
    XLSX.utils.book_append_sheet(wb, ws1, "Movimenti");
    const ws2 = XLSX.utils.json_to_sheet(rowsAvanzi);
    XLSX.utils.book_append_sheet(wb, ws2, "Avanzi");

    XLSX.writeFile(wb, filename);
  };

  // UI filtri
  const filterBar: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "var(--card, rgba(0,0,0,0.03))",
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

  // riepilogo
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
    fontWeight: 900,
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

  // badge conteggio
  const CountPill = ({ n }: { n: number }) => (
    <span
      style={{
        fontSize: 12,
        fontWeight: 900,
        padding: "5px 10px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.10)",
        background: "rgba(0,0,0,0.03)",
      }}
    >
      {n}
    </span>
  );

  return (
    <Layout>
      {/* HEADER */}
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">PRIMA NOTA</h2>
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

      {/* FAB */}
      <button
        className="fab"
        onClick={() => goNew("ENTRATA")}
        type="button"
        aria-label="Nuovo movimento"
      >
        +
      </button>

      {/* ===== ACCORDION: AVANZI ===== */}
      <div className="section">
        <AccordionHeader
          title="Avanzi da esercizio precedente (T-1)"
          open={openAvanzi}
          onToggle={() => setOpenAvanzi((s) => !s)}
          right={<CountPill n={avanzi.length} />}
        />

        {openAvanzi && (
          <div style={{ marginTop: 10 }} className="listBox">
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

                    <div
                      style={{ display: "grid", justifyItems: "end", gap: 8 }}
                    >
                      <div
                        className="rowAmount"
                        style={{ justifySelf: "end", textAlign: "right" }}
                      >
                        <Euro v={num(m.importo)} />
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
        )}
      </div>

      {/* ===== ACCORDION: MOVIMENTI ===== */}
      <div className="section">
        <AccordionHeader
          title="Movimenti dell'annualità"
          open={openMovimenti}
          onToggle={() => setOpenMovimenti((s) => !s)}
          right={<CountPill n={movimentiFilteredSorted.length} />}
        />

        {openMovimenti && (
          <div style={{ marginTop: 10 }}>
            {/* barra filtri richiudibile */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginBottom: 8,
              }}
            >
              <button
                type="button"
                className="iconBtn"
                onClick={() => setFiltersOpen((s) => !s)}
                title={filtersOpen ? "Chiudi filtri" : "Apri filtri"}
                aria-label="Filtri"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "#fff",
                }}
              >
                <FilterIcon open={filtersOpen} />
              </button>
            </div>

            {filtersOpen && (
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
            )}

            {/* lista movimenti */}
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
                  const codificata =
                    (m.descrizione_label || "").trim() || "N/D";
                  const operazione =
                    (m.descrizione_operazione || "").trim() || "—";
                  const { day, mon } = dateParts(m.data);
                  const me = macroEff(m);

                  return (
                    <div key={m.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openEdit(m.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            openEdit(m.id);
                        }}
                        className="movRow"
                      >
                        <div className="movDate">
                          <div className="movDay">{day}</div>
                          <div className="movMon">{mon}</div>
                        </div>

                        <div className="movMain">
                          <div className="movTop">
                            <div className="movTags">
                              <MiniTag tone={isEntrata ? "green" : "red"}>
                                {isEntrata ? "Entrata" : "Uscita"}
                              </MiniTag>
                              <MiniTag tone={toneForMacro(me) as any}>
                                {macroLabel(me)}
                              </MiniTag>
                              {m.conto ? (
                                <MiniTag tone="neutral">
                                  {contoLabel(m.conto)}
                                </MiniTag>
                              ) : null}
                            </div>
                          </div>

                          <div className="movTitle">{codificata}</div>
                          <div className="movSub">{operazione}</div>
                        </div>

                        <div className="movRight">
                          <div className="movAmount">
                            <Euro v={totaleMov(m)} />
                          </div>

                          <IconButton
                            title="Elimina"
                            className="iconBtn--sm"
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
                        <div style={{ height: 10 }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== ACCORDION: RIEPILOGO ===== */}
      <div className="section">
        <AccordionHeader
          title="Riepilogo"
          open={openRiepilogo}
          onToggle={() => setOpenRiepilogo((s) => !s)}
          right={
            <span style={{ fontWeight: 100 }}>
              avanzo/disavanzo <Euro v={avanzoGestione} />
            </span>
          }
        />

        {openRiepilogo && (
          <div style={{ marginTop: 10 }} className="listBox">
            <div className="listRow">
              <div className="rowMain" style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    opacity: 0.7,
                    textTransform: "uppercase",
                  }}
                >
                  Entrate
                </div>
                <WrapRowValue
                  label="Totale entrate banca"
                  value={<Euro v={totEntrateBanca} />}
                />
                <WrapRowValue
                  label="Totale entrate cassa"
                  value={<Euro v={totEntrateCassa} />}
                />
                <WrapRowValue
                  label="Totale entrate"
                  value={<Euro v={totEntrate} />}
                />
              </div>
            </div>

            <div className="listRow">
              <div className="rowMain" style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    opacity: 0.7,
                    textTransform: "uppercase",
                  }}
                >
                  Uscite
                </div>
                <WrapRowValue
                  label="Totale uscite banca"
                  value={<Euro v={totUsciteBanca} />}
                />
                <WrapRowValue
                  label="Totale uscite cassa"
                  value={<Euro v={totUsciteCassa} />}
                />
                <WrapRowValue
                  label="Totale uscite"
                  value={<Euro v={totUscite} />}
                />
              </div>
            </div>

            <div className="listRow">
              <div className="rowMain" style={{ display: "grid", gap: 10 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    opacity: 0.7,
                    textTransform: "uppercase",
                  }}
                >
                  Disponibilità
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 2,
                  }}
                >
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
                <WrapRowValue
                  label="Disponibilità banca"
                  value={<Euro v={disponibilitaBanca} />}
                />
                <WrapRowValue
                  label="Disponibilità cassa"
                  value={<Euro v={disponibilitaCassa} />}
                />
              </div>
            </div>

            <div className="listRow">
              <div className="rowMain" style={{ display: "grid", gap: 8 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.4,
                    opacity: 0.7,
                    textTransform: "uppercase",
                  }}
                >
                  Risultato di gestione
                </div>
                <WrapRowValue
                  label="Avanzo / disavanzo di gestione"
                  value={<Euro v={avanzoGestione} />}
                />
                <div className="rowSub">(Totale entrate − Totale uscite)</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EXPORT */}
      <div className="section" style={{ paddingBottom: 90 }}>
        <div className="sectionTitle">ESPORTA</div>
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
