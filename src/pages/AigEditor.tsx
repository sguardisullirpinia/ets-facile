import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAigById, updateAig, getEnteProfile } from "../lib/db";
import * as XLSX from "xlsx";

type Natura = "APS" | "ODV";

const ENTRATE_KEYS = [
  { k: "entrate_associati_mutuali", label: "1) Entrate dagli associati per attività mutuali" },
  { k: "prestazioni_soci_fondatori", label: "2) Prestazioni e cessioni a iscritti, associati e fondatori" },
  { k: "contributi_privati", label: "6) Contributi da soggetti privati" },
  { k: "prestazioni_terzi", label: "7) Prestazioni e cessioni a terzi" },
  { k: "contributi_pubblici", label: "8) Contributi da enti pubblici" },
  { k: "contratti_pubblici", label: "9) Entrate da contratti con enti pubblici" },
  { k: "altri_ricavi", label: "10) Altri ricavi/rendite/proventi" },
  { k: "rimanenze_finali", label: "11) Rimanenze finali" },
] as const;

const COSTI_DIRETTI_KEYS = [
  { k: "materie_prime", label: "1) Materie prime, sussidiarie, di consumo e merci" },
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
  { k: "materie_prime", label: "1) Materie prime, sussidiarie, di consumo e merci" },
  { k: "servizi", label: "2) Servizi" },
  { k: "godimento_beni_terzi", label: "3) Godimento beni di terzi" },
  { k: "personale", label: "4) Personale" },
  { k: "ammortamenti", label: "5) Ammortamenti" },
  { k: "accantonamenti", label: "6) Accantonamenti per rischi e oneri" },
  { k: "altri_oneri", label: "7) Altri oneri" },
] as const;

/** HELP (entrate) */
const ENTRATE_HELP: Record<(typeof ENTRATE_KEYS)[number]["k"], string> = {
  entrate_associati_mutuali:
    "Corrispettivi versati dai soci per attività svolte verso gli associati a condizioni più favorevoli (tipiche della mutualità).",
  prestazioni_soci_fondatori:
    "Corrispettivi versati da iscritti, soci o fondatori per prestazioni/cessioni (anche a condizioni di mercato) N.B. Gli iscritti sono coloro che non beneficiano dei diritti di partecipazione e voto nelle assemblee dell’associazione, ma che hanno un forte e duraturo legame con l’associazione.",
  contributi_privati:
    "Contributi/donazioni da privati senza una controprestazione specifica, spesso legati a progetti e rendicontazione.",
  prestazioni_terzi: "Vendite o servizi a terzi (non soci) con corrispettivo.",
  contributi_pubblici:
    "Contributi/finanziamenti pubblici a sostegno delle AIG, senza corrispettivo specifico ma soggetti a rendicontazione.",
  contratti_pubblici:
    "Corrispettivi da enti pubblici per servizi/affidamenti/convenzioni: l’ente eroga un servizio e la PA corrisponde un prezzo.",
  altri_ricavi: "Altri proventi collegati all’AIG (rendite, rimborsi, proventi vari).",
  rimanenze_finali: "Valore delle rimanenze a fine periodo (merci/materiali). Se non gestisci rimanenze, lascia 0.",
};

/** HELP (costi diretti) */
const COSTI_DIRETTI_HELP: Record<(typeof COSTI_DIRETTI_KEYS)[number]["k"], string> = {
  materie_prime:
    "Acquisti di beni consumati nell’AIG specifica (materiali, merci, cancelleria, piccoli strumenti).",
  servizi:
    "Spese per servizi esterni legati direttamente alla specifica AIG (utenze, consulenze, manutenzioni, assicurazioni, comunicazione).",
  godimento_beni_terzi:
    "Canoni e affitti per beni non di proprietà relativi alla specifica AIG (locazione, leasing, noleggio attrezzature).",
  personale:
    "Compensi e oneri per lavoratori/collaboratori impiegati nell’AIG (stipendi, contributi, rimborsi).",
  ammortamenti: "Quota annua di costo per beni durevoli usati nell’AIG (attrezzature, arredi, PC, ecc.).",
  accantonamenti: "Quote accantonate per coprire rischi o spese future legate all’attività (fondi rischi/oneri).",
  oneri_diversi: "Spese varie non classificabili altrove (imposte minori, bolli, spese minute, ecc.).",
  rimanenze_iniziali: "Valore delle rimanenze a inizio periodo (merci/materiali già presenti a inizio anno).",
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** clamp semplice per % 0..100 */
function clampPerc(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function calcImputato(costoCompl: any, perc: any) {
  return num(costoCompl) * (clampPerc(perc) / 100);
}

function isEsclusaTestAPS(k: (typeof ENTRATE_KEYS)[number]["k"]) {
  return k === "entrate_associati_mutuali" || k === "prestazioni_soci_fondatori";
}

type RigaImputazione = { costo_complessivo: number; perc: number };

export default function AigEditor() {
  const nav = useNavigate();
  const { annualitaId, aigId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [natura, setNatura] = useState<Natura>("APS");

  const [nome, setNome] = useState("");
  const [descr, setDescr] = useState("");

  const [entrate, setEntrate] = useState<any>({});

  // ✅ Ora anche i costi diretti sono "imputabili" (costo_complessivo + %)
  const [costiDiretti, setCostiDiretti] = useState<Record<string, RigaImputazione>>({});
  const [costiFin, setCostiFin] = useState<Record<string, RigaImputazione>>({});
  const [costiSupporto, setCostiSupporto] = useState<Record<string, RigaImputazione>>({});

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Caricamento dati
  useEffect(() => {
    const run = async () => {
      if (!aigId) return;
      setLoading(true);
      setErr(null);

      try {
        const [p, a] = await Promise.all([getEnteProfile(), getAigById(aigId)]);

        setNatura(p?.natura ?? "APS");
        setNome(a?.nome ?? "");
        setDescr(a?.descrizione ?? "");
        setEntrate(a?.entrate ?? {});

        // ✅ retro-compat: se prima erano numeri, li trasformo in {costo_complessivo, perc}
        const cd = a?.costi_diretti ?? {};
        const mappedDiretti: Record<string, RigaImputazione> = {};
        COSTI_DIRETTI_KEYS.forEach((x) => {
          const v = cd?.[x.k];
          if (typeof v === "number") {
            mappedDiretti[x.k] = { costo_complessivo: v, perc: 100 };
          } else {
            mappedDiretti[x.k] = {
              costo_complessivo: num(v?.costo_complessivo),
              perc: clampPerc(v?.perc),
            };
          }
        });
        setCostiDiretti(mappedDiretti);

        const cf = a?.costi_fin ?? {};
        const mappedFin: Record<string, RigaImputazione> = {};
        COSTI_FIN_KEYS.forEach((x) => {
          const v = cf?.[x.k];
          mappedFin[x.k] = {
            costo_complessivo: num(v?.costo_complessivo),
            perc: clampPerc(v?.perc),
          };
        });
        setCostiFin(mappedFin);

        const cs = a?.costi_supporto ?? {};
        const mappedSup: Record<string, RigaImputazione> = {};
        COSTI_SUPPORTO_KEYS.forEach((x) => {
          const v = cs?.[x.k];
          mappedSup[x.k] = {
            costo_complessivo: num(v?.costo_complessivo),
            perc: clampPerc(v?.perc),
          };
        });
        setCostiSupporto(mappedSup);
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [aigId]);

  // Totali Entrate (tutte)
  const totaleEntrate = useMemo(() => {
    return ENTRATE_KEYS.reduce((s, x) => s + num(entrate[x.k]), 0);
  }, [entrate]);

  // Totale Entrate "per test" (APS: escluse voci mutualistiche verso associati)
  const totaleEntrateTest = useMemo(() => {
    return ENTRATE_KEYS.reduce((s, x) => {
      if (natura === "APS" && isEsclusaTestAPS(x.k)) return s;
      return s + num(entrate[x.k]);
    }, 0);
  }, [entrate, natura]);

  // ✅ Totale costi diretti imputati (somma degli importi imputati)
  const totaleCostiDirettiImputati = useMemo(() => {
    return COSTI_DIRETTI_KEYS.reduce((s, x) => {
      const row = costiDiretti?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
      return s + calcImputato(row.costo_complessivo, row.perc);
    }, 0);
  }, [costiDiretti]);

  // Totale costi finanziari imputati
  const totaleCostiFinImputati = useMemo(() => {
    return COSTI_FIN_KEYS.reduce((s, x) => {
      const row = costiFin?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
      return s + calcImputato(row.costo_complessivo, row.perc);
    }, 0);
  }, [costiFin]);

  // Totale costi supporto imputati
  const totaleCostiSupportoImputati = useMemo(() => {
    return COSTI_SUPPORTO_KEYS.reduce((s, x) => {
      const row = costiSupporto?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
      return s + calcImputato(row.costo_complessivo, row.perc);
    }, 0);
  }, [costiSupporto]);

  // Totale uscite
  const totaleUscite = useMemo(() => {
    return totaleCostiDirettiImputati + totaleCostiFinImputati + totaleCostiSupportoImputati;
  }, [totaleCostiDirettiImputati, totaleCostiFinImputati, totaleCostiSupportoImputati]);

  // Soglia (uscite + 6%)
  const soglia = useMemo(() => totaleUscite * 1.06, [totaleUscite]);

  // Esito
  const esito = useMemo(() => {
    return totaleEntrateTest > soglia ? "COMMERCIALE" : "NON COMMERCIALE";
  }, [totaleEntrateTest, soglia]);

  /** Validazioni soft */
  const warnings = useMemo(() => {
    const w: string[] = [];

    if (!descr.trim()) w.push("Manca la descrizione (obbligatoria).");

    // ✅ diretti: se % > 0 e costo complessivo = 0
    COSTI_DIRETTI_KEYS.forEach((x) => {
      const row = costiDiretti?.[x.k] ?? {};
      if (num(row.perc) > 0 && num(row.costo_complessivo) === 0) {
        w.push(`Costi diretti: su “${x.label}” hai impostato una % > 0 ma il costo complessivo è 0.`);
      }
    });

    COSTI_FIN_KEYS.forEach((x) => {
      const row = costiFin?.[x.k] ?? {};
      if (num(row.perc) > 0 && num(row.costo_complessivo) === 0) {
        w.push(`Costi finanziari: su “${x.label}” hai impostato una % > 0 ma il costo complessivo è 0.`);
      }
    });

    COSTI_SUPPORTO_KEYS.forEach((x) => {
      const row = costiSupporto?.[x.k] ?? {};
      if (num(row.perc) > 0 && num(row.costo_complessivo) === 0) {
        w.push(`Costi di supporto: su “${x.label}” hai impostato una % > 0 ma il costo complessivo è 0.`);
      }
    });

    if (totaleEntrateTest > 0 && totaleUscite === 0) {
      w.push("Hai inserito entrate ma le uscite risultano 0: mancano i costi?");
    }

    return w;
  }, [descr, costiDiretti, costiFin, costiSupporto, totaleEntrateTest, totaleUscite]);

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
          costi_diretti: costiDiretti, // ✅ ora struttura imputabile
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
  }, [aigId, loading, nome, descr, entrate, costiDiretti, costiFin, costiSupporto]);

  const badgeClass = esito === "COMMERCIALE" ? "reportResult bad" : "reportResult ok";

  const handleBack = () => {
    if (saveStatus === "saving") {
      alert("Sto salvando… attendi un attimo e riprova.");
      return;
    }
    nav(`/anno/${annualitaId}`);
  };

  // ✅ EXPORT XLSX (tutti i campi - non valorizzati => 0)
  const exportXlsx = () => {
    const safeNome = (nome || "AIG").replace(/[\\/:*?"<>|]+/g, "-").trim();
    const fileName = `AIG_${safeNome}_${annualitaId ?? ""}.xlsx`;

    const rows: (string | number)[][] = [];

    // Header
    rows.push(["ETS-FACILE — Export AIG"]);
    rows.push(["Annualità ID", annualitaId ?? ""]);
    rows.push(["AIG ID", aigId ?? ""]);
    rows.push(["Natura ente", natura]);
    rows.push(["Nome AIG", nome || ""]);
    rows.push(["Descrizione", descr || ""]);
    rows.push([]);

    // Entrate
    rows.push(["ENTRATE DA AIG"]);
    rows.push(["Voce", "Importo (€)"]);
    ENTRATE_KEYS.forEach((x) => {
      rows.push([x.label, num(entrate?.[x.k])]);
    });
    rows.push(["Totale entrate (tutte)", Number(totaleEntrate.toFixed(2))]);
    rows.push(["Totale entrate (per test)", Number(totaleEntrateTest.toFixed(2))]);
    rows.push([]);

    // Costi diretti
    rows.push(["COSTI DIRETTI (IMPUTAZIONE)"]);
    rows.push(["Voce", "Costo complessivo (€)", "% imputazione", "Importo imputato (€)"]);
    COSTI_DIRETTI_KEYS.forEach((x) => {
      const row = costiDiretti?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
      const costo = num(row.costo_complessivo);
      const perc = clampPerc(row.perc);
      const imputato = calcImputato(costo, perc);
      rows.push([x.label, costo, perc, Number(imputato.toFixed(2))]);
    });
    rows.push(["Totale costi diretti imputati", Number(totaleCostiDirettiImputati.toFixed(2))]);
    rows.push([]);

    // Costi fin
    rows.push(["COSTI FINANZIARI/PATRIMONIALI (IMPUTAZIONE)"]);
    rows.push(["Voce", "Costo complessivo (€)", "% imputazione", "Importo imputato (€)"]);
    COSTI_FIN_KEYS.forEach((x) => {
      const row = costiFin?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
      const costo = num(row.costo_complessivo);
      const perc = clampPerc(row.perc);
      const imputato = calcImputato(costo, perc);
      rows.push([x.label, costo, perc, Number(imputato.toFixed(2))]);
    });
    rows.push(["Totale costi fin imputati", Number(totaleCostiFinImputati.toFixed(2))]);
    rows.push([]);

    // Costi supporto
    rows.push(["COSTI DI SUPPORTO GENERALE (IMPUTAZIONE)"]);
    rows.push(["Voce", "Costo complessivo (€)", "% imputazione", "Importo imputato (€)"]);
    COSTI_SUPPORTO_KEYS.forEach((x) => {
      const row = costiSupporto?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
      const costo = num(row.costo_complessivo);
      const perc = clampPerc(row.perc);
      const imputato = calcImputato(costo, perc);
      rows.push([x.label, costo, perc, Number(imputato.toFixed(2))]);
    });
    rows.push(["Totale costi supporto imputati", Number(totaleCostiSupportoImputati.toFixed(2))]);
    rows.push([]);

    // Totali & Test
    rows.push(["TOTALI & TEST"]);
    rows.push(["Totale entrate (tutte)", Number(totaleEntrate.toFixed(2))]);
    rows.push(["Totale entrate (per test)", Number(totaleEntrateTest.toFixed(2))]);
    rows.push(["Totale uscite AIG", Number(totaleUscite.toFixed(2))]);
    rows.push(["Soglia (uscite + 6%)", Number(soglia.toFixed(2))]);
    rows.push(["Esito", esito]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 62 }, { wch: 22 }, { wch: 16 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AIG");

    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button className="iconBtn" onClick={handleBack} aria-label="Indietro">
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
                <input value={descr} onChange={(e) => setDescr(e.target.value)} />
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="warnBox">
                <div className="warnTitle">Attenzione</div>
                <ul className="warnList">
                  {warnings.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 1) ENTRATE */}
            <details className="acc">
              <summary className="accSum">
                <span className="accLeft">
                  <span className="accChevron" aria-hidden="true">
                    ▸
                  </span>
                  <span>ENTRATE DA AIG</span>
                </span>
                <span className="accTot">{totaleEntrate.toFixed(2)}€</span>
              </summary>

              <div className="accBody">
                {ENTRATE_KEYS.map((x) => (
                  <div key={x.k} className="rowInput">
                    <div className="rowLabel">
                      <div>{x.label}</div>
                      <div className="hint">{ENTRATE_HELP[x.k]}</div>

                      {natura === "APS" && isEsclusaTestAPS(x.k) && (
                        <div className="hint">Esclusa dal test di commercialità (APS)</div>
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

            {/* 2) COSTI DIRETTI (ora imputabili) */}
            <details className="acc">
              <summary className="accSum">
                <span className="accLeft">
                  <span className="accChevron" aria-hidden="true">
                    ▸
                  </span>
                  <span>COSTI DIRETTI (IMPUTAZIONE)</span>
                </span>
                <span className="accTot">{totaleCostiDirettiImputati.toFixed(2)}€</span>
              </summary>

              <div className="accBody">
                <div className="hint" style={{ marginBottom: 10 }}>
                  Inserisci il costo complessivo e la % imputabile a questa AIG. L’app calcola l’importo imputato.
                </div>

                {COSTI_DIRETTI_KEYS.map((x) => {
                  const row = costiDiretti?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
                  const imputato = calcImputato(row.costo_complessivo, row.perc);

                  return (
                    <div key={x.k} className="blockInput">
                      <div className="blockTitle">{x.label}</div>
                      <div className="hint">{COSTI_DIRETTI_HELP[x.k]}</div>

                      <div className="miniGrid">
                        <div>
                          <div className="miniLabel">Costo complessivo (€)</div>
                          <input
                            type="number"
                            value={num(row.costo_complessivo)}
                            onChange={(e) =>
                              setCostiDiretti((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  costo_complessivo: Number(e.target.value || 0),
                                },
                              }))
                            }
                          />
                        </div>

                        <div>
                          <div className="miniLabel">% imputazione</div>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={num(row.perc)}
                            onChange={(e) =>
                              setCostiDiretti((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  perc: e.target.value === "" ? 0 : Number(e.target.value),
                                },
                              }))
                            }
                            onBlur={(e) =>
                              setCostiDiretti((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  perc: clampPerc(e.target.value),
                                },
                              }))
                            }
                          />
                          <div className="hint">Da 0 a 100 (puoi usare decimali)</div>
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

            {/* 3) COSTI FINANZIARI/PATRIMONIALI IMPUTABILI (percentuale manuale) */}
            <details className="acc">
              <summary className="accSum">
                <span className="accLeft">
                  <span className="accChevron" aria-hidden="true">
                    ▸
                  </span>
                  <span>COSTI FINANZIARI/PATRIMONIALI IMPUTABILI</span>
                </span>
                <span className="accTot">{totaleCostiFinImputati.toFixed(2)}€</span>
              </summary>

              <div className="accBody">
                <div className="hint" style={{ marginBottom: 10 }}>
                  Inserisci il costo complessivo e la % imputabile a questa AIG. L’app calcola l’importo imputato.
                </div>

                {COSTI_FIN_KEYS.map((x) => {
                  const row = costiFin?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
                  const imputato = calcImputato(row.costo_complessivo, row.perc);

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
                              setCostiFin((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  costo_complessivo: Number(e.target.value || 0),
                                },
                              }))
                            }
                          />
                        </div>

                        <div>
                          <div className="miniLabel">% imputazione</div>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={num(row.perc)}
                            onChange={(e) =>
                              setCostiFin((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  perc: e.target.value === "" ? 0 : Number(e.target.value),
                                },
                              }))
                            }
                            onBlur={(e) =>
                              setCostiFin((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  perc: clampPerc(e.target.value),
                                },
                              }))
                            }
                          />
                          <div className="hint">Da 0 a 100 (puoi usare decimali)</div>
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

            {/* 4) COSTI DI SUPPORTO GENERALE IMPUTABILI (percentuale manuale) */}
            <details className="acc">
              <summary className="accSum">
                <span className="accLeft">
                  <span className="accChevron" aria-hidden="true">
                    ▸
                  </span>
                  <span>COSTI DI SUPPORTO GENERALE IMPUTABILI</span>
                </span>
                <span className="accTot">{totaleCostiSupportoImputati.toFixed(2)}€</span>
              </summary>

              <div className="accBody">
                <div className="hint" style={{ marginBottom: 10 }}>
                  Costi generali dell’ente (supporto). Inserisci costo complessivo e % imputabile a questa AIG.
                </div>

                {COSTI_SUPPORTO_KEYS.map((x) => {
                  const row = costiSupporto?.[x.k] ?? { costo_complessivo: 0, perc: 0 };
                  const imputato = calcImputato(row.costo_complessivo, row.perc);

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
                              setCostiSupporto((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  costo_complessivo: Number(e.target.value || 0),
                                },
                              }))
                            }
                          />
                        </div>

                        <div>
                          <div className="miniLabel">% imputazione</div>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={num(row.perc)}
                            onChange={(e) =>
                              setCostiSupporto((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  perc: e.target.value === "" ? 0 : Number(e.target.value),
                                },
                              }))
                            }
                            onBlur={(e) =>
                              setCostiSupporto((p) => ({
                                ...p,
                                [x.k]: {
                                  ...row,
                                  perc: clampPerc(e.target.value),
                                },
                              }))
                            }
                          />
                          <div className="hint">Da 0 a 100 (puoi usare decimali)</div>
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

            {/* TOTALI & TEST (alla fine) */}
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

              <div className="muted" style={{ marginTop: 8 }}>
                {esito === "NON COMMERCIALE"
                  ? `✅ Entrate “per test” (${totaleEntrateTest.toFixed(2)}€) ≤ Soglia (${soglia.toFixed(2)}€)`
                  : `⚠️ Entrate “per test” (${totaleEntrateTest.toFixed(2)}€) > Soglia (${soglia.toFixed(2)}€)`}
              </div>

              {/* ✅ PULSANTE EXPORT XLSX */}
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={exportXlsx}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    fontWeight: 800,
                     border: "1px solid rgba(0,0,0,0.10)",
                      cursor: "pointer",
                      background: "#16a34a", // verde
                  }}
                >
                  ⬇️ Scarica Excel (.xlsx) con tutti i campi
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

