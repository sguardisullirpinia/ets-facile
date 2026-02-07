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

function clampPerc(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function calcImputato(costoCompl: any, perc: any) {
  return num(costoCompl) * (clampPerc(perc) / 100);
}

/* ---------- AIG helpers (coerenti con Anno.tsx) ---------- */

function totalEntrateAigAll(entrate: any) {
  return (
    num(entrate?.entrate_associati_mutuali) +
    num(entrate?.prestazioni_soci_fondatori) +
    num(entrate?.contributi_privati) +
    num(entrate?.prestazioni_terzi) +
    num(entrate?.contributi_pubblici) +
    num(entrate?.contratti_pubblici) +
    num(entrate?.altri_ricavi) +
    num(entrate?.rimanenze_finali)
  );
}

function totalEntrateAigPerTest(entrate: any, natura: "APS" | "ODV") {
  const all = totalEntrateAigAll(entrate);
  if (natura === "APS") {
    return (
      all -
      num(entrate?.entrate_associati_mutuali) -
      num(entrate?.prestazioni_soci_fondatori)
    );
  }
  return all;
}

function totalCostiDirettiImputati(c: any) {
  const mp = c?.materie_prime ?? {};
  const se = c?.servizi ?? {};
  const gb = c?.godimento_beni_terzi ?? {};
  const pe = c?.personale ?? {};
  const am = c?.ammortamenti ?? {};
  const ac = c?.accantonamenti ?? {};
  const od = c?.oneri_diversi ?? {};
  const ri = c?.rimanenze_iniziali ?? {};

  return (
    calcImputato(mp.costo_complessivo, mp.perc) +
    calcImputato(se.costo_complessivo, se.perc) +
    calcImputato(gb.costo_complessivo, gb.perc) +
    calcImputato(pe.costo_complessivo, pe.perc) +
    calcImputato(am.costo_complessivo, am.perc) +
    calcImputato(ac.costo_complessivo, ac.perc) +
    calcImputato(od.costo_complessivo, od.perc) +
    calcImputato(ri.costo_complessivo, ri.perc)
  );
}

function totalCostiFinImputati(c: any) {
  const rb = c?.rapporti_bancari ?? {};
  const pr = c?.prestiti ?? {};
  return (
    calcImputato(rb.costo_complessivo, rb.perc) +
    calcImputato(pr.costo_complessivo, pr.perc)
  );
}

function totalCostiSupportoImputati(c: any) {
  const mp = c?.materie_prime ?? {};
  const se = c?.servizi ?? {};
  const gb = c?.godimento_beni_terzi ?? {};
  const pe = c?.personale ?? {};
  const am = c?.ammortamenti ?? {};
  const ac = c?.accantonamenti ?? {};
  const ao = c?.altri_oneri ?? {};
  return (
    calcImputato(mp.costo_complessivo, mp.perc) +
    calcImputato(se.costo_complessivo, se.perc) +
    calcImputato(gb.costo_complessivo, gb.perc) +
    calcImputato(pe.costo_complessivo, pe.perc) +
    calcImputato(am.costo_complessivo, am.perc) +
    calcImputato(ac.costo_complessivo, ac.perc) +
    calcImputato(ao.costo_complessivo, ao.perc)
  );
}

/* ---------- Art.6 helpers ---------- */

// Entrate Art.6: somma di tutte le entrate (indipendente da spunta occasionale e da spons)
function totalArt6EntrateAll(entrate: any) {
  return Object.values(entrate ?? {}).reduce((s: number, v: any) => s + num(v), 0);
}

// Per TEST ENTE (voce C): NON occasionali e senza spons (indice 5 = spons)
function totalArt6EntrateNoSpons(entrate: any) {
  const all = totalArt6EntrateAll(entrate);
  const spons = num((entrate ?? {})[5]);
  return all - spons;
}

// Uscite Art.6: imputate (costo_complessivo * %)
function totalArt6UsciteImputate(uscite: any) {
  const obj = uscite ?? {};
  return Object.keys(obj).reduce((s: number, k: string) => {
    const v = (obj as any)[k];
    if (typeof v === "number") return s + num(v); // retro-compat
    return s + calcImputato(v?.costo_complessivo, v?.perc);
  }, 0);
}

/* ---------- RF helpers ---------- */
function totalRfEntrate(entrate: any) {
  return Object.values(entrate ?? {}).reduce((s: number, v: any) => s + num(v), 0);
}
function totalRfUscite(uscite: any) {
  return Object.values(uscite ?? {}).reduce((s: number, v: any) => s + num(v), 0);
}

export default function IresPage() {
  const nav = useNavigate();
  const { annualitaId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [ente, setEnte] = useState<{ denominazione: string; natura: "APS" | "ODV" } | null>(null);
  const [extra, setExtra] = useState<any>({
    quote_assoc: 0,
    erogazioni: 0,
    cinque_per_mille: 0,
    convenzioni_art56: 0,
    altri_non_commerciali: 0,
  });

  const [aigs, setAigs] = useState<any[]>([]);
  const [art6, setArt6] = useState<any[]>([]);
  const [raccolte, setRaccolte] = useState<any[]>([]);

  const [ricaviPrecedente, setRicaviPrecedente] = useState<number>(0);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // LOAD
  useEffect(() => {
    const run = async () => {
      if (!annualitaId) return;
      setLoading(true);
      setErr(null);

      try {
        const [p, a, aa, bb, cc, iresRow] = await Promise.all([
          getEnteProfile(),
          getAnnualita(annualitaId),
          listAig(annualitaId),
          listArt6(annualitaId),
          listRaccolte(annualitaId),
          getIresByAnnualitaId(annualitaId),
        ]);

        setEnte(p as any);

        setExtra({
          quote_assoc: a.extra?.quote_assoc ?? 0,
          erogazioni: a.extra?.erogazioni ?? 0,
          cinque_per_mille: a.extra?.cinque_per_mille ?? 0,
          convenzioni_art56: a.extra?.convenzioni_art56 ?? 0,
          altri_non_commerciali: a.extra?.altri_non_commerciali ?? 0,
        });

        setAigs(aa as any);
        setArt6(bb as any);
        setRaccolte(cc as any);

        setRicaviPrecedente(num(iresRow?.ricavi_precedente ?? 0));
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento IRES");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [annualitaId]);

  const naturaEnte: "APS" | "ODV" = ente?.natura ?? "APS";

  /* ---------- CALCOLI: ESITO ENTE (coerente con Riepilogo) ---------- */

  const aigComputed = useMemo(() => {
    const items = aigs.map((a) => {
      const entrAll = totalEntrateAigAll(a.entrate);
      const entrTest = totalEntrateAigPerTest(a.entrate, naturaEnte);

      const cd = totalCostiDirettiImputati(a.costi_diretti);
      const cf = totalCostiFinImputati(a.costi_fin);
      const cs = totalCostiSupportoImputati(a.costi_supporto);

      const uscite = cd + cf + cs;
      const soglia = uscite * 1.06;
      const commerciale = entrTest > soglia;

      return { entrAll, entrTest, uscite, commerciale };
    });

    const totEntrCommerciali = items
      .filter((x) => x.commerciale)
      .reduce((s, x) => s + x.entrTest, 0);

    const totEntrNonCommerciali = items
      .filter((x) => !x.commerciale)
      .reduce((s, x) => s + x.entrAll, 0);

    const totEntrAigAll = items.reduce((s, x) => s + x.entrAll, 0);
    const totCostiAig = items.reduce((s, x) => s + x.uscite, 0);

    return { totEntrCommerciali, totEntrNonCommerciali, totEntrAigAll, totCostiAig };
  }, [aigs, naturaEnte]);

  const art6Computed = useMemo(() => {
    const totEntrAll = art6.reduce((s, x) => s + totalArt6EntrateAll(x.entrate), 0);

    const totEntrNoSpons = art6
      .filter((x) => !Boolean(x.occasionale))
      .reduce((s, x) => s + totalArt6EntrateNoSpons(x.entrate), 0);

    const totUsciteImputate = art6.reduce((s, x) => s + totalArt6UsciteImputate(x.uscite), 0);

    return { totEntrAll, totEntrNoSpons, totUsciteImputate };
  }, [art6]);

  const rfComputed = useMemo(() => {
    const totEntr = raccolte.reduce((s, x) => s + totalRfEntrate(x.entrate), 0);
    const totUscite = raccolte.reduce((s, x) => s + totalRfUscite(x.uscite), 0);
    return { totEntr, totUscite };
  }, [raccolte]);

  const extraNonCommerciali = useMemo(() => {
    return (
      num(extra?.quote_assoc) +
      num(extra?.erogazioni) +
      num(extra?.cinque_per_mille) +
      num(extra?.convenzioni_art56) +
      num(extra?.altri_non_commerciali)
    );
  }, [extra]);

  // ESITO ENTE
  const lhsCommerciale = aigComputed.totEntrCommerciali + art6Computed.totEntrNoSpons;
  const rhsNonCommerciale = aigComputed.totEntrNonCommerciali + extraNonCommerciali;
  const enteCommerciale = lhsCommerciale > rhsNonCommerciale;

  /* ---------- REGIME ---------- */
  const regimeForfettario = !enteCommerciale && num(ricaviPrecedente) <= 85000;

  const regimeLabel = enteCommerciale
    ? "REGIME ORDINARIO APPLICABILE"
    : regimeForfettario
      ? "REGIME FORFETTARIO APPLICABILE"
      : "REGIME ORDINARIO APPLICABILE";

  /* ---------- FORFETTARIO: imponibile e ires (APS 3% / ODV 1%) ---------- */

  // base per forfettario come tua regola: AIG COMMERCIALI + Art.6 tutte
  const baseForfettaria = useMemo(() => {
    return aigComputed.totEntrCommerciali + art6Computed.totEntrAll;
  }, [aigComputed.totEntrCommerciali, art6Computed.totEntrAll]);

  const coeffRedditivita = naturaEnte === "APS" ? 0.03 : 0.01; // ✅ APS 3%, ODV 1%

  const imponibileForfettario = useMemo(() => {
    return baseForfettaria * coeffRedditivita;
  }, [baseForfettaria, coeffRedditivita]);

  const iresForfettaria = useMemo(() => {
    return imponibileForfettario * 0.24;
  }, [imponibileForfettario]);

  /* ---------- ORDINARIO: utile, imponibile e ires ---------- */
  const utileOrdinario = useMemo(() => {
    const entrateTot =
      aigComputed.totEntrCommerciali +
      aigComputed.totEntrNonCommerciali +
      art6Computed.totEntrAll +
      rfComputed.totEntr +
      extraNonCommerciali;

    const costiTot =
      aigComputed.totCostiAig + art6Computed.totUsciteImputate + rfComputed.totUscite;

    return entrateTot - costiTot;
  }, [
    aigComputed.totEntrCommerciali,
    aigComputed.totEntrNonCommerciali,
    aigComputed.totCostiAig,
    art6Computed.totEntrAll,
    art6Computed.totUsciteImputate,
    rfComputed.totEntr,
    rfComputed.totUscite,
    extraNonCommerciali,
  ]);

  const imponibileOrdinario = useMemo(() => Math.max(0, utileOrdinario), [utileOrdinario]);
  const iresOrdinaria = useMemo(() => imponibileOrdinario * 0.24, [imponibileOrdinario]);

  // valori salvati
  const imponibileToSave = regimeForfettario ? imponibileForfettario : imponibileOrdinario;
  const iresToSave = regimeForfettario ? iresForfettaria : iresOrdinaria;

  /* ---------- AUTOSAVE IRES ---------- */
  useEffect(() => {
    if (!annualitaId) return;
    if (loading) return;

    setSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        await upsertIresByAnnualitaId(annualitaId, {
          ricavi_precedente: ricaviPrecedente,
          imponibile: imponibileToSave,
          aliquota: 24,
          imposta_lorda: iresToSave,
          imposta_netta: iresToSave,
          acconti_versati: 0,
          ritenute: 0,
          saldo: iresToSave,
          note: regimeForfettario ? "forfettario" : "ordinario",
        });

        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 900);
      } catch {
        setSaveStatus("error");
      }
    }, 700);

    return () => clearTimeout(t);
  }, [annualitaId, loading, ricaviPrecedente, imponibileToSave, iresToSave, regimeForfettario]);

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button className="iconBtn" onClick={() => nav(`/anno/${annualitaId}`)} aria-label="Indietro">
          ←
        </button>

        <div className="mHeaderText">
          <div className="mTitle">IRES</div>
          <div className="mSubtitle">
            {saveStatus === "saving" && "Salvataggio…"}
            {saveStatus === "saved" && "Salvato ✓"}
            {saveStatus === "error" && "Errore salvataggio"}
            {saveStatus === "idle" && (enteCommerciale ? "ENTE COMMERCIALE" : "ENTE NON COMMERCIALE")}
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
            <div className="reportCard">
              <div className="reportTitle">QUALIFICA ENTE</div>

              <div className={enteCommerciale ? "reportResult bad" : "reportResult ok"}>
                {enteCommerciale ? "ENTE COMMERCIALE" : "ENTE NON COMMERCIALE"}
              </div>

              {!enteCommerciale && (
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Ricavi Annualità Precedente</label>
                  <input
                    type="number"
                    value={num(ricaviPrecedente)}
                    onChange={(e) => setRicaviPrecedente(Number(e.target.value || 0))}
                  />
                  <div className="hint">Se ≤ 85.000 → regime forfettario</div>
                </div>
              )}

              <div style={{ marginTop: 10 }} className="reportRow">
                <span>Regime</span>
                <b>{regimeLabel}</b>
              </div>
            </div>

            {/* FORFETTARIO */}
            {regimeForfettario && (
              <div className="reportCard">
                <div className="reportTitle">FORFETTARIO</div>

                <div className="reportRow">
                  <span>Totale Entrate da AIG COMMERCIALI</span>
                  <b>{aigComputed.totEntrCommerciali.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Totale entrate Attività diverse (tutte)</span>
                  <b>{art6Computed.totEntrAll.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Base (AIG COMM + Art.6 tutte)</span>
                  <b>{baseForfettaria.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Coeff. redditività ({naturaEnte === "APS" ? "3%" : "1%"})</span>
                  <b>{(coeffRedditivita * 100).toFixed(0)}%</b>
                </div>

                <div className="reportRow">
                  <span>Imponibile</span>
                  <b>{imponibileForfettario.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>IRES (24% su imponibile)</span>
                  <b>{iresForfettaria.toFixed(2)}€</b>
                </div>

                <div className={iresForfettaria > 0 ? "reportResult bad" : "reportResult ok"}>
                  {iresForfettaria > 0 ? "IMPOSTA DA VERSARE" : "A CREDITO / ZERO"}
                </div>
              </div>
            )}

            {/* ORDINARIO */}
            {!regimeForfettario && (
              <div className="reportCard">
                <div className="reportTitle">ORDINARIO</div>

                <div className="reportRow">
                  <span>AIG COMMERCIALI</span>
                  <b>{aigComputed.totEntrCommerciali.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>AIG NON COMMERCIALI</span>
                  <b>{aigComputed.totEntrNonCommerciali.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Attività diverse (tutte)</span>
                  <b>{art6Computed.totEntrAll.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Raccolte fondi (entrate)</span>
                  <b>{rfComputed.totEntr.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Proventi NON commerciali per natura</span>
                  <b>{extraNonCommerciali.toFixed(2)}€</b>
                </div>

                <div style={{ height: 10 }} />

                <div className="reportRow">
                  <span>Costi AIG (imputati)</span>
                  <b>{aigComputed.totCostiAig.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Costi Attività diverse (imputati)</span>
                  <b>{art6Computed.totUsciteImputate.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Uscite Raccolte fondi</span>
                  <b>{rfComputed.totUscite.toFixed(2)}€</b>
                </div>

                <div style={{ height: 10 }} />

                <div className="reportRow">
                  <span>UTILE (Entrate - Costi)</span>
                  <b>{utileOrdinario.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>Imponibile (utile positivo)</span>
                  <b>{imponibileOrdinario.toFixed(2)}€</b>
                </div>

                <div className="reportRow">
                  <span>IRES (24% su imponibile)</span>
                  <b>{iresOrdinaria.toFixed(2)}€</b>
                </div>

                <div className={iresOrdinaria > 0 ? "reportResult bad" : "reportResult ok"}>
                  {iresOrdinaria > 0 ? "IMPOSTA DA VERSARE" : "A CREDITO / ZERO"}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
