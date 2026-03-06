import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, Euro } from "../components/ui";

type AigRow = { id: string };
type AttDivRow = { id: string; occasionale: boolean };

type Regime = "FORFETTARIO" | "ORDINARIO";

type AnnualitaRow = {
  id: string;
  ricavi_annualita_precedente: number | null;
  regime: string | null; // ⚠️ lo normalizziamo (potrebbe arrivare "Forfettario", "FORFETARIO ", ecc.)
};

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

/** Row “wrap-safe”: niente ellipsis, etichette sempre intere */
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

export default function Ires() {
  const annualitaId = localStorage.getItem("annualita_id");

  const [error, setError] = useState<string | null>(null);

  const [tipoEnte, setTipoEnte] = useState<string>("ETS"); // "APS" | "ODV" | "ETS"
  const [ricaviPrec, setRicaviPrec] = useState<number>(0); // solo visualizzazione
  const [regimeAnnualita, setRegimeAnnualita] = useState<Regime>("ORDINARIO");

  const [aigIds, setAigIds] = useState<string[]>([]);
  const [adOccasionaleIds, setAdOccasionaleIds] = useState<string[]>([]);
  const [mov, setMov] = useState<Movimento[]>([]);

  const [aigEsiti, setAigEsiti] = useState<
    {
      aig_id: string;
      TE: number; // Totale Entrate assegnate all'AIG
      TU: number; // Totale Uscite assegnate all'AIG
      TER: number; // Entrate rilevanti (APS: escludi code 1 e 2)
      esito: "COMMERCIALE" | "NON COMMERCIALE"; // test 6%
    }[]
  >([]);

  // =========================
  // LOAD DATI
  // =========================
  const loadTipoEnte = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("tipo_ente")
      .eq("id", userData.user.id)
      .single();

    if (error) return setError(error.message);
    if (data?.tipo_ente) setTipoEnte(data.tipo_ente);
  };

  const loadAnnualita = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("annualita")
      .select("ricavi_annualita_precedente, regime")
      .eq("id", annualitaId)
      .single();

    if (error) return setError(error.message);

    const row = data as AnnualitaRow;

    setRicaviPrec(num(row.ricavi_annualita_precedente));

    // ✅ NORMALIZZAZIONE ROBUSTA DEL REGIME
    const regimeDb = (row.regime ?? "").toString().trim().toUpperCase();
    if (regimeDb === "FORFETTARIO") setRegimeAnnualita("FORFETTARIO");
    else setRegimeAnnualita("ORDINARIO");
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

    setAigIds(((aigs || []) as AigRow[]).map((x) => x.id));
    setAdOccasionaleIds(
      ((ads || []) as AttDivRow[])
        .filter((x) => x.occasionale)
        .map((x) => x.id),
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

    if (error) return setError(error.message);
    setMov((data || []) as Movimento[]);
  };

  // =========================
  // ESITI AIG (test 6%)
  // =========================
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

      const esito = TER > TU * 1.06 ? "COMMERCIALE" : "NON COMMERCIALE";
      out.push({ aig_id: id, TE, TU, TER, esito });
    }

    setAigEsiti(out);
  };

  useEffect(() => {
    (async () => {
      setError(null);
      await loadTipoEnte();
      await loadAnnualita();
      await loadIds();
      await loadMovimenti();
    })();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    computeAigEsiti();
    // eslint-disable-next-line
  }, [tipoEnte, aigIds, mov]);

  // =========================
  // TEST NATURA ENTE (A+B > C+D)
  // =========================
  // ✅ A e C: su TE
  const A_test = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "COMMERCIALE")
        .reduce((s, x) => s + x.TE, 0),
    [aigEsiti],
  );

  const C_test = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "NON COMMERCIALE")
        .reduce((s, x) => s + x.TE, 0),
    [aigEsiti],
  );

  // ✅ B: Entrate AD rilevanti (assegnate, no spons code=6, no AD occasionale)
  const B_test = useMemo(() => {
    return mov
      .filter(
        (m) =>
          m.tipologia === "ENTRATA" &&
          m.macro === "ATTIVITA_DIVERSE" &&
          m.allocated_to_type === "ATTIVITA_DIVERSE" &&
          !!m.allocated_to_id,
      )
      .filter((m) => {
        const spons = Number(m.descrizione_code ?? -1) === 6;
        const occ = m.allocated_to_id
          ? adOccasionaleIds.includes(m.allocated_to_id)
          : false;
        return !spons && !occ;
      })
      .reduce((s, m) => s + num(m.importo), 0);
  }, [mov, adOccasionaleIds]);

  // ✅ D: altre entrate non commerciali
  const D_test = useMemo(() => {
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

  const enteNatura: "COMMERCIALE" | "NON COMMERCIALE" =
    A_test + B_test > C_test + D_test ? "COMMERCIALE" : "NON COMMERCIALE";

  // =========================
  // TOTALI PER LE 4 CASISTICHE IRES
  // =========================

  // --- AIG: entrate/uscite commerciali vs non commerciali (per esito AIG)
  const TotEntrateAigComm = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "COMMERCIALE")
        .reduce((s, x) => s + x.TE, 0),
    [aigEsiti],
  );

  const TotUsciteAigComm = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "COMMERCIALE")
        .reduce((s, x) => s + x.TU, 0),
    [aigEsiti],
  );

  const TotEntrateAigNonComm = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "NON COMMERCIALE")
        .reduce((s, x) => s + x.TE, 0),
    [aigEsiti],
  );

  const TotUsciteAigNonComm = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "NON COMMERCIALE")
        .reduce((s, x) => s + x.TU, 0),
    [aigEsiti],
  );

  const TotEntrateAigTutte = TotEntrateAigComm + TotEntrateAigNonComm;
  const TotUsciteAigTutte = TotUsciteAigComm + TotUsciteAigNonComm;

  // --- Attività Diverse (tutte): entrate / uscite
  const TotEntrateAD = useMemo(
    () =>
      mov
        .filter(
          (m) => m.tipologia === "ENTRATA" && m.macro === "ATTIVITA_DIVERSE",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const TotUsciteAD = useMemo(
    () =>
      mov
        .filter(
          (m) => m.tipologia === "USCITA" && m.macro === "ATTIVITA_DIVERSE",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  // --- Raccolte Fondi: entrate / uscite
  const TotEntrateRF = useMemo(
    () =>
      mov
        .filter(
          (m) => m.tipologia === "ENTRATA" && m.macro === "RACCOLTE_FONDI",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const TotUsciteRF = useMemo(
    () =>
      mov
        .filter(
          (m) => m.tipologia === "USCITA" && m.macro === "RACCOLTE_FONDI",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  // --- “pacchetto” entrate NC specifiche (quote + liberalità + 5x1000 + contributi PA)
  const TotQuote = useMemo(
    () =>
      mov
        .filter(
          (m) => m.tipologia === "ENTRATA" && m.macro === "QUOTE_ASSOCIATIVE",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const TotLiberalita = useMemo(
    () =>
      mov
        .filter(
          (m) =>
            m.tipologia === "ENTRATA" && m.macro === "EROGAZIONI_LIBERALI",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const Tot5x1000 = useMemo(
    () =>
      mov
        .filter(
          (m) => m.tipologia === "ENTRATA" && m.macro === "PROVENTI_5X1000",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const TotContributiPA = useMemo(
    () =>
      mov
        .filter(
          (m) =>
            m.tipologia === "ENTRATA" &&
            m.macro === "CONTRIBUTI_PA_SENZA_CORRISPETTIVO",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const TotAltreNC_Pacchetto =
    TotQuote + TotLiberalita + Tot5x1000 + TotContributiPA;

  // =========================
  // CALCOLO IRES: 4 CASI (come tua specifica)
  // =========================
  const regimeDaAnnualita: Regime = regimeAnnualita;

  // ✅ se forfetario ma ente commerciale -> applico ordinario
  const regimeEffettivo: Regime =
    regimeDaAnnualita === "FORFETTARIO" && enteNatura === "COMMERCIALE"
      ? "ORDINARIO"
      : regimeDaAnnualita;

  const utile = useMemo(() => {
    // 1) ORDINARIO + ENTE NON COMMERCIALE
    if (regimeEffettivo === "ORDINARIO" && enteNatura === "NON COMMERCIALE") {
      return (
        TotEntrateAigComm +
        TotEntrateAD -
        TotUsciteAigComm -
        TotUsciteAD
      );
    }

    // 2) ORDINARIO + ENTE COMMERCIALE
    if (regimeEffettivo === "ORDINARIO" && enteNatura === "COMMERCIALE") {
      return (
        TotEntrateAigTutte +
        TotEntrateAD +
        TotEntrateRF +
        TotAltreNC_Pacchetto -
        TotUsciteAigTutte -
        TotUsciteAD -
        TotUsciteRF
      );
    }

    // 3) FORFETTARIO + ENTE NON COMMERCIALE
    if (regimeEffettivo === "FORFETTARIO" && enteNatura === "NON COMMERCIALE") {
      return (
        TotEntrateAigComm +
        TotEntrateAD -
        TotUsciteAigComm -
        TotUsciteAD
      );
    }

    // 4) FORFETTARIO + ENTE COMMERCIALE -> già forzato a ORDINARIO sopra
    return 0;
  }, [
    regimeEffettivo,
    enteNatura,
    TotEntrateAigComm,
    TotUsciteAigComm,
    TotEntrateAD,
    TotUsciteAD,
    TotEntrateAigTutte,
    TotUsciteAigTutte,
    TotEntrateRF,
    TotUsciteRF,
    TotAltreNC_Pacchetto,
  ]);

  const aliquota = useMemo(() => {
    // Ordinario: sempre 24%
    if (regimeEffettivo === "ORDINARIO") return 0.24;

    // Forfetario ammesso solo se ente NON commerciale
    if (regimeEffettivo === "FORFETTARIO" && enteNatura === "NON COMMERCIALE") {
      if (tipoEnte === "APS") return 0.0072;
      if (tipoEnte === "ODV") return 0.0024;
      // come tua specifica: ETS -> 24%
      return 0.24;
    }

    return 0.24;
  }, [regimeEffettivo, enteNatura, tipoEnte]);

  const ires = useMemo(() => {
    const base = Math.max(0, utile);
    return base * aliquota;
  }, [utile, aliquota]);

  // label descrittiva del caso applicato
  const casoLabel = useMemo(() => {
    if (regimeDaAnnualita === "FORFETTARIO" && enteNatura === "COMMERCIALE") {
      return "FORFETTARIO (da Annualità) ma Ente COMMERCIALE: applicato ORDINARIO";
    }
    return `${regimeEffettivo} – Ente ${enteNatura}`;
  }, [regimeDaAnnualita, regimeEffettivo, enteNatura]);

  // =========================
  // UI
  // =========================
  return (
    <Layout>
      <div className="pageTopbar" style={{ marginBottom: 14, paddingTop: 15 }}>
        <h2 className="pageTitle">IRES</h2>
        <Badge tone={enteNatura === "COMMERCIALE" ? "red" : "green"}>
          {enteNatura}
        </Badge>
      </div>

      {error && (
        <div className="mt-3">
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}
    
      {/* REGIME: mostra quello scelto in Annualità + postilla */}
      <Card title="REGIME">
        <WrapRow
          label="Regime (da Annualità)"
          value={<strong>{regimeDaAnnualita}</strong>}
        />

        <div
          className="muted"
          style={{ marginTop: 10, fontSize: 12, lineHeight: 1.4 }}
        >
          Nota: per modificare il regime, intervenire dalla pagina{" "}
          <b>Annualità</b>.
        </div>
         <div style={{ marginTop: 8 }}>
          <WrapRow
            label="Ricavi annualità precedente (valore inserito in Annualità)"
            value={<Euro v={ricaviPrec} />}
          />
        </div>
           <div style={{ marginTop: 10 }}>
          <div
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(37,99,235,0.55)",
              background: "rgba(37,99,235,0.06)",
              color: "#1d4ed8",
              fontWeight: 900,
              fontSize: "clamp(12px, 3.2vw, 14px)",
              lineHeight: 1.2,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              textAlign: "center",
            }}
          >
            {casoLabel}
          </div>
      </Card>

     
        </div>

      <Card title="Calcolo IRES">
        {/* RIEPILOGO FORMULA */}
        {regimeEffettivo === "ORDINARIO" && enteNatura === "NON COMMERCIALE" && (
          <>
            <WrapRow
              label="Entrate (AIG commerciali + Attività Diverse)"
              value={<Euro v={TotEntrateAigComm + TotEntrateAD} />}
            />
            <WrapRow
              label="Uscite (AIG commerciali + Attività Diverse)"
              value={<Euro v={TotUsciteAigComm + TotUsciteAD} />}
            />
          </>
        )}

        {regimeEffettivo === "ORDINARIO" && enteNatura === "COMMERCIALE" && (
          <>
            <WrapRow
              label="Entrate (AIG comm+NC + AD + Raccolte Fondi + Quote + Liberalità + 5×1000 + Contributi PA)"
              value={
                <Euro
                  v={
                    TotEntrateAigTutte +
                    TotEntrateAD +
                    TotEntrateRF +
                    TotAltreNC_Pacchetto
                  }
                />
              }
            />
            <WrapRow
              label="Uscite (AIG comm+NC + AD + Raccolte Fondi)"
              value={<Euro v={TotUsciteAigTutte + TotUsciteAD + TotUsciteRF} />}
            />
          </>
        )}

        {regimeEffettivo === "FORFETTARIO" &&
          enteNatura === "NON COMMERCIALE" && (
            <>
              <WrapRow
                label="Entrate (AIG commerciali + Attività Diverse)"
                value={<Euro v={TotEntrateAigComm + TotEntrateAD} />}
              />
              <WrapRow
                label="Uscite (AIG commerciali + Attività Diverse)"
                value={<Euro v={TotUsciteAigComm + TotUsciteAD} />}
              />
            </>
          )}

        <div style={{ height: 8 }} />

        <WrapRow label="Utile (base)" value={<Euro v={utile} />} />
        <WrapRow
          label="Aliquota applicata"
          value={
            aliquota === 0.24
              ? "24%"
              : aliquota === 0.0072
                ? "0,72% (APS)"
                : "0,24% (ODV)"
          }
        />
        <WrapRow label="IRES" value={<Euro v={ires} />} />

        <div className="muted" style={{ marginTop: 12, lineHeight: 1.4 }}>
          {regimeDaAnnualita === "FORFETTARIO" && enteNatura === "COMMERCIALE" ? (
            <>
              Regola: se in Annualità è selezionato <b>FORFETTARIO</b> ma l’ente
              risulta <b>COMMERCIALE</b> al test, si applica il calcolo{" "}
              <b>ORDINARIO</b> (24%).
            </>
          ) : regimeEffettivo === "ORDINARIO" ? (
            <>
              Regola (ordinario): IRES = <b>24%</b> dell’utile (se utile negativo,
              IRES = 0).
            </>
          ) : (
            <>
              Regola (forfetario + ente NON commerciale): si calcola l’utile come
              da formula “non commerciale” e si applica il coefficiente:
              <b> APS 0,72%</b>, <b>ODV 0,24%</b>, <b>ETS 24%</b>.
            </>
          )}
        </div>
      </Card>
    </Layout>
  );
}
