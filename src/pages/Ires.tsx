import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, Euro } from "../components/ui";

type AigRow = { id: string };
type AttDivRow = { id: string; occasionale: boolean };

// ✅ Regime salvato in Annualità
type Regime = "FORFETARIO" | "ORDINARIO";

type AnnualitaRow = {
  id: string;
  ricavi_annualita_precedente: number | null;
  regime: Regime | null;
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

  const [tipoEnte, setTipoEnte] = useState<string>("ETS");

  // valore “di contesto” mostrabile (non modifica il regime qui)
  const [ricaviPrec, setRicaviPrec] = useState<number>(0);

  // ✅ regime scelto in Annualità (fonte unica)
  const [regimeAnnualita, setRegimeAnnualita] = useState<Regime>("ORDINARIO");

  const [aigIds, setAigIds] = useState<string[]>([]);
  const [adOccasionaleIds, setAdOccasionaleIds] = useState<string[]>([]);
  const [mov, setMov] = useState<Movimento[]>([]);
  const [aigEsiti, setAigEsiti] = useState<
    {
      aig_id: string;
      TE: number; // Totale Entrate assegnate
      TU: number; // Totale Uscite assegnate
      TER: number; // Entrate Rilevanti (per test 6%)
      esito: "COMMERCIALE" | "NON COMMERCIALE";
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
      // ✅ leggo anche il regime salvato
      .select("ricavi_annualita_precedente, regime")
      .eq("id", annualitaId)
      .single();

    if (error) return setError(error.message);

    const row = data as AnnualitaRow;

    setRicaviPrec(num(row.ricavi_annualita_precedente));
    if (row.regime === "FORFETARIO" || row.regime === "ORDINARIO") {
      setRegimeAnnualita(row.regime);
    } else {
      // fallback sicuro
      setRegimeAnnualita("ORDINARIO");
    }
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
  // NATURA ENTE (solo informativa)
  // =========================
  // ✅ A/C su TE come da tua regola recente
  const A = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "COMMERCIALE")
        .reduce((s, x) => s + x.TE, 0),
    [aigEsiti],
  );

  const C = useMemo(
    () =>
      aigEsiti
        .filter((x) => x.esito === "NON COMMERCIALE")
        .reduce((s, x) => s + x.TE, 0),
    [aigEsiti],
  );

  const B = useMemo(() => {
    return mov
      .filter(
        (m) =>
          m.tipologia === "ENTRATA" &&
          m.macro === "ATTIVITA_DIVERSE" &&
          m.allocated_to_type === "ATTIVITA_DIVERSE",
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

  const enteNatura = A + B > C + D ? "COMMERCIALE" : "NON COMMERCIALE";

  // =========================
  // REGIME (fonte: Annualità)
  // =========================
  const regime: Regime = regimeAnnualita;

  // =========================
  // IRES
  // =========================
  const AD_tutte = useMemo(
    () =>
      mov
        .filter(
          (m) => m.tipologia === "ENTRATA" && m.macro === "ATTIVITA_DIVERSE",
        )
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  // come prima: base forfetaria usa AIG commerciali + AD (tutte)
  const AIG_comm = A;

  const coeffForfetario = useMemo(() => {
    if (regime !== "FORFETARIO") return null;
    if (tipoEnte === "APS") return 0.0072;
    if (tipoEnte === "ODV") return 0.0024;
    return 0; // caso anomalo
  }, [regime, tipoEnte]);

  const IresForfetario = useMemo(() => {
    if (regime !== "FORFETARIO") return 0;
    const coeff = coeffForfetario ?? 0;
    return (AIG_comm + AD_tutte) * coeff;
  }, [regime, coeffForfetario, AIG_comm, AD_tutte]);

  const Entrate = useMemo(
    () =>
      mov
        .filter((m) => m.tipologia === "ENTRATA")
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const Costi = useMemo(
    () =>
      mov
        .filter((m) => m.tipologia === "USCITA")
        .reduce((s, m) => s + num(m.importo), 0),
    [mov],
  );

  const Utile = Entrate - Costi;
  const IresOrdinario = Math.max(0, Utile) * 0.24;

  // =========================
  // UI
  // =========================
  return (
    <Layout>
      <div className="pageTopbar" style={{ marginBottom: 14, paddingTop: 15 }}>
        <h2 className="pageTitle">IRES</h2>

        {/* ✅ badge natura ente (informativo) */}
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

      {/* ✅ REGIME: solo quello scelto in Annualità */}
      <Card title="Regime applicabile">
        <WrapRow
          label="Regime (da Annualità)"
          value={<strong>{regime}</strong>}
        />

        {/* opzionale: mostro ricavi prec solo come “scelta/valore annualità”, NON editabile */}
        <WrapRow
          label="Ricavi annualità precedente (valore inserito in Annualità)"
          value={<Euro v={ricaviPrec} />}
        />

        <div
          className="muted"
          style={{ marginTop: 10, fontSize: 12, lineHeight: 1.4 }}
        >
          Nota: per modificare il regime, aggiorna il valore dalla pagina{" "}
          <b>Annualità</b>.
        </div>

        {/* warning se forfetario ma tipoEnte non APS/ODV */}
        {regime === "FORFETARIO" &&
          coeffForfetario !== null &&
          coeffForfetario === 0 && (
            <div style={{ marginTop: 10 }}>
              <Badge tone="amber">Attenzione</Badge>
              <div className="muted" style={{ marginTop: 6, lineHeight: 1.4 }}>
                Il regime forfetario è stato selezionato, ma il tipo ente non è
                APS/ODV: coefficiente non applicabile.
              </div>
            </div>
          )}
      </Card>

      <Card title={`Calcolo IRES – ${regime}`}>
        {regime === "FORFETARIO" ? (
          <>
            <WrapRow
              label="Base imponibile (Entrate AIG commerciali + Entrate Attività Diverse)"
              value={<Euro v={AIG_comm + AD_tutte} />}
            />
            <WrapRow
              label="Aliquota (coefficiente forfetario)"
              value={
                tipoEnte === "APS"
                  ? "0,72%"
                  : tipoEnte === "ODV"
                    ? "0,24%"
                    : "—"
              }
            />
            <WrapRow label="IRES" value={<Euro v={IresForfetario} />} />
          </>
        ) : (
          <>
            <WrapRow label="Entrate complessive" value={<Euro v={Entrate} />} />
            <WrapRow label="Costi complessivi" value={<Euro v={Costi} />} />
            <WrapRow label="Utile" value={<Euro v={Utile} />} />
            <WrapRow label="IRES (24%)" value={<Euro v={IresOrdinario} />} />
          </>
        )}

        <div className="muted" style={{ marginTop: 12, lineHeight: 1.4 }}>
          {regime === "FORFETARIO" ? (
            <>
              Regola (forfetario): base imponibile = entrate AIG commerciali +
              entrate Attività Diverse. IRES = base × coefficiente (APS 0,72%,
              ODV 0,24%).
            </>
          ) : (
            <>
              Regola (ordinario): IRES = <b>24%</b> dell’utile imponibile, dove
              utile = entrate complessive − costi complessivi. Se l’utile è
              negativo, IRES = 0.
            </>
          )}
        </div>
      </Card>
    </Layout>
  );
}
