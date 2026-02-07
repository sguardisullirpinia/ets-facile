import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateArt6, getArt6ById } from "../lib/db";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampPerc(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function calcImputato(costoCompl: any, perc: any) {
  return num(costoCompl) * (clampPerc(perc) / 100);
}

type RigaImputazione = { costo_complessivo: number; perc: number };

const ENTRATE_LABELS = [
  "Prestazioni ad associati",
  "Contributi privati",
  "Prestazioni a terzi",
  "Contributi pubblici",
  "Contratti pubblici",
  "Sponsorizzazioni",
  "Altre entrate",
] as const;

const ENTRATE_HELP: Record<(typeof ENTRATE_LABELS)[number], string> = {
  "Prestazioni ad associati":
    "Corrispettivi pagati dagli associati per beni/servizi dell’attività diversa ex art. 6 CTS.",
  "Contributi privati":
    "Sostegni da persone o aziende senza un prezzo di vendita diretto; spesso legati a un progetto e a rendicontazione.",
  "Prestazioni a terzi":
    "Vendite o servizi a Terzi (non soci) con corrispettivo, anche occasionale.",
  "Contributi pubblici":
    "Contributi/finanziamenti da enti pubblici a supporto dell’attività.",
  "Contratti pubblici":
    "Corrispettivi da PA per un servizio affidato: l’ente svolge un’attività specifica e la PA paga un prezzo.",
  Sponsorizzazioni:
    "Somme ricevute in cambio di visibilità/ritorno promozionale (logo, banner, citazioni, eventi, social).",
  "Altre entrate":
    "Voci residuali: rimborsi, proventi vari, indennizzi, ricavi non classificabili altrove.",
};

const USCITE_LABELS = [
  "Materie prime",
  "Servizi",
  "Godimento beni di terzi",
  "Personale",
  "Uscite diverse",
] as const;

const USCITE_HELP: Record<(typeof USCITE_LABELS)[number], string> = {
  "Materie prime":
    "Acquisti di beni consumati nell’attività diversa ex art. 6 CTS (materiali, merci, cancelleria, forniture, ecc.).",
  Servizi:
    "Spese per servizi esterni necessari (utenze, consulenze, manutenzioni, trasporti, comunicazione, ecc.).",
  "Godimento beni di terzi":
    "Affitti, leasing e noleggi per beni non di proprietà legati all'attività di (locali, attrezzature, mezzi, ecc.).",
  Personale:
    "Compensi e oneri per lavoratori/collaboratori impiegati nell’attività diversa (stipendi, contributi, rimborsi).",
  "Uscite diverse":
    "Spese varie non ricomprese nelle altre voci (bolli, spese minute, commissioni, costi residuali).",
};

export default function Art6Editor() {
  const nav = useNavigate();
  const { annualitaId, art6Id } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descr, setDescr] = useState("");

  const [entrate, setEntrate] = useState<any>({});

  // ✅ flag occasionale
  const [occasionale, setOccasionale] = useState<boolean>(false);

  // ✅ USCITE imputabili
  const [uscite, setUscite] = useState<Record<number, RigaImputazione>>({});

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // LOAD
  useEffect(() => {
    const run = async () => {
      if (!art6Id) return;
      setLoading(true);
      setErr(null);

      try {
        const a = await getArt6ById(art6Id);

        setNome(a?.nome ?? "");
        setDescr(a?.descrizione ?? "");
        setEntrate(a?.entrate ?? {});

        // ✅ carica flag (default false)
        setOccasionale(Boolean(a?.occasionale));

        // retro-compat: se prima erano numeri, li trasformo in {costo_complessivo, perc: 100}
        const u = a?.uscite ?? {};
        const mapped: Record<number, RigaImputazione> = {};
        USCITE_LABELS.forEach((_, i) => {
          const v = u?.[i];
          if (typeof v === "number") {
            mapped[i] = { costo_complessivo: num(v), perc: 100 };
          } else {
            mapped[i] = {
              costo_complessivo: num(v?.costo_complessivo),
              perc: clampPerc(v?.perc),
            };
          }
        });
        setUscite(mapped);
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [art6Id]);

  // TOTALI
  const totEntrate = useMemo(() => {
    return Object.values(entrate ?? {}).reduce(
      (s: number, v: any) => s + num(v),
      0
    );
  }, [entrate]);

  const totUsciteImputate = useMemo(() => {
    return USCITE_LABELS.reduce((s, _, i) => {
      const row = uscite?.[i] ?? { costo_complessivo: 0, perc: 0 };
      return s + calcImputato(row.costo_complessivo, row.perc);
    }, 0);
  }, [uscite]);

  // AUTOSAVE (include anche "occasionale")
  useEffect(() => {
    if (!art6Id || loading) return;

    setSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        await updateArt6(art6Id, {
          nome,
          descrizione: descr,
          entrate,
          uscite,
          occasionale, // ✅ salva la spunta
        });

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 800);
      } catch {
        setSaveStatus("error");
      }
    }, 700);

    return () => clearTimeout(t);
  }, [art6Id, loading, nome, descr, entrate, uscite, occasionale]);

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
          <div className="mTitle">Attività diversa</div>
          <div className="mSubtitle">
            {saveStatus === "saving" && "Salvataggio…"}
            {saveStatus === "saved" && "Salvato ✓"}
            {saveStatus === "error" && "Errore"}
          </div>
        </div>
        <div className="mHeaderRight" />
      </header>

      <main className="mContent">
        {err && <div className="error">{err}</div>}

        {loading ? (
          <p>Caricamento…</p>
        ) : (
          <>
            <div className="cardBlock">
              {/* ✅ CHECKBOX PRIMA DI TUTTO */}
              <div className="field">
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={occasionale}
                    onChange={(e) => setOccasionale(e.target.checked)}
                  />
                  Attività diversa svolta occasionalmente
                </label>
                <div className="hint">
                  Se spuntata, i proventi di questa attività <b>non</b> concorrono
                  alla voce <b>C)</b> nel riepilogo (test dell’ente).
                </div>
              </div>

              <div className="field">
                <label>Nome attività</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="field">
                <label>Descrizione</label>
                <input value={descr} onChange={(e) => setDescr(e.target.value)} />
              </div>
            </div>

            {/* ENTRATE */}
            <details className="acc">
              <summary className="accSum">
                <div className="accLeft">
                  <span className="accChevron">▸</span>
                  <span>ENTRATE</span>
                </div>
                <span className="accTot">{totEntrate.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                {ENTRATE_LABELS.map((label, i) => (
                  <div key={label} className="rowInput">
                    <div className="rowLabel">
                      <div>{label}</div>
                      <div className="hint">{ENTRATE_HELP[label]}</div>
                    </div>

                    <input
                      type="number"
                      value={num(entrate[i])}
                      onChange={(e) =>
                        setEntrate((p: any) => ({
                          ...p,
                          [i]: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </details>

            {/* USCITE (IMPUTAZIONE) */}
            <details className="acc">
              <summary className="accSum">
                <div className="accLeft">
                  <span className="accChevron">▸</span>
                  <span>USCITE (IMPUTAZIONE)</span>
                </div>
                <span className="accTot">{totUsciteImputate.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                <div className="hint" style={{ marginBottom: 10 }}>
                  Inserisci il costo complessivo e la % imputabile a questa attività.
                  L’app calcola l’importo imputato.
                </div>

                {USCITE_LABELS.map((label, i) => {
                  const row = uscite?.[i] ?? { costo_complessivo: 0, perc: 0 };
                  const imputato = calcImputato(row.costo_complessivo, row.perc);

                  return (
                    <div key={label} className="blockInput">
                      <div className="blockTitle">{label}</div>
                      <div className="hint">{USCITE_HELP[label]}</div>

                      <div className="miniGrid">
                        <div>
                          <div className="miniLabel">Costo complessivo (€)</div>
                          <input
                            type="number"
                            value={num(row.costo_complessivo)}
                            onChange={(e) =>
                              setUscite((p) => ({
                                ...p,
                                [i]: {
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
                              setUscite((p) => ({
                                ...p,
                                [i]: {
                                  ...row,
                                  perc: e.target.value === "" ? 0 : Number(e.target.value),
                                },
                              }))
                            }
                            onBlur={(e) =>
                              setUscite((p) => ({
                                ...p,
                                [i]: {
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
          </>
        )}
      </main>
    </div>
  );
}
