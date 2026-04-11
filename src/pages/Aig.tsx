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
  importo: any;
  iva: any;
  allocated_to_id?: string | null;
};

type EsitoAig = {
  TE: number;
  TU: number;
  CG: number;
  TU_EFF: number;
  TER: number;
  soglia: number;
  esito: "COMMERCIALE" | "NON COMMERCIALE";
};

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

function totaleMov(m: Movimento) {
  return num(m.importo) + num(m.iva);
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
): EsitoAig {
  const TE = entrate.reduce((s, m) => s + totaleMov(m), 0);
  const TU = uscite.reduce((s, m) => s + totaleMov(m), 0);

  const CG = num(costiGeneraliImputati);
  const TU_EFF = TU + CG;

  const TER =
    tipoEnte !== "APS"
      ? TE
      : entrate
          .filter((m) => ![1, 2].includes(Number(m.descrizione_code ?? -1)))
          .reduce((s, m) => s + totaleMov(m), 0);

  const soglia = TU_EFF * 1.06;
  const esito: "COMMERCIALE" | "NON COMMERCIALE" =
    TER > soglia ? "COMMERCIALE" : "NON COMMERCIALE";

  return { TE, TU, CG, TU_EFF, TER, soglia, esito };
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

export default function Aig() {
  const annualitaId = localStorage.getItem("annualita_id");

  const [error, setError] = useState<string | null>(null);
  const [tipoEnte, setTipoEnte] = useState<string>("ETS");
  const [aigs, setAigs] = useState<AigRow[]>([]);
  const [aigUnicaSotto300k, setAigUnicaSotto300k] = useState(false);

  const [cgMap, setCgMap] = useState<Record<string, number>>({});
  const [esitiMap, setEsitiMap] = useState<Record<string, EsitoAig>>({});

  const [openSheet, setOpenSheet] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newDescr, setNewDescr] = useState("");

  const [activeAig, setActiveAig] = useState<AigRow | null>(null);

  const [availEntrate, setAvailEntrate] = useState<Movimento[]>([]);
  const [availUscite, setAvailUscite] = useState<Movimento[]>([]);
  const [assEntrate, setAssEntrate] = useState<Movimento[]>([]);
  const [assUscite, setAssUscite] = useState<Movimento[]>([]);

  const [selEntrate, setSelEntrate] = useState<Record<string, boolean>>({});
  const [selUscite, setSelUscite] = useState<Record<string, boolean>>({});

  const noEllipsis: React.CSSProperties = {
    whiteSpace: "normal",
    overflow: "visible",
    textOverflow: "clip",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    minWidth: 0,
  };

  const rowDivider: React.CSSProperties = {
    height: 1,
    background: "rgba(0,0,0,0.07)",
    margin: "0 14px",
  };

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

  const modalSection: React.CSSProperties = {
    marginTop: 14,
  };

  useEffect(() => {
    if (activeAig) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeAig]);

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

  const loadAnnualitaMode = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("annualita")
      .select("aig_unica_sotto_300k")
      .eq("id", annualitaId)
      .single();

    if (error) {
      setError(error.message);
      return;
    }

    setAigUnicaSotto300k(!!data?.aig_unica_sotto_300k);
  };

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

  const loadMovimentiForAig = async (aigId: string) => {
    setError(null);
    if (!annualitaId) return;

    const baseSelect =
      "id, tipologia, data, macro, descrizione_code, descrizione_label, descrizione_operazione, descrizione_libera, importo, iva";

    let ae: any[] | null = [];
    let au: any[] | null = [];

    if (!aigUnicaSotto300k) {
      const { data: aeData, error: aeErr } = await supabase
        .from("movimenti")
        .select(baseSelect)
        .eq("annualita_id", annualitaId)
        .eq("macro", "AIG")
        .eq("tipologia", "ENTRATA")
        .is("allocated_to_id", null)
        .order("data", { ascending: true });

      if (aeErr) {
        setError(aeErr.message);
        return;
      }

      const { data: auData, error: auErr } = await supabase
        .from("movimenti")
        .select(baseSelect)
        .eq("annualita_id", annualitaId)
        .eq("macro", "AIG")
        .eq("tipologia", "USCITA")
        .is("allocated_to_id", null)
        .order("data", { ascending: true });

      if (auErr) {
        setError(auErr.message);
        return;
      }

      ae = aeData || [];
      au = auData || [];
    }

    const { data: se, error: seErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "AIG")
      .eq("allocated_to_id", aigId)
      .eq("tipologia", "ENTRATA")
      .order("data", { ascending: true });

    if (seErr) {
      setError(seErr.message);
      return;
    }

    const { data: su, error: suErr } = await supabase
      .from("movimenti")
      .select(baseSelect)
      .eq("annualita_id", annualitaId)
      .eq("allocated_to_type", "AIG")
      .eq("allocated_to_id", aigId)
      .eq("tipologia", "USCITA")
      .order("data", { ascending: true });

    if (suErr) {
      setError(suErr.message);
      return;
    }

    setAvailEntrate((ae || []) as Movimento[]);
    setAvailUscite((au || []) as Movimento[]);
    setAssEntrate((se || []) as Movimento[]);
    setAssUscite((su || []) as Movimento[]);
    setSelEntrate({});
    setSelUscite({});
  };

  const loadEsitiAllAigs = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("movimenti")
      .select("id, tipologia, importo, iva, descrizione_code, allocated_to_id")
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
        importo: r.importo ?? 0,
        iva: r.iva ?? 0,
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
    loadAnnualitaMode();
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

  useEffect(() => {
    if (!activeAig) return;
    loadMovimentiForAig(activeAig.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aigUnicaSotto300k]);

  const openCreate = () => {
    setError(null);

    if (aigUnicaSotto300k && aigs.length > 0) {
      alert(
        "Per questa annualità è attiva la modalità AIG unica sotto € 300.000. Puoi creare una sola AIG.",
      );
      return;
    }

    setNewNome("");
    setNewDescr("");
    setOpenSheet(true);
  };

  const createAig = async () => {
    setError(null);
    if (!annualitaId) return;

    const nome = newNome.trim();
    if (!nome) {
      alert("Nome AIG obbligatorio");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      alert("Utente non autenticato");
      return;
    }

    const { data: existingAigs, error: countErr } = await supabase
      .from("aig")
      .select("id")
      .eq("annualita_id", annualitaId);

    if (countErr) {
      alert(countErr.message);
      return;
    }

    const aigCount = (existingAigs || []).length;

    if (aigUnicaSotto300k && aigCount > 0) {
      alert(
        "Per questa annualità è consentita una sola AIG, perché è attiva la modalità AIG unica sotto € 300.000.",
      );
      return;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("aig")
      .insert({
        user_id: userData.user.id,
        annualita_id: annualitaId,
        nome,
        descrizione: newDescr.trim() || null,
      })
      .select("id, nome, descrizione")
      .single();

    if (insertErr || !inserted) {
      alert(insertErr?.message || "Errore creazione AIG");
      return;
    }

    if (aigUnicaSotto300k) {
      const { error: bulkAssignErr } = await supabase
        .from("movimenti")
        .update({
          allocated_to_type: "AIG",
          allocated_to_id: inserted.id,
        })
        .eq("annualita_id", annualitaId)
        .eq("macro", "AIG");

      if (bulkAssignErr) {
        alert(bulkAssignErr.message);
        return;
      }
    }

    setNewNome("");
    setNewDescr("");
    setOpenSheet(false);

    await loadAigs();
    await loadCostiGeneraliMap();
    await loadEsitiAllAigs();

    if (aigUnicaSotto300k) {
      await openAig(inserted as AigRow);
    }
  };

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

    await loadAigs();
    await loadCostiGeneraliMap();
    await loadEsitiAllAigs();
  };

  const openAig = async (a: AigRow) => {
    setActiveAig(a);
    await loadMovimentiForAig(a.id);
  };

  const unassignMovimento = async (movId: string) => {
    if (!activeAig) return;

    if (aigUnicaSotto300k) {
      alert(
        "Con la modalità AIG unica sotto € 300.000 attiva, i movimenti AIG restano assegnati automaticamente all'unica AIG.",
      );
      return;
    }

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
    await loadEsitiAllAigs();
  };

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
              marginBottom: 6,
              ...noEllipsis,
            }}
          >
            {fmtDate(m.data)}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <MiniTag tone={tone}>{isEntrata ? "Entrata" : "Uscita"}</MiniTag>
            <MiniTag tone="blue">{macroLabelTxt}</MiniTag>
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
            <EuroFmt v={totaleMov(m)} />
          </div>

          {!aigUnicaSotto300k && (
            <button
              className="iconBtn iconBtn--sm"
              type="button"
              title="Rimuovi assegnazione (torna tra disponibili)"
              onClick={() => unassignMovimento(m.id)}
              aria-label="Rimuovi assegnazione"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    );
  };

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
              marginBottom: 6,
              ...noEllipsis,
            }}
          >
            {fmtDate(m.data)}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <MiniTag tone={tone}>{isEntrata ? "Entrata" : "Uscita"}</MiniTag>
            <MiniTag tone="blue">{macroLabelTxt}</MiniTag>
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
            paddingTop: 18,
          }}
        >
          <EuroFmt v={totaleMov(m)} />
        </div>
      </label>
    );
  };

  const assignSelected = async (kind: "ENTRATA" | "USCITA") => {
    if (!activeAig) return;

    if (aigUnicaSotto300k) {
      alert(
        "Con la modalità AIG unica sotto € 300.000 attiva, l'assegnazione dei movimenti avviene automaticamente.",
      );
      return;
    }

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
        .update({ allocated_to_type: "AIG", allocated_to_id: activeAig.id })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }
    }

    await loadMovimentiForAig(activeAig.id);
    await loadCostiGeneraliMap();
    await loadEsitiAllAigs();
  };

  const TE = useMemo(
    () => assEntrate.reduce((s, m) => s + totaleMov(m), 0),
    [assEntrate],
  );

  const TU = useMemo(
    () => assUscite.reduce((s, m) => s + totaleMov(m), 0),
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
      .reduce((s, m) => s + totaleMov(m), 0);
  }, [TE, assEntrate, tipoEnte]);

  const soglia = useMemo(() => TU_EFF * 1.06, [TU_EFF]);
  const esito = useMemo(
    () => (TER > soglia ? "COMMERCIALE" : "NON COMMERCIALE"),
    [TER, soglia],
  );
  const esitoTone = esito === "COMMERCIALE" ? "red" : "green";

  return (
    <Layout>
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">AIG</h2>
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      <div className="mt-3">
        <div className="pageHelp" style={{ marginTop: 0 }}>
          {aigUnicaSotto300k
            ? `Per questa annualità è attiva l'opzione “Entrate T-1 non superiore a € 300.000”. È quindi consentita la creazione di una sola AIG in cui confluiranno tutti i movimenti "Entrate e Uscite" con categoria AIG.`
            : `Per questa annualità hai indicato che le Entrate T-1 sono state superiori a € 300.000, quindi devi creare tante AIG quante sono quelle effettivamente svolte.`}
        </div>

        <div style={{ marginTop: 10 }}>
          <Badge tone={aigUnicaSotto300k ? "green" : "red"}>
            {aigUnicaSotto300k
              ? "Modalità AIG unica attiva"
              : "Modalità AIG unica non attiva"}
          </Badge>
        </div>

        <div className="pageHelp" style={{ marginTop: 10, fontWeight: 800 }}>
          {aigUnicaSotto300k
            ? `N.B. Se l'Ente ha entrate superiori a € 300.000 devi considerare le diverse AIG singolarmente.`
            : `N.B. Se l'Ente ha avuto entrate non superiori a € 300.000 puoi considerare le diverse attività di interesse generale (AIG) svolte come se fossero un'unica attività ai fini della verifica del test di non commercialità.`}
        </div>

        <div style={{ marginTop: 12 }}>
          <PrimaryButton
            onClick={() => {
              if (!annualitaId) return;
              localStorage.setItem("annualita_edit_id", annualitaId);
              window.location.href = "/annualita";
            }}
          >
            Ravvedimento
          </PrimaryButton>
        </div>
      </div>

      <button
        className="fab"
        onClick={openCreate}
        type="button"
        aria-label="Crea nuova AIG"
        disabled={aigUnicaSotto300k && aigs.length > 0}
        title={
          aigUnicaSotto300k && aigs.length > 0
            ? "Per questa annualità puoi creare una sola AIG"
            : "Crea nuova AIG"
        }
        style={
          aigUnicaSotto300k && aigs.length > 0
            ? { opacity: 0.5, cursor: "not-allowed" }
            : undefined
        }
      >
        +
      </button>

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

              {aigUnicaSotto300k && aigs.length === 0 && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(37,99,235,0.18)",
                    background: "#eff6ff",
                    color: "#1e3a8a",
                    fontSize: 13,
                    lineHeight: 1.4,
                    fontWeight: 700,
                  }}
                >
                  Questa sarà l'unica AIG dell'annualità. Dopo il salvataggio,
                  tutti i movimenti con macro AIG verranno assegnati
                  automaticamente a questa attività.
                </div>
              )}

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
                    : "blue";

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
            style={{ ...fullModalSheet, maxWidth: "none", margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
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
                  width: "100%",
                  padding: "14px 0",
                }}
              >
                <div style={modalContainer}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      minHeight: 56,
                    }}
                  >
                    <div
                      className="sheetTitle"
                      style={{
                        fontWeight: 950,
                        lineHeight: 1.2,
                        margin: 0,
                        padding: 0,
                      }}
                    >
                      {activeAig.nome}
                    </div>

                    <button
                      className="btn"
                      onClick={() => setActiveAig(null)}
                      type="button"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={modalContainer}>
              <div style={{ paddingTop: 14, paddingBottom: 24 }}>
                {activeAig.descrizione && (
                  <div style={{ marginTop: 10, ...noEllipsis }}>
                    {activeAig.descrizione}
                  </div>
                )}

                {!aigUnicaSotto300k && (
                  <div style={modalSection}>
                    <Card title="MOVIMENTI NON ASSEGNATI">
                      <div className="splitGrid">
                        <div className="panel">
                          <div className="panelTitle">Entrate da assegnare</div>

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
                                    setSelEntrate((p) => ({ ...p, [m.id]: v }))
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
                                    setSelUscite((p) => ({ ...p, [m.id]: v }))
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
                )}

                {aigUnicaSotto300k && (
                  <div style={modalSection}>
                    <Card title="GESTIONE AUTOMATICA MOVIMENTI">
                      <div className="pageHelp">
                        In questa annualità la modalità AIG unica è attiva:
                        tutti i movimenti con macro AIG vengono attribuiti
                        automaticamente a questa AIG e non possono essere
                        assegnati o rimossi manualmente da questa schermata.
                      </div>
                    </Card>
                  </div>
                )}

                <div style={modalSection}>
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

                <div style={modalSection}>
                  <Card
                    title="Test AIG (6%)"
                    right={<Badge tone={esitoTone as any}>{esito}</Badge>}
                  >
                    <div style={noEllipsis}>
                      <WrapRowValue
                        label={
                          <span style={noEllipsis}>
                            TOTALE ENTRATE ASSEGNATE
                          </span>
                        }
                        value={<EuroFmt v={TE} />}
                      />
                      <WrapRowValue
                        label={
                          <span style={noEllipsis}>
                            TOTALE USCITE ASSEGNATE
                          </span>
                        }
                        value={<EuroFmt v={TU} />}
                      />
                      <WrapRowValue
                        label={
                          <span style={noEllipsis}>
                            COSTI GENERALI IMPUTATI
                          </span>
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
        </div>
      )}
    </Layout>
  );
}
