import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAigById,  updateAig } from "../lib/db";

type Natura = "APS" | "ODV";

const ENTRATE_KEYS = [
  {
    k: "entrate_associati_mutuali",
    label: "1) Entrate dagli associati per attività mutuali",
  },
  {
    k: "prestazioni_soci_fondatori",
    label: "2) Prestazioni e cessioni ad associati e fondatori",
  },
  { k: "contributi_privati", label: "6) Contributi da soggetti privati" },
  { k: "prestazioni_terzi", label: "7) Prestazioni e cessioni a terzi" },
  { k: "contributi_pubblici", label: "8) Contributi da enti pubblici" },
  {
    k: "contratti_pubblici",
    label: "9) Entrate da contratti con enti pubblici",
  },
  { k: "altri_ricavi", label: "10) Altri ricavi/rendite/proventi" },
  { k: "rimanenze_finali", label: "11) Rimanenze finali" },
] as const;

const COSTI_DIRETTI_KEYS = [
  {
    k: "materie_prime",
    label: "1) Materie prime, sussidiarie, di consumo e merci",
  },
  { k: "servizi", label: "2) Servizi" },
  { k: "godimento_beni_terzi", label: "3) Godimento beni di terzi" },
  { k: "personale", label: "4) Personale" },
  { k: "ammortamenti", label: "5) Ammortamenti" },
  { k: "accantonamenti", label: "6) Accantonamenti per rischi e oneri" },
  { k: "oneri_diversi", label: "7) Oneri/Uscite diverse di gestione" },
  { k: "rimanenze_iniziali", label: "8) Rimanenze iniziali" },
] as const;

const COSTI_FIN_KEYS = [
  { k: "rapporti_bancari", label: "1) Costi su rapporti bancari" },
  { k: "prestiti", label: "2) Costi su prestiti" },
] as const;

const COSTI_SUPPORTO_KEYS = [
  {
    k: "materie_prime",
    label: "1) Materie prime, sussidiarie, di consumo e merci",
  },
  { k: "servizi", label: "2) Servizi" },
  { k: "godimento_beni_terzi", label: "3) Godimento beni di terzi" },
  { k: "personale", label: "4) Personale" },
  { k: "ammortamenti", label: "5) Ammortamenti" },
  { k: "accantonamenti", label: "6) Accantonamenti per rischi e oneri" },
  { k: "altri_oneri", label: "7) Altri oneri" },
] as const;

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcImputato(costoCompl: any, perc: any) {
  return num(costoCompl) * (num(perc) / 100);
}

export default function AigEditor() {
  const nav = useNavigate();
  const { annualitaId, aigId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [natura, setNatura] = useState<Natura>("APS");

  const [nome, setNome] = useState("");
  const [descr, setDescr] = useState("");

  const [entrate, setEntrate] = useState<any>({});
  const [costiDiretti, setCostiDiretti] = useState<any>({});
  const [costiFin, setCostiFin] = useState<any>({});
  const [costiSupporto, setCostiSupporto] = useState<any>({});

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Caricamento dati
  useEffect(() => {
    const run = async () => {
      if (!aigId) return;
      setLoading(true);
      setErr(null);
      try {
        const [p, a] = await Promise.all([getEnteProfile(), getAigById(aigId)]);
        setNatura(p.natura);
        setNome(a.nome ?? "");
        setDescr(a.descrizione ?? "");
        setEntrate(a.entrate ?? {});
        setCostiDiretti(a.costi_diretti ?? {});
        setCostiFin(a.costi_fin ?? {});
        setCostiSupporto(a.costi_supporto ?? {});
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [aigId]);

  // Totali Entrate
  const totaleEntrate = useMemo(() => {
    return ENTRATE_KEYS.reduce((s, x) => s + num(entrate[x.k]), 0);
  }, [entrate]);

  // Totale Entrate "per test" (se APS esclude prestazioni soci/fondatori)
  const totaleEntrateTest = useMemo(() => {
    return ENTRATE_KEYS.reduce((s, x) => {
      if (natura === "APS" && x.k === "prestazioni_soci_fondatori") return s;
      return s + num(entrate[x.k]);
    }, 0);
  }, [entrate, natura]);

  // Totale costi diretti
  const totaleCostiDiretti = useMemo(() => {
    return COSTI_DIRETTI_KEYS.reduce((s, x) => s + num(costiDiretti[x.k]), 0);
  }, [costiDiretti]);

  // Totale costi finanziari imputati
  const totaleCostiFinImputati = useMemo(() => {
    return COSTI_FIN_KEYS.reduce((s, x) => {
      const row = costiFin?.[x.k] ?? {};
      return s + calcImputato(row.costo_complessivo, row.perc);
    }, 0);
  }, [costiFin]);

  // Totale costi supporto imputati
  const totaleCostiSupportoImputati = useMemo(() => {
    return COSTI_SUPPORTO_KEYS.reduce((s, x) => {
      const row = costiSupporto?.[x.k] ?? {};
      return s + calcImputato(row.costo_complessivo, row.perc);
    }, 0);
  }, [costiSupporto]);

  // Totale uscite
  const totaleUscite = useMemo(() => {
    return (
      totaleCostiDiretti + totaleCostiFinImputati + totaleCostiSupportoImputati
    );
  }, [totaleCostiDiretti, totaleCostiFinImputati, totaleCostiSupportoImputati]);

  // Soglia (uscite + 6%)
  const soglia = useMemo(() => totaleUscite * 1.06, [totaleUscite]);

  // Esito
  const esito = useMemo(() => {
    return totaleEntrateTest > soglia ? "COMMERCIALE" : "NON COMMERCIALE";
  }, [totaleEntrateTest, soglia]);

  // Autosalvataggio (debounce)
  useEffect(() => {
    if (!aigId) return;
    if (loading) return;

    setSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        await updateAig(aigId, {
          nome,
          descrizione: descr,
          entrate,
          costi_diretti: costiDiretti,
          costi_fin: costiFin,
          costi_supporto: costiSupporto,
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 900);
      } catch {
        setSaveStatus("error");
      }
    }, 700);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, descr, entrate, costiDiretti, costiFin, costiSupporto]);

  const badgeClass =
    esito === "COMMERCIALE" ? "reportResult bad" : "reportResult ok";

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button
          className="iconBtn"
          onClick={() => nav(`/anno/${annualitaId}`)}
          aria-label="Indietro"
        >
          ←
        </button>
        <div className="mHeaderText">
          <div className="mTitle">Editor AIG</div>
          <div className="mSubtitle">
            {saveStatus === "saving" && "Salvataggio…"}
            {saveStatus === "saved" && "Salvato ✓"}
            {saveStatus === "error" && "Errore salvataggio"}
            {saveStatus === "idle" && `Natura ente: ${natura}`}
          </div>
        </div>
        <div className="mHeaderRight" />
      </header>

      <main className="mContent">
        {err && <div className="error">{err}</div>}
        {loading ? (
          <p className="muted">Caricamento…</p>
        ) : (
          <>
            <div className="cardBlock" style={{ marginBottom: 12 }}>
              <div className="field">
                <label>Nome AIG</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="field">
                <label>Descrizione (obbligatoria)</label>
                <input
                  value={descr}
                  onChange={(e) => setDescr(e.target.value)}
                />
              </div>
            </div>

            <div className="reportCard">
              <div className="reportTitle">TOTALI & TEST (live)</div>
              <div className="reportRow">
                <span>Totale Entrate (tutte)</span>
                <b>{totaleEntrate.toFixed(2)}€</b>
              </div>
              <div className="reportRow">
                <span>Totale Entrate “per test”</span>
                <b>{totaleEntrateTest.toFixed(2)}€</b>
              </div>
              <div className="reportRow">
                <span>Totale Uscite AIG</span>
                <b>{totaleUscite.toFixed(2)}€</b>
              </div>
              <div className="reportRow">
                <span>Soglia (uscite + 6%)</span>
                <b>{soglia.toFixed(2)}€</b>
              </div>
              <div className={badgeClass}>ESITO: {esito}</div>
            </div>

            {/* ENTRATE */}
            <details className="acc">
              <summary className="accSum">
                ENTRATE DA AIG{" "}
                <span className="accTot">{totaleEntrate.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                {ENTRATE_KEYS.map((x) => (
                  <div key={x.k} className="rowInput">
                    <div className="rowLabel">
                      <div>{x.label}</div>
                      {natura === "APS" &&
                        x.k === "prestazioni_soci_fondatori" && (
                          <div className="hint">Esclusa dal test APS</div>
                        )}
                    </div>
                    <input
                      type="number"
                      value={num(entrate[x.k])}
                      onChange={(e) =>
                        setEntrate((p: any) => ({
                          ...p,
                          [x.k]: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                ))}
                <div className="accFooter">
                  <div className="muted">Totale entrate “per test”</div>
                  <b>{totaleEntrateTest.toFixed(2)}€</b>
                </div>
              </div>
            </details>

            {/* COSTI DIRETTI */}
            <details className="acc">
              <summary className="accSum">
                COSTI DIRETTI{" "}
                <span className="accTot">{totaleCostiDiretti.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                {COSTI_DIRETTI_KEYS.map((x) => (
                  <div key={x.k} className="rowInput">
                    <div className="rowLabel">{x.label}</div>
                    <input
                      type="number"
                      value={num(costiDiretti[x.k])}
                      onChange={(e) =>
                        setCostiDiretti((p: any) => ({
                          ...p,
                          [x.k]: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </details>

            {/* COSTI FINANZIARI */}
            <details className="acc">
              <summary className="accSum">
                COSTI FINANZIARI/PATRIMONIALI IMPUTABILI{" "}
                <span className="accTot">
                  {totaleCostiFinImputati.toFixed(2)}€
                </span>
              </summary>
              <div className="accBody">
                {COSTI_FIN_KEYS.map((x) => {
                  const row = costiFin?.[x.k] ?? {
                    costo_complessivo: 0,
                    perc: 0,
                  };
                  const imputato = calcImputato(
                    row.costo_complessivo,
                    row.perc,
                  );
                  return (
                    <div key={x.k} className="blockInput">
                      <div className="blockTitle">{x.label}</div>
                      <div className="miniGrid">
                        <div>
                          <div className="miniLabel">Costo complessivo (€)</div>
                          <input
                            type="number"
                            value={num(row.costo_complessivo)}
                            onChange={(e) =>
                              setCostiFin((p: any) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  costo_complessivo: Number(
                                    e.target.value || 0,
                                  ),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <div className="miniLabel">% imputazione</div>
                          <select
                            value={num(row.perc)}
                            onChange={(e) =>
                              setCostiFin((p: any) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  perc: Number(e.target.value || 0),
                                },
                              }))
                            }
                          >
                            {[0, 10, 20, 25, 30, 40, 50, 66, 100].map((v) => (
                              <option key={v} value={v}>
                                {v}%
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="accFooter">
                        <div className="muted">Importo imputato</div>
                        <b>{imputato.toFixed(2)}€</b>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>

            {/* COSTI SUPPORTO */}
            <details className="acc">
              <summary className="accSum">
                COSTI DI SUPPORTO GENERALE IMPUTABILI{" "}
                <span className="accTot">
                  {totaleCostiSupportoImputati.toFixed(2)}€
                </span>
              </summary>
              <div className="accBody">
                {COSTI_SUPPORTO_KEYS.map((x) => {
                  const row = costiSupporto?.[x.k] ?? {
                    costo_complessivo: 0,
                    perc: 0,
                  };
                  const imputato = calcImputato(
                    row.costo_complessivo,
                    row.perc,
                  );
                  return (
                    <div key={x.k} className="blockInput">
                      <div className="blockTitle">{x.label}</div>
                      <div className="miniGrid">
                        <div>
                          <div className="miniLabel">Costo complessivo (€)</div>
                          <input
                            type="number"
                            value={num(row.costo_complessivo)}
                            onChange={(e) =>
                              setCostiSupporto((p: any) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  costo_complessivo: Number(
                                    e.target.value || 0,
                                  ),
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <div className="miniLabel">% imputazione</div>
                          <select
                            value={num(row.perc)}
                            onChange={(e) =>
                              setCostiSupporto((p: any) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  perc: Number(e.target.value || 0),
                                },
                              }))
                            }
                          >
                            {[0, 10, 20, 25, 30, 40, 50, 66, 100].map((v) => (
                              <option key={v} value={v}>
                                {v}%
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="accFooter">
                        <div className="muted">Importo imputato</div>
                        <b>{imputato.toFixed(2)}€</b>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </>
        )}
      </main>
    </div>
  );
}

