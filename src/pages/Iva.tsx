import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, Euro } from "../components/ui";

type Movimento = {
  id: string;
  tipologia: "ENTRATA" | "USCITA" | string;
  data: string | null;
  macro: string | null;
  conto?: string | null;

  descrizione_label: string | null;
  descrizione_operazione?: string | null;
  descrizione_libera?: string | null;

  importo: any;
  iva: any;

  is_costo_generale?: boolean;
};

function num(v: any) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  let s = String(v).trim();
  if (!s) return 0;

  s = s.replace(/[^\d,.\-]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function ymdKey(d: string | null) {
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "—";
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
      return m ? m : "—";
  }
}

function bestDescr(m: Movimento) {
  const a = (m.descrizione_label || "").trim();
  const b = (m.descrizione_operazione || "").trim();
  const c = (m.descrizione_libera || "").trim();
  return a || b || c || "—";
}

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

export default function Iva() {
  const annualitaId = localStorage.getItem("annualita_id");
  const annualitaAnno = localStorage.getItem("annualita_anno") || "";

  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Movimento[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    setError(null);
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("movimenti")
      .select(
        "id, tipologia, data, macro, conto, descrizione_label, descrizione_operazione, descrizione_libera, importo, iva, is_costo_generale",
      )
      .eq("annualita_id", annualitaId)
      .in("tipologia", ["ENTRATA", "USCITA"])
      .order("data", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    const cleaned = ((data || []) as Movimento[]).filter(
      (m) => num(m.iva) !== 0,
    );
    setRows(cleaned);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ivaDebitoAll = useMemo(
    () => rows.filter((m) => m.tipologia === "ENTRATA" && num(m.iva) !== 0),
    [rows],
  );

  const ivaCreditoAll = useMemo(
    () => rows.filter((m) => m.tipologia === "USCITA" && num(m.iva) !== 0),
    [rows],
  );

  const applySearch = (list: Movimento[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;

    return list.filter((m) => {
      const me = m.is_costo_generale ? "COSTI_GENERALI" : m.macro;
      const a = (macroLabel(me) || "").toLowerCase();
      const b = (m.descrizione_label || "").toLowerCase();
      const c = (m.descrizione_operazione || "").toLowerCase();
      const d = (m.descrizione_libera || "").toLowerCase();
      const e = (fmtDate(m.data) || "").toLowerCase();
      return (
        a.includes(q) || b.includes(q) || c.includes(q) || d.includes(q) || e.includes(q)
      );
    });
  };

  const ivaDebito = useMemo(
    () => applySearch(ivaDebitoAll),
    [ivaDebitoAll, search],
  );

  const ivaCredito = useMemo(
    () => applySearch(ivaCreditoAll),
    [ivaCreditoAll, search],
  );

  const totDebito = useMemo(
    () => ivaDebito.reduce((s, m) => s + num(m.iva), 0),
    [ivaDebito],
  );

  const totCredito = useMemo(
    () => ivaCredito.reduce((s, m) => s + num(m.iva), 0),
    [ivaCredito],
  );

  const saldo = useMemo(() => totDebito - totCredito, [totDebito, totCredito]);

  const openEdit = (id: string) => {
    localStorage.setItem("movimento_edit_id", id);
    window.location.href = "/movimento";
  };

  const filterBar: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
    padding: "12px 14px",
    borderRadius: 14,
    background: "var(--card, rgba(0,0,0,0.03))",
    marginTop: 12,
    marginBottom: 12,
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

  const rowGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    columnGap: 12,
    alignItems: "start",
  };

  const chipStyle: React.CSSProperties = {
    width: 44,
    minWidth: 44,
    height: 44,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(0,0,0,0.1)",
    background: "rgba(0,0,0,0.02)",
    lineHeight: 1,
    marginTop: 2,
  };

  const SectionList = ({
    title,
    tone,
    list,
    total,
    emptyText,
  }: {
    title: string;
    tone: "green" | "red" | "neutral";
    list: Movimento[];
    total: number;
    emptyText: string;
  }) => (
    <Card
      title={title}
      right={
        <Badge tone={tone as any}>
          Totale:{" "}
          <b>
            <Euro v={total} />
          </b>
        </Badge>
      }
    >
      <div className="listBox">
        {list.length === 0 ? (
          <div className="listRow">
            <div className="rowMain">
              <div className="rowSub">{emptyText}</div>
            </div>
          </div>
        ) : (
          list
            .slice()
            .sort((a, b) => ymdKey(b.data).localeCompare(ymdKey(a.data)))
            .map((m, idx) => {
              const me = m.is_costo_generale ? "COSTI_GENERALI" : m.macro;
              const { day, mon } = dateChipParts(m.data);
              const descr = bestDescr(m);

              return (
                <div key={m.id}>
                  <div
                    className="listRow"
                    style={rowGrid}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openEdit(m.id);
                    }}
                  >
                    <div style={chipStyle} aria-label={`Data: ${fmtDate(m.data)}`}>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>{day}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.75 }}>
                        {mon}
                      </div>
                    </div>

                    <div className="rowMain" style={{ minWidth: 0 }}>
                      <div className="rowMeta" style={{ marginTop: 0, marginBottom: 8 }}>
                        <Badge tone={tone as any}>
                          {m.tipologia === "ENTRATA" ? "Entrata" : "Uscita"}
                        </Badge>
                        <Badge tone="neutral">{macroLabel(me)}</Badge>
                      </div>

                      <div className="rowTitle" style={{ whiteSpace: "normal" }}>
                        {descr}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
                        {fmtDate(m.data)}
                      </div>
                    </div>

                    <div className="rowAmount" style={{ justifySelf: "end", textAlign: "right" }}>
                      <div style={{ fontWeight: 950 }}>
                        <Euro v={num(m.iva)} />
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
                        IVA
                      </div>
                    </div>
                  </div>

                  {idx !== list.length - 1 ? (
                    <div
                      style={{
                        height: 1,
                        background: "rgba(0,0,0,0.07)",
                        margin: "0 14px",
                      }}
                    />
                  ) : null}
                </div>
              );
            })
        )}
      </div>
    </Card>
  );

  return (
    <Layout>
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">LIQUIDAZIONE IVA</h2>
          <div className="pageHelp">
            Movimenti IVA.
            <br />
            <b>IVA a debito</b> = IVA sulle entrate<br /> <b>IVA a credito</b> = IVA sulle uscite.
            {annualitaAnno ? (
              <>
                <br />
                Annualità: <b>{annualitaAnno}</b>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      <div style={filterBar}>
        <input
          style={ctrl}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca (data, categoria/macro, descrizione...)"
        />

        <div className="rowSub" style={{ marginTop: -2 }}>
          Righe IVA: <b>{ivaDebito.length + ivaCredito.length}</b> (debito{" "}
          {ivaDebito.length} • credito {ivaCredito.length})
        </div>
      </div>

      {/* ✅ PRIMA LE SEZIONI */}
      <SectionList
        title="IVA a debito"
        tone="red"
        list={ivaDebito}
        total={totDebito}
        emptyText="Nessuna IVA a debito trovata (entrate con IVA)."
      />

      <div className="mt-3" />

      <SectionList
        title="IVA a credito"
        tone="green"
        list={ivaCredito}
        total={totCredito}
        emptyText="Nessuna IVA a credito trovata (uscite con IVA)."
      />

      <div className="mt-3" />

      {/* ✅ POI IL RIEPILOGO */}
      <Card
        title="Riepilogo IVA"
        right={
          <Badge tone={saldo >= 0 ? "red" : "green"}>
            Saldo:{" "}
            <b>
              <Euro v={saldo} />
            </b>
          </Badge>
        }
      >
        <div className="listBox">
          <div
            className="listRow"
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}
          >
            <div className="rowMain">
              <div className="rowTitle">Totale IVA a debito</div>
              <div className="rowSub">Somma IVA di tutte le entrate</div>
            </div>
            <div className="rowAmount" style={{ justifySelf: "end", textAlign: "right" }}>
              <Euro v={totDebito} />
            </div>
          </div>

          <div
            className="listRow"
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}
          >
            <div className="rowMain">
              <div className="rowTitle">Totale IVA a credito</div>
              <div className="rowSub">Somma IVA di tutte le uscite</div>
            </div>
            <div className="rowAmount" style={{ justifySelf: "end", textAlign: "right" }}>
              <Euro v={totCredito} />
            </div>
          </div>

          <div
            className="listRow"
            style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}
          >
            <div className="rowMain">
              <div className="rowTitle">Saldo (debito − credito)</div>
              <div className="rowSub">
                Se positivo: IVA da versare • se negativo: credito IVA
              </div>
            </div>
            <div
              className="rowAmount"
              style={{ justifySelf: "end", textAlign: "right", fontWeight: 950 }}
            >
              <Euro v={saldo} />
            </div>
          </div>
        </div>
      </Card>

      <div style={{ height: 90 }} />
    </Layout>
  );
}
