import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, Euro, PrimaryButton } from "../components/ui";

type AigRow = { id: string };
type AttDivRow = { id: string; occasionale: boolean };

type Movimento = {
  tipologia: "ENTRATA" | "USCITA";
  macro: string | null;
  descrizione_code: number | null;
  importo: number;
  allocated_to_type: string | null;
  allocated_to_id: string | null;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Row “wrap-safe” (niente ellipsis, va a capo) */
function WrapRow({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 12,
        alignItems: "start",
        padding: "10px 0",
      }}
    >
      <div
        style={{
          whiteSpace: "normal",
          overflow: "visible",
          textOverflow: "clip",
          lineHeight: 1.25,
          minWidth: 0,
        }}
      >
        {label}
      </div>

      <div
        style={{
          justifySelf: "end",
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

type WarnCounts = {
  AIG: number;
  ATTIVITA_DIVERSE: number;
  RACCOLTE_FONDI: number;
  total: number;
};

export default function Test() {
  const navigate = useNavigate();
  const annualitaId = localStorage.getItem("annualita_id");

  const [error, setError] = useState<string | null>(null);
  const [tipoEnte, setTipoEnte] = useState<string>("ETS");

  const [aigIds, setAigIds] = useState<string[]>([]);
  const [adOccasionaleIds, setAdOccasionaleIds] = useState<string[]>([]);
  const [mov, setMov] = useState<Movimento[]>([]);

  const [aigEsiti, setAigEsiti] = useState<
    {
      aig_id: string;
      TE: number;
      TU: number;
      costi_generali_imputati: number;
      TU_eff: number;
      TER: number;
      esito: "COMMERCIALE" | "NON COMMERCIALE";
    }[]
  >([]);

  // ✅ WARNING: movimenti non assegnati (solo AIG / AD / RF)
  const [warn, setWarn] = useState<WarnCounts | null>(null);

  // -------------------------
  // LOAD
  // -------------------------
  const loadTipoEnte = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("profiles")
      .select("tipo_ente")
      .eq("id", userData.user.id)
      .single();

    if (data?.tipo_ente) setTipoEnte(data.tipo_ente);
  };

  const loadIds = async () => {
    if (!annualitaId) return;

    const { data: aigs, error: aErr } = await supabase
      .from("aig")
      .select("id")
      .eq("annualita_id", annualitaId);

    if (aErr) return setError(aErr.message);

    const { data: ads, error: adErr } = await supabase
      .from("attivita_diverse")
      .select("id, occasionale")
      .eq("annualita_id", annualitaId);

    if (adErr) return setError(adErr.message);

    setAigIds((aigs || []).map((a: AigRow) => a.id));
    setAdOccasionaleIds(
      (ads || [])
        .filter((a: AttDivRow) => a.occasionale)
        .map((a: AttDivRow) => a.id),
    );
  };

  const loadMovimenti = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("movimenti")
      .select(
        "tipologia, macro, descrizione_code, importo, allocated_to_type, allocated_to_id",
      )
      .eq("annualita_id", annualitaId)
      .in("tipologia", ["ENTRATA", "USCITA"]);

    if (error) {
      setError(error.message);
      return;
    }

    setMov((data || []) as Movimento[]);
  };

  // ✅ conta solo movimenti con macro AIG / ATTIVITA_DIVERSE / RACCOLTE_FONDI
  // che non sono assegnati (allocated_to_id null o allocated_to_type null)
  const computeWarnings = (rows: Movimento[]) => {
    const relevant = rows.filter(
      (m) =>
        m.macro === "AIG" ||
        m.macro === "ATTIVITA_DIVERSE" ||
        m.macro === "RACCOLTE_FONDI",
    );

    const unassigned = relevant.filter(
      (m) => !m.allocated_to_id || !m.allocated_to_type,
    );

    const AIG = unassigned.filter((m) => m.macro === "AIG").length;
    const ATTIVITA_DIVERSE = unassigned.filter(
      (m) => m.macro === "ATTIVITA_DIVERSE",
    ).length;
    const RACCOLTE_FONDI = unassigned.filter(
      (m) => m.macro === "RACCOLTE_FONDI",
    ).length;

    const total = AIG + ATTIVITA_DIVERSE + RACCOLTE_FONDI;

    setWarn({ AIG, ATTIVITA_DIVERSE, RACCOLTE_FONDI, total });
  };

  // -------------------------
  // COSTI GENERALI: stessa logica AIG (riparto proporzionale a TE)
  // -------------------------
  const totalCostiGenerali = useMemo(() => {
    // COSTI_GENERALI = macro "COSTI_GENERALI" e tipologia "USCITA"
    return mov
      .filter((m) => m.tipologia === "USCITA" && m.macro === "COSTI_GENERALI")
      .reduce((s, m) => s + num(m.importo), 0);
  }, [mov]);

  // TE totale di tutte le AIG (serve per ripartire)
  const totalTE_AIG = useMemo(() => {
    return mov
      .filter(
        (m) =>
          m.tipologia === "ENTRATA" &&
          m.allocated_to_type === "AIG" &&
          !!m.allocated_to_id,
      )
      .reduce((s, m) => s + num(m.importo), 0);
  }, [mov]);

  // quota costi generali imputata a una singola AIG (proporzionale a TE)
  const costiGeneraliPerAig = useMemo(() => {
    const map = new Map<string, number>();

    if (!totalCostiGenerali || !totalTE_AIG) return map;

    // TE per AIG
    const teByAig = new Map<string, number>();
    for (const m of mov) {
      if (
        m.tipologia === "ENTRATA" &&
        m.allocated_to_type === "AIG" &&
        m.allocated_to_id
      ) {
        teByAig.set(
          m.allocated_to_id,
          (teByAig.get(m.allocated_to_id) || 0) + num(m.importo),
        );
      }
    }

    // riparto: quota = costi_generali_tot * (TE_aig / TE_tot)
    for (const [aigId, te] of teByAig.entries()) {
      map.set(aigId, totalCostiGenerali * (te / totalTE_AIG));
    }

    return map;
  }, [mov, totalCostiGenerali, totalTE_AIG]);

  // -------------------------
  // CALCOLO ESITI AIG (✅ TU effettivo = TU + costi generali imputati)
  // -------------------------
  const computeAigEsiti = () => {
    const out: any[] = [];

    for (const id of aigIds) {
      const entrate = mov.filter(
        (m) =>
          m.tipologia === "ENTRATA" &&
          m.allocated_to_type === "AIG" &&
          m.allocated_to_id === id,
      );
      const uscite = mov.filter(
        (m) =>
          m.tipologia === "USCITA" &&
          m.allocated_to_type === "AIG" &&
          m.allocated_to_id === id,
      );

      const TE = entrate.reduce((s, m) => s + num(m.importo), 0);
      const TU = uscite.reduce((s, m) => s + num(m.importo), 0);

      const TER =
        tipoEnte === "APS"
          ? entrate
              .filter((m) => ![1, 2].includes(Number(m.descrizione_code ?? -1)))
              .reduce((s, m) => s + num(m.importo), 0)
          : TE;

      const costi_generali_imputati = costiGeneraliPerAig.get(id) || 0;
      const TU_eff = TU + costi_generali_imputati;

      // ✅ stessa regola AIG: confronto su TU_eff
      const esito = TER > TU_eff * 1.06 ? "COMMERCIALE" : "NON COMMERCIALE";

      out.push({
        aig_id: id,
        TE,
        TU,
        costi_generali_imputati,
        TU_eff,
        TER,
        esito,
      });
    }

    setAigEsiti(out);
  };

  useEffect(() => {
    (async () => {
      setError(null);
      await loadTipoEnte();
      await loadIds();
      await loadMovimenti();
    })();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    computeAigEsiti();
    computeWarnings(mov);
    // eslint-disable-next-line
  }, [tipoEnte, aigIds, mov, costiGeneraliPerAig]);

  // -------------------------
  // TEST COMMERCIALITÀ ENTE
  // -------------------------
  const A = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "COMMERCIALE")
        .reduce((s, x) => s + x.TER, 0),
    [aigEsiti],
  );

  const C = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "NON COMMERCIALE")
        .reduce((s, x) => s + x.TER, 0),
    [aigEsiti],
  );

  // ✅ B: solo entrate AD allocati + esclusione sponsorizzazioni (code=6)
  // + esclusione se allocata a AD occasionale
  const B = useMemo(() => {
    const entrateADAlloc = mov.filter(
      (m) =>
        m.tipologia === "ENTRATA" &&
        m.macro === "ATTIVITA_DIVERSE" &&
        m.allocated_to_type === "ATTIVITA_DIVERSE" &&
        !!m.allocated_to_id,
    );

    return entrateADAlloc
      .filter((m) => {
        const spons = Number(m.descrizione_code ?? -1) === 6;
        const occ = m.allocated_to_id
          ? adOccasionaleIds.includes(m.allocated_to_id)
          : false;
        return !spons && !occ;
      })
      .reduce((s, m) => s + num(m.importo), 0);
  }, [mov, adOccasionaleIds]);

  const D = useMemo(() => {
    const macros = [
      "QUOTE_ASSOCIATIVE",
      "EROGAZIONI_LIBERALI",
      "PROVENTI_5X1000",
      "CONTRIBUTI_PA_SENZA_CORRISPETTIVO",
      "ALTRI_PROVENTI_NON_COMMERCIALI",
    ];
    return mov
      .filter(
        (m) => m.tipologia === "ENTRATA" && m.macro && macros.includes(m.macro),
      )
      .reduce((s, m) => s + num(m.importo), 0);
  }, [mov]);

  const enteIsCommerciale = useMemo(() => A + B > C + D, [A, B, C, D]);
  const enteEsito = enteIsCommerciale
    ? "ENTE COMMERCIALE"
    : "ENTE NON COMMERCIALE";

  // -------------------------
  // SECONDARIETÀ (30% / 66%)
  // -------------------------
  const TotEntrateAD = useMemo(
    () =>
      mov
        .filter(
          (m) => m.tipologia === "ENTRATA" && m.macro === "ATTIVITA_DIVERSE",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const TotEntrateEnte = useMemo(
    () =>
      mov
        .filter((m) => m.tipologia === "ENTRATA")
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const TotCostiEnte = useMemo(
    () =>
      mov
        .filter((m) => m.tipologia === "USCITA")
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const soglia30 = TotEntrateEnte * 0.3;
  const soglia66 = TotCostiEnte * 0.66;

  const esito30 =
    soglia30 < TotEntrateAD ? "NON SECONDARIE (KO)" : "SECONDARIE (OK)";
  const esito66 =
    soglia66 < TotEntrateAD ? "NON SECONDARIE (KO)" : "SECONDARIE (OK)";

  const toneEnte = enteIsCommerciale ? "red" : "green";
  const tone30 = esito30.includes("KO") ? "red" : "green";
  const tone66 = esito66.includes("KO") ? "red" : "green";

  // -------------------------
  // UI
  // -------------------------
  return (
    <Layout>
      <div className="pageTopbar">
        <h2 className="pageTitle">Test</h2>
        <div className="pageHelp">
          In questa sezione si verifica la natura Commerciale o Non Commericiale
          dell'intero Ente, nonché la verifica di secondarietà delle attività
          diverse esercitate nell'annualità di riferiemnto.
        </div>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      {/* ✅ AVVERTENZA: movimenti non assegnati (solo AIG / AD / RF) */}
      {warn && warn.total > 0 && (
        <div className="mt-3">
          <div
            className="listRow"
            style={{
              border: "1px solid rgba(245,158,11,0.55)",
              background: "rgba(245,158,11,0.10)",
              borderRadius: 14,
            }}
          >
            <div className="rowMain">
              <div
                className="rowMeta"
                style={{ marginTop: 0, marginBottom: 8 }}
              >
                <Badge tone="amber">Attenzione</Badge>
              </div>

              <div className="rowTitle" style={{ whiteSpace: "normal" }}>
                Non tutte le Entrate ed Uscite registrate sono state assegnate
                alle specifiche attività svolte dall'Ente.
              </div>

              <div
                className="rowSub"
                style={{ whiteSpace: "normal", marginTop: 6 }}
              >
                Per un test attendibile, assegna tutte le Entrate ed Uscite alle
                singole <b>AIG</b>, <b>Attività Diverse</b> e{" "}
                <b>Raccolte Fondi</b> create oppure crea nuove AIG, Attività
                Diverse e Raccolta Fondi in cui allocare queste Entrate ed
                Uscite.
                <div style={{ marginTop: 10 }}>
                  Totale non assegnati: <b>{warn.total}</b>
                  {warn.AIG ? (
                    <>
                      {" "}
                      • AIG: <b>{warn.AIG}</b>
                    </>
                  ) : null}
                  {warn.ATTIVITA_DIVERSE ? (
                    <>
                      {" "}
                      • Diverse: <b>{warn.ATTIVITA_DIVERSE}</b>
                    </>
                  ) : null}
                  {warn.RACCOLTE_FONDI ? (
                    <>
                      {" "}
                      • Raccolte: <b>{warn.RACCOLTE_FONDI}</b>
                    </>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="btn"
                    type="button"
                    onClick={() => navigate("/aig")}
                  >
                    Vai a AIG
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => navigate("/attivita-diverse")}
                  >
                    Vai a Attività Diverse
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => navigate("/raccolte-fondi")}
                  >
                    Vai a Raccolte Fondi
                  </button>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                  Nota: le macro <b>Quote associative</b>,{" "}
                  <b>Erogazioni liberali</b>, <b>5×1000</b>,{" "}
                  <b>Contributi PA</b>, <b>Altri proventi NC</b>{" "}
                  <b>non vanno assegnate</b> a nessuna scheda.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3" />

      <Card
        title="Test di commercialità dell’ente"
        right={<Badge tone={toneEnte as any}>{enteEsito}</Badge>}
      >
        <WrapRow label="A) Entrate AIG commerciali" value={<Euro v={A} />} />
        <WrapRow
          label="B) Entrate Attività Diverse rilevanti"
          value={<Euro v={B} />}
        />
        <WrapRow
          label="C) Entrate AIG non commerciali"
          value={<Euro v={C} />}
        />
        <WrapRow
          label="D) Altre entrate non commerciali"
          value={<Euro v={D} />}
        />

        <div className="muted" style={{ marginTop: 10, lineHeight: 1.4 }}>
          Regola: se (A + B) &gt; (C + D) ⇒ Ente commerciale, altrimenti non
          commerciale.
        </div>

        {/* opzionale: debug riparto costi generali */}
        {totalCostiGenerali > 0 && (
          <div className="muted" style={{ marginTop: 10, lineHeight: 1.4 }}>
            Costi generali totali (macro COSTI_GENERALI):{" "}
            <b>
              <Euro v={totalCostiGenerali} />
            </b>{" "}
            • Ripartiti sulle AIG proporzionalmente a TE
          </div>
        )}
      </Card>

      <Card title="Test di secondarietà (Attività Diverse)">
        <WrapRow
          label="Entrate Attività Diverse (tutte)"
          value={<Euro v={TotEntrateAD} />}
        />
        <WrapRow
          label="Totale entrate ente"
          value={<Euro v={TotEntrateEnte} />}
        />
        <WrapRow
          label="Soglia 30% (Entrate × 0,30)"
          value={<Euro v={soglia30} />}
        />

        <div style={{ marginTop: 10 }}>
          <Badge tone={tone30 as any}>{esito30}</Badge>
        </div>

        <div style={{ height: 10 }} />

        <WrapRow label="Totale costi ente" value={<Euro v={TotCostiEnte} />} />
        <WrapRow
          label="Soglia 66% (Costi × 0,66)"
          value={<Euro v={soglia66} />}
        />

        <div style={{ marginTop: 10 }}>
          <Badge tone={tone66 as any}>{esito66}</Badge>
        </div>

        <div className="muted" style={{ marginTop: 10, lineHeight: 1.4 }}>
          Regola: le Attività Diverse sono <b>SECONDARIE</b> se rispettano
          almeno una delle due condizioni:
          <br />
          1) Entrate AD ≤ 30% del totale entrate ente
          <br />
          2) Entrate AD ≤ 66% del totale costi ente
        </div>
      </Card>

      <div className="mt-3" />

      <div style={{ textAlign: "center" }}>
        <PrimaryButton onClick={() => navigate("/ires")}>
          Vai al calcolo IRES →
        </PrimaryButton>
      </div>
    </Layout>
  );
}
