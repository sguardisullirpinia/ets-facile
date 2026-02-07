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

type Natura = "APS" | "ODV";

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

/** ========= CALCOLI COME IN ANNO.TSX (ricopiati) ========= */

// Entrate AIG: totale (tutte)
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

// Entrate AIG “per test” (APS esclude 1 e 2)
function totalEntrateAigPerTest(entrate: any, natura: Natura) {
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

// Costi diretti imputati
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

function totalCostiFinImputati(costiFin: any) {
  const rb = costiFin?.rapporti_bancari ?? {};
  const pr = costiFin?.prestiti ?? {};
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

// Art.6 entrate: indici 0..6, indice 5 = Sponsorizzazioni
function totalArt6EntrateAll(entrate: any) {
  return Object.values(entrate ?? {}).reduce((s: number, v: any) => s + num(v), 0);
}
function totalArt6EntrateNoSpons(entrate: any) {
  const all = totalArt6EntrateAll(entrate);
  const spons = num((entrate ?? {})[5]);
  return all - spons;
}

// Art.6 uscite: possono essere numeri o {costo_complessivo, perc}
function totalArt6UsciteImputate(uscite: any) {
  const values = Object.values(uscite ?? {});
  return values.reduce((s: number, v: any) => {
    if (typeof v === "number") return s + num(v);
    return s + calcImputato(v?.costo_complessivo, v?.perc);
  }, 0);
}

function totalRfEntrate(entrate: any) {
  return Object.values(entrate ?? {}).reduce((s: number, v: any) => s + num(v), 0);
}
function totalRfUscite(uscite: any) {
  return Object.values(uscite ?? {}).reduce((s: number, v: any) => s + num(v), 0);
}

/** ======================================================= */

export default function IresPage() {
  const nav = useNavigate();
  const { annualitaId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [ente, setEnte] = useState<{ denominazione: string; natura: Natura } | null>(null);

  const [aigs, setAigs] = useState<any[]>([]);
  const [art6, setArt6] = useState<any[]>([]);
  const [raccolte, setRaccolte] = useState<any[]>([]);

  const [extra, setExtra] = useState<any>({
    quote_assoc: 0,
    erogazioni: 0,
    cinque_per_mille: 0,
    convenzioni_art56: 0,
    altri_non_commerciali: 0,
  });

  // dati tabella ires
  const [data, setData] = useState<any>({
    ricavi_precedente: 0, // ✅ nuova colonna (vedi SQL)
    imponibile: 0,
    aliquota: 24,
    imposta_lorda: 0,
    imposta_netta: 0,
    acconti_versati: 0,
    ritenute: 0,
    saldo: 0,
    note: "",
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // LOAD TUTTO
  useEffect(() => {
    const run = async () => {
      if (!annualitaId) return;
      setLoading(true);
      setErr(null);

      try {
        const [p, ann, aa, bb, cc, iresRow] = await Promise.all([
          getEnteProfile(),
          getAnnualita(annualitaId),
          listAig(annualitaId),
          listArt6(annualitaId),
          listRaccolte(annualitaId),
          getIresByAnnualitaId(annualitaId),
        ]);

        setEnte(p ?? null);
        setAigs((aa as any) ?? []);
        setArt6((bb as any) ?? []);
        setRaccolte((cc as any) ?? []);

        setExtra({
          quote_assoc: ann?.extra?.quote_assoc ?? 0,
          erogazioni: ann?.extra?.erogazioni ?? 0,
          cinque_per_mille: ann?.extra?.cinque_per_mille ?? 0,
          convenzioni_art56: ann?.extra?.convenzioni_art56 ?? 0,
          altri_non_commerciali: ann?.extra?.altri_non_commerciali ?? 0,
        });

        if (iresRow) {
          setData((prev: any) => ({
            ...prev,
            ricavi_precedente: num(iresRow.ricavi_precedente),
            imponibile: num(iresRow.imponibile),
            aliquota: num(iresRow.aliquota) || 24,
            imposta_lorda: num(iresRow.imposta_lorda),
            imposta_netta: num(iresRow.imposta_netta),
            acconti_versati: num(iresRow.acconti_versati),
            ritenute: num(iresRow.ritenute),
            saldo: num(iresRow.saldo),
            note: iresRow.note ?? "",
          }));
        }
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento IRES");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [annualitaId]);

  const naturaEnte: Natura = ente?.natura ?? "APS";

  // EXTRA non commerciali (voce D)
  const extraNonCommerciali = useMemo(() => {
    return (
      num(extra.quote_assoc) +
      num(extra.erogazioni) +
      num(extra.cinque_per_mille) +
      num(extra.convenzioni_art56) +
      num(extra.altri_non_commerciali)
    );
  }, [extra]);

  // AIG: calcolo esito per singola + totali (come Anno.tsx)
  const aigComputed = useMemo(() => {
    const items = aigs.map((a: any) => {
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

  // ART.6 totali (come Anno.tsx per test ente)
  const art6Computed = useMemo(() => {
    const totEntrAll = art6.reduce((s: number, x: any) => s + totalArt6EntrateAll(x.entrate), 0);

    // voce C (test ente): solo NON occasionali + senza spons
    const totEntrNoSpons = art6
      .filter((x: any) => !Boolean(x.occasionale))
      .reduce((s: number, x: any) => s + totalArt6EntrateNoSpons(x.entrate), 0);

    // per IRES ordinario: costi imputati art.6 (tutti)
    const totUsciteImputate = art6.reduce((s: number, x: any) => s + totalArt6UsciteImputate(x.uscite), 0);

    return { totEntrAll, totEntrNoSpons, totUsciteImputate };
  }, [art6]);

  // RACCOLTE
  const rfComputed = useMemo(() => {
    const totEntr = raccolte.reduce((s: number, x: any) => s + totalRfEntrate(x.entrate), 0);
    const totUscite = raccolte.reduce((s: number, x: any) => s + totalRfUscite(x.uscite), 0);
    return { totEntr, totUscite };
  }, [raccolte]);

  // ESITO ENTE (come riepilogo)
  const lhsCommerciale = aigComputed.totEntrCommerciali + art6Computed.totEntrNoSpons;
  const rhsNonCommerciale = aigComputed.totEntrNonCommerciali + extraNonCommerciali;
  const enteCommerciale = lhsCommerciale > rhsNonCommerciale;

  // REGIME
  const ricaviPrecedente = num(data.ricavi_precedente);

  const regime = useMemo(() => {
    if (enteCommerciale) return "ORDINARIO";
    // ente NON commerciale
    if (ricaviPrecedente <= 85000) return "FORFETARIO";
    return "ORDINARIO";
  }, [enteCommerciale, ricaviPrecedente]);

  // ========= CALCOLO IRES =========

  // Base ricavi per forfettario: AIG COMMERCIALI + Art.6 TUTTE (indipendente da spunte)
  const baseForfettario = useMemo(() => {
    return aigComputed.totEntrCommerciali + art6Computed.totEntrAll;
  }, [aigComputed.totEntrCommerciali, art6Computed.totEntrAll]);

  // coefficiente “già IRES” (come hai indicato)
  const coeffIresForf = useMemo(() => {
    return naturaEnte === "APS" ? 0.0072 : 0.0024;
  }, [naturaEnte]);

  const iresForfettaria = useMemo(() => {
    return baseForfettario * coeffIresForf;
  }, [baseForfettario, coeffIresForf]);

  // Ordinario: (tutte entrate) - (tutti costi imputabili/uscite) = utile; IRES = 24% utile
  const totaleEntrateOrdinario = useMemo(() => {
    return (
      aigComputed.totEntrAigAll +
      art6Computed.totEntrAll +
      rfComputed.totEntr +
      extraNonCommerciali
    );
  }, [aigComputed.totEntrAigAll, art6Computed.totEntrAll, rfComputed.totEntr, extraNonCommerciali]);

  const totaleCostiOrdinario = useMemo(() => {
    return (
      aigComputed.totCostiAig +
      art6Computed.totUsciteImputate +
      rfComputed.totUscite
    );
  }, [aigComputed.totCostiAig, art6Computed.totUsciteImputate, rfComputed.totUscite]);

  const utileOrdinario = useMemo(() => {
    return totaleEntrateOrdinario - totaleCostiOrdinario;
  }, [totaleEntrateOrdinario, totaleCostiOrdinario]);

  const imponibileOrdinario = useMemo(() => {
    // per prudenza: se utile negativo, imponibile 0
    return Math.max(0, utileOrdinario);
  }, [utileOrdinario]);

  const iresOrdinaria = useMemo(() => {
    return imponibileOrdinario * 0.24;
  }, [imponibileOrdinario]);

  // scrivo nei campi “standard” che già hai in tabella ires
  useEffect(() => {
    if (loading) return;

    if (regime === "FORFETARIO") {
      const imponibile = baseForfettario * (naturaEnte === "APS" ? 0.03 : 0.01); // informativo (coeff redditività)
      const imposta = iresForfettaria;

      setData((p: any) => ({
        ...p,
        imponibile: imponibile,
        aliquota: 24,
        imposta_lorda: imposta,
        imposta_netta: imposta,
        saldo: imposta - num(p.acconti_versati) - num(p.ritenute),
      }));
    } else {
      const imposta = iresOrdinaria;

      setData((p: any) => ({
        ...p,
        imponibile: imponibileOrdinario,
        aliquota: 24,
        imposta_lorda: imposta,
        imposta_netta: imposta,
        saldo: imposta - num(p.acconti_versati) - num(p.ritenute),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regime, naturaEnte, baseForfettario, iresForfettaria, iresOrdinaria, imponibileOrdinario, loading]);

  // AUTOSAVE (debounce)
  useEffect(() => {
    if (!annualitaId) return;
    if (loading) return;

    setSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        await upsertIresByAnnualitaId(annualitaId, data);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 900);
      } catch {
        setSaveStatus("error");
      }
    }, 700);

    return () => clearTimeout(t);
  }, [annualitaId, loading, data]);

  const badgeEnte = enteCommerciale ? "reportResult bad" : "reportResult ok";

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
          <div className="mTitle">IRES</div>
          <div className="mSubtitle">
            {saveStatus === "saving" && "Salvataggio…"}
            {saveStatus === "saved" && "Salvato ✓"}
            {saveStatus === "error" && "Errore salvataggio"}
            {saveStatus === "idle" && (ente ? `Ente: ${ente.natura} • ${ente.denominazione}` : "—")}
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
            {/* ESITO ENTE */}
            <div className="reportCard">
              <div className="reportTitle">ESITO ENTE</div>
              <div className={badgeEnte}>
                {enteCommerciale ? "ENTE COMMERCIALE" : "ENTE NON COMMERCIALE"}
              </div>

              <div className="muted" style={{ marginTop: 8 }}>
                Lato “COMM” = AIG commerciali + Art.6 (senza spons e non occasionali) <br />
                Lato “NON COMM” = AIG non commerciali + Proventi non commerciali per natura
              </div>
            </div>

            {/* REGIME */}
            <div className="cardBlock">
              {!enteCommerciale && (
                <div className="field">
                  <label>Ricavi Annualità Precedente (€)</label>
                  <input
                    type="number"
                    value={num(data.ricavi_precedente)}
                    onChange={(e) =>
                      setData((p: any) => ({
                        ...p,
                        ricavi_precedente: Number(e.target.value || 0),
                      }))
                    }
                  />
                  <div className="hint">Se ≤ 85.000 → Regime forfetario applicabile</div>
                </div>
              )}

              <div className="reportRow" style={{ marginTop: 6 }}>
                <span>Regime</span>
                <b>
                  {regime === "FORFETARIO"
                    ? "REGIME FORFETARIO APPLICABILE"
                    : "REGIME ORDINARIO APPLICABILE"}
                </b>
              </div>
            </div>

            {/* SE FORFETARIO */}
            {regime === "FORFETARIO" && (
              <>
                <div className="reportCard">
                  <div className="reportTitle">CALCOLO FORFETARIO</div>

                  <div className="reportRow">
                    <span>Totale Entrate da AIG COMMERCIALI</span>
                    <b>{aigComputed.totEntrCommerciali.toFixed(2)}€</b>
                  </div>

                  <div className="reportRow">
                    <span>Totale entrate Attività diverse (tutte)</span>
                    <b>{art6Computed.totEntrAll.toFixed(2)}€</b>
                  </div>

                  <div className="reportRow">
                    <span>Base (somma)</span>
                    <b>{baseForfettario.toFixed(2)}€</b>
                  </div>

                  <div className="reportRow">
                    <span>Coefficiente IRES</span>
                    <b>{(coeffIresForf * 100).toFixed(4)}%</b>
                  </div>

                  <div className="reportRow">
                    <span>IRES dovuta (base × coeff.)</span>
                    <b>{iresForfettaria.toFixed(2)}€</b>
                  </div>
                </div>
              </>
            )}

            {/* SE ORDINARIO */}
            {regime === "ORDINARIO" && (
              <>
                <div className="reportCard">
                  <div className="reportTitle">CALCOLO ORDINARIO</div>

                  <div className="reportRow">
                    <span>Totale entrate (AIG tutte + Art.6 tutte + Raccolte + Extra)</span>
                    <b>{totaleEntrateOrdinario.toFixed(2)}€</b>
                  </div>

                  <div className="reportRow">
                    <span>Totale costi (AIG imputati + Art.6 imputati + Uscite raccolte)</span>
                    <b>{totaleCostiOrdinario.toFixed(2)}€</b>
                  </div>

                  <div className="reportRow">
                    <span>Utile</span>
                    <b>{utileOrdinario.toFixed(2)}€</b>
                  </div>

                  <div className="reportRow">
                    <span>Imponibile (max(0, utile))</span>
                    <b>{imponibileOrdinario.toFixed(2)}€</b>
                  </div>

                  <div className="reportRow">
                    <span>IRES (24%)</span>
                    <b>{iresOrdinaria.toFixed(2)}€</b>
                  </div>
                </div>
              </>
            )}

            {/* INPUT PAGAMENTI + RISULTATO */}
            <div className="cardBlock">
              <div className="field">
                <label>Acconti versati (€)</label>
                <input
                  type="number"
                  value={num(data.acconti_versati)}
                  onChange={(e) =>
                    setData((p: any) => ({
                      ...p,
                      acconti_versati: Number(e.target.value || 0),
                    }))
                  }
                />
              </div>

              <div className="field">
                <label>Ritenute / crediti (€)</label>
                <input
                  type="number"
                  value={num(data.ritenute)}
                  onChange={(e) =>
                    setData((p: any) => ({
                      ...p,
                      ritenute: Number(e.target.value || 0),
                    }))
                  }
                />
              </div>

              <div className="field">
                <label>Note</label>
                <input
                  value={data.note ?? ""}
                  onChange={(e) => setData((p: any) => ({ ...p, note: e.target.value }))}
                  placeholder="Annotazioni…"
                />
              </div>
            </div>

            <div className="reportCard">
              <div className="reportTitle">RISULTATO (live)</div>

              <div className="reportRow">
                <span>Imposta lorda</span>
                <b>{num(data.imposta_lorda).toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Imposta netta</span>
                <b>{num(data.imposta_netta).toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Saldo (netta - acconti - ritenute)</span>
                <b>{num(data.saldo).toFixed(2)}€</b>
              </div>

              <div className={num(data.saldo) > 0 ? "reportResult bad" : "reportResult ok"}>
                {num(data.saldo) > 0 ? "IMPOSTA DA VERSARE" : "A CREDITO / ZERO"}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
