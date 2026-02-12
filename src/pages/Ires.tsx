import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, Euro, PrimaryButton } from "../components/ui";

type AigRow = { id: string };
type AttDivRow = { id: string; occasionale: boolean };
type AnnualitaRow = { id: string; ricavi_annualita_precedente: number };

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
  const [saving, setSaving] = useState(false);

  const [tipoEnte, setTipoEnte] = useState<string>("ETS");
  const [ricaviPrec, setRicaviPrec] = useState<number>(0);

  const [aigIds, setAigIds] = useState<string[]>([]);
  const [adOccasionaleIds, setAdOccasionaleIds] = useState<string[]>([]);
  const [mov, setMov] = useState<Movimento[]>([]);
  const [aigEsiti, setAigEsiti] = useState<
    {
      aig_id: string;
      TE: number;
      TU: number;
      TER: number;
      esito: "COMMERCIALE" | "NON COMMERCIALE";
    }[]
  >([]);

  // =========================
  // LOAD DATI
  // =========================
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

  const loadAnnualita = async () => {
    if (!annualitaId) return;

    const { data, error } = await supabase
      .from("annualita")
      .select("ricavi_annualita_precedente")
      .eq("id", annualitaId)
      .single();

    if (error) return setError(error.message);
    setRicaviPrec(num((data as AnnualitaRow).ricavi_annualita_precedente));
  };

  const loadIds = async () => {
    if (!annualitaId) return;

    const { data: aigs } = await supabase
      .from("aig")
      .select("id")
      .eq("annualita_id", annualitaId);

    const { data: ads } = await supabase
      .from("attivita_diverse")
      .select("id, occasionale")
      .eq("annualita_id", annualitaId);

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
  // ESITI AIG
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
  // NATURA ENTE
  // =========================
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

  // ⚠️ Mantengo la tua logica identica: forfetario solo se NON ETS + ente NC + ricaviPrec <= 85k
  const regime =
    tipoEnte !== "ETS" &&
    enteNatura === "NON COMMERCIALE" &&
    ricaviPrec <= 85000
      ? "FORFETARIO"
      : "ORDINARIO";

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

  const AIG_comm = A;

  const IresForfetario = useMemo(() => {
    if (regime !== "FORFETARIO") return 0;
    const coeff = tipoEnte === "APS" ? 0.0072 : 0.0024;
    return (AIG_comm + AD_tutte) * coeff;
  }, [regime, tipoEnte, AIG_comm, AD_tutte]);

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
  // SAVE
  // =========================
  const saveRicaviPrec = async () => {
    if (!annualitaId) return;
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("annualita")
      .update({ ricavi_annualita_precedente: ricaviPrec })
      .eq("id", annualitaId);

    setSaving(false);
    if (error) setError(error.message);
  };

  // =========================
  // UI
  // =========================
  return (
    <Layout>
      <div className="pageTopbar" style={{ marginBottom: 14 }}>
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

      <Card title="Regime applicabile">
        {enteNatura === "NON COMMERCIALE" &&
          (tipoEnte === "APS" || tipoEnte === "ODV") && (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontWeight: 900,
                  marginBottom: 6,
                  whiteSpace: "normal",
                  lineHeight: 1.25,
                }}
              >
                Ricavi annualità precedente
              </div>

              <input
                value={ricaviPrec}
                onChange={(e) => setRicaviPrec(num(e.target.value))}
                className="input"
                inputMode="decimal"
                style={{ width: "100%" }} // ✅ integrale nella card
                placeholder="Es. 85000"
              />

              <div style={{ marginTop: 10 }}>
                <PrimaryButton onClick={saveRicaviPrec} disabled={saving}>
                  {saving ? "Salvo…" : "Salva"}
                </PrimaryButton>
              </div>
            </div>
          )}

        <WrapRow label="Regime" value={<strong>{regime}</strong>} />
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
              value={tipoEnte === "APS" ? "0,72%" : "0,24%"}
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

        {/* ✅ spazio regola */}
        <div className="muted" style={{ marginTop: 12, lineHeight: 1.4 }}>
          {regime === "FORFETARIO" ? (
            <>
              Regola (forfetario): se l’ente è <b>NON COMMERCIALE</b> e i ricavi
              dell’annualità precedente sono ≤ <b>85.000 €</b>, si applica il
              regime forfetario. Base imponibile = entrate AIG commerciali +
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
