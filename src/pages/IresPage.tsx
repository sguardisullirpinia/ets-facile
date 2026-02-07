import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getEnteProfile,
  getAnnualita,
  listAig,
  listArt6,
  listRaccolte,
  getIresByAnnualitaId,
  upsertIresByAnnualitaId,
} from "../lib/db";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function IresPage() {
  const nav = useNavigate();
  const { annualitaId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [ente, setEnte] = useState<{ natura: "APS" | "ODV" } | null>(null);
  const [extra, setExtra] = useState<any>({});
  const [ricaviPrec, setRicaviPrec] = useState(0);

  const [aigs, setAigs] = useState<any[]>([]);
  const [art6, setArt6] = useState<any[]>([]);
  const [rf, setRf] = useState<any[]>([]);

  // LOAD
  useEffect(() => {
    const load = async () => {
      if (!annualitaId) return;
      setLoading(true);
      setErr(null);

      try {
        const [p, a, aa, bb, cc, ires] = await Promise.all([
          getEnteProfile(),
          getAnnualita(annualitaId),
          listAig(annualitaId),
          listArt6(annualitaId),
          listRaccolte(annualitaId),
          getIresByAnnualitaId(annualitaId),
        ]);

        setEnte(p);
        setExtra(a.extra ?? {});
        setAigs(aa);
        setArt6(bb);
        setRf(cc);

        if (ires?.ricavi_precedente) {
          setRicaviPrec(num(ires.ricavi_precedente));
        }
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento IRES");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [annualitaId]);

  // TOTALI
  const totAigComm = useMemo(
    () =>
      aigs.reduce((s, a) => {
        const entr =
          num(a.entrate?.contributi_privati) +
          num(a.entrate?.prestazioni_terzi) +
          num(a.entrate?.contributi_pubblici) +
          num(a.entrate?.contratti_pubblici) +
          num(a.entrate?.altri_ricavi);
        return entr > 0 ? s + entr : s;
      }, 0),
    [aigs],
  );

  const totAigNonComm = useMemo(
    () =>
      aigs.reduce(
        (s, a) =>
          s +
          num(a.entrate?.entrate_associati_mutuali) +
          num(a.entrate?.prestazioni_soci_fondatori),
        0,
      ),
    [aigs],
  );

  const totArt6 = useMemo(
    () => art6.reduce((s, x) => s + Object.values(x.entrate ?? {}).reduce((a: number, v: any) => a + num(v), 0), 0),
    [art6],
  );

  const totRf = useMemo(
    () => rf.reduce((s, x) => s + Object.values(x.entrate ?? {}).reduce((a: number, v: any) => a + num(v), 0), 0),
    [rf],
  );

  const totExtra = useMemo(
    () =>
      num(extra.quote_assoc) +
      num(extra.erogazioni) +
      num(extra.cinque_per_mille) +
      num(extra.convenzioni_art56) +
      num(extra.altri_non_commerciali),
    [extra],
  );

  // ESITO ENTE
  const enteCommerciale = totAigComm + totArt6 > totAigNonComm + totExtra;

  // REGIME
  const regimeForfettario =
    !enteCommerciale && ricaviPrec <= 85000;

  // CALCOLO IRES
  const imponibile = useMemo(() => {
    if (regimeForfettario) {
      const base = totAigComm + totArt6;
      return ente?.natura === "APS" ? base * 0.0072 : base * 0.0024;
    }

    // ORDINARIO
    return (
      totAigComm +
      totAigNonComm +
      totArt6 +
      totRf +
      totExtra
    );
  }, [regimeForfettario, totAigComm, totArt6, totAigNonComm, totRf, totExtra, ente]);

  const ires = imponibile * 0.24;

  // SAVE
  useEffect(() => {
    if (!annualitaId || loading) return;

    upsertIresByAnnualitaId(annualitaId, {
      ricavi_precedente: ricaviPrec,
      imponibile,
      aliquota: 24,
      imposta_lorda: ires,
      imposta_netta: ires,
      saldo: ires,
    });
  }, [annualitaId, loading, imponibile, ires, ricaviPrec]);

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button className="iconBtn" onClick={() => nav(`/anno/${annualitaId}`)}>
          ←
        </button>
        <div className="mHeaderText">
          <div className="mTitle">IRES</div>
          <div className="mSubtitle">
            {enteCommerciale ? "ENTE COMMERCIALE" : "ENTE NON COMMERCIALE"}
          </div>
        </div>
      </header>

      <main className="mContent">
        {err && <div className="error">{err}</div>}
        {loading ? (
          <p>Caricamento…</p>
        ) : (
          <>
            {!enteCommerciale && (
              <div className="cardBlock">
                <div className="field">
                  <label>Ricavi annualità precedente</label>
                  <input
                    type="number"
                    value={ricaviPrec}
                    onChange={(e) => setRicaviPrec(num(e.target.value))}
                  />
                </div>

                <div className={regimeForfettario ? "reportResult ok" : "reportResult bad"}>
                  {regimeForfettario
                    ? "REGIME FORFETARIO APPLICABILE"
                    : "REGIME ORDINARIO APPLICABILE"}
                </div>
              </div>
            )}

            <div className="reportCard">
              <div className="reportTitle">CALCOLO IRES</div>

              <div className="reportRow">
                <span>Imponibile</span>
                <b>{imponibile.toFixed(2)} €</b>
              </div>

              <div className="reportRow">
                <span>IRES (24%)</span>
                <b>{ires.toFixed(2)} €</b>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
