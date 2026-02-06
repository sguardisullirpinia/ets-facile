import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  getAnnualita,
  getEnteProfile,
  listAig,
  listArt6,
  listRaccolte,
  createAig,
  createArt6,
  createRaccolta,
  updateAnnualitaExtra,
} from "../lib/db";

type TabKey = "aig" | "art6" | "rf" | "extra" | "riepilogo";

type AigRow = {
  id: string;
  nome: string;
  descrizione: string;
  entrate: any;
  costi_diretti: any;
  costi_fin: any;
  costi_supporto: any;
};
type Art6Row = {
  id: string;
  nome: string;
  descrizione: string;
  entrate: any;
  uscite: any;
};
type RfRow = {
  id: string;
  nome: string;
  descrizione: string;
  entrate: any;
  uscite: any;
};

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcImputato(costoCompl: any, perc: any) {
  return num(costoCompl) * (num(perc) / 100);
}

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

// ✅ Entrate AIG “per test” (APS esclude 1 e 2)
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

// ✅ Costi diretti: ora imputati (costo_complessivo + %), come in AigEditor nuovo
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

// Art.6: nel tuo editor usi indici 0..6 per entrate, dove indice 5 = Sponsorizzazioni
function totalArt6EntrateAll(entrate: any) {
  return Object.values(entrate ?? {}).reduce(
    (s: number, v: any) => s + num(v),
    0
  );
}
function totalArt6EntrateNoSpons(entrate: any) {
  const all = totalArt6EntrateAll(entrate);
  const spons = num((entrate ?? {})[5]);
  return all - spons;
}
function totalArt6Uscite(uscite: any) {
  return Object.values(uscite ?? {}).reduce(
    (s: number, v: any) => s + num(v),
    0
  );
}

function totalRfEntrate(entrate: any) {
  return Object.values(entrate ?? {}).reduce(
    (s: number, v: any) => s + num(v),
    0
  );
}
function totalRfUscite(uscite: any) {
  return Object.values(uscite ?? {}).reduce(
    (s: number, v: any) => s + num(v),
    0
  );
}

export default function Anno() {
  const nav = useNavigate();
  const { annualitaId } = useParams();

  const [tab, setTab] = useState<TabKey>("aig");

  const [ente, setEnte] = useState<{
    denominazione: string;
    natura: "APS" | "ODV";
  } | null>(null);
  const [anno, setAnno] = useState<number | null>(null);

  const [aigs, setAigs] = useState<AigRow[]>([]);
  const [art6, setArt6] = useState<Art6Row[]>([]);
  const [raccolte, setRaccolte] = useState<RfRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // modal create
  const [openCreate, setOpenCreate] = useState(false);
  const [nome, setNome] = useState("");
  const [descr, setDescr] = useState("");

  const [extra, setExtra] = useState<any>({
    quote_assoc: 0,
    erogazioni: 0,
    cinque_per_mille: 0,
    convenzioni_art56: 0,
    altri_non_commerciali: 0,
  });

  const [extraStatus, setExtraStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const title = useMemo(() => {
    switch (tab) {
      case "aig":
        return "AIG";
      case "art6":
        return "Attività diverse (Art. 6)";
      case "rf":
        return "Raccolte fondi";
      case "extra":
        return "Entrate non Commerciali";
      case "riepilogo":
        return "Riepilogo";
    }
  }, [tab]);

  const naturaEnte = ente?.natura ?? "APS";

  // 1) Totali AIG per riepilogo
  const aigComputed = useMemo(() => {
    const items = aigs.map((a: any) => {
      const entrAll = totalEntrateAigAll(a.entrate);
      const entrTest = totalEntrateAigPerTest(a.entrate, naturaEnte);

      // ✅ usa costi diretti imputati
      const cd = totalCostiDirettiImputati(a.costi_diretti);
      const cf = totalCostiFinImputati(a.costi_fin);
      const cs = totalCostiSupportoImputati(a.costi_supporto);

      const uscite = cd + cf + cs;
      const soglia = uscite * 1.06;

      const commerciale = entrTest > soglia;

      return {
        id: a.id,
        nome: a.nome,
        entrAll,
        entrTest,
        uscite,
        soglia,
        commerciale,
      };
    });

    const totEntrCommerciali = items
      .filter((x) => x.commerciale)
      .reduce((s, x) => s + x.entrTest, 0);

    const totEntrNonCommerciali = items
      .filter((x) => !x.commerciale)
      .reduce((s, x) => s + x.entrAll, 0);

    const totEntrAigAll = items.reduce((s, x) => s + x.entrAll, 0);
    const totCostiAig = items.reduce((s, x) => s + x.uscite, 0);

    return {
      items,
      totEntrCommerciali,
      totEntrNonCommerciali,
      totEntrAigAll,
      totCostiAig,
    };
  }, [aigs, naturaEnte]);

  // ✅ mappa id -> commerciale per mostrare pill in elenco
  const aigEsitoById = useMemo(() => {
    const m = new Map<string, boolean>();
    aigComputed.items.forEach((it) => m.set(it.id, it.commerciale));
    return m;
  }, [aigComputed.items]);

  // 2) Totali Art.6
  const art6Computed = useMemo(() => {
    const totEntrAll = art6.reduce(
      (s: number, x: any) => s + totalArt6EntrateAll(x.entrate),
      0
    );
    const totEntrNoSpons = art6.reduce(
      (s: number, x: any) => s + totalArt6EntrateNoSpons(x.entrate),
      0
    );
    const totUscite = art6.reduce(
      (s: number, x: any) => s + totalArt6Uscite(x.uscite),
      0
    );
    return { totEntrAll, totEntrNoSpons, totUscite };
  }, [art6]);

  // 3) Totali Raccolte
  const rfComputed = useMemo(() => {
    const totEntr = raccolte.reduce(
      (s: number, x: any) => s + totalRfEntrate(x.entrate),
      0
    );
    const totUscite = raccolte.reduce(
      (s: number, x: any) => s + totalRfUscite(x.uscite),
      0
    );
    return { totEntr, totUscite };
  }, [raccolte]);

  // 4) Extra non commerciali
  const extraNonCommerciali = useMemo(() => {
    return (
      num(extra?.quote_assoc) +
      num(extra?.erogazioni) +
      num(extra?.cinque_per_mille) +
      num(extra?.convenzioni_art56) +
      num(extra?.altri_non_commerciali)
    );
  }, [extra]);

  const lhsCommerciale =
    aigComputed.totEntrCommerciali + art6Computed.totEntrNoSpons;

  const rhsNonCommerciale =
    aigComputed.totEntrNonCommerciali + extraNonCommerciali;

  const esitoEnte =
    lhsCommerciale > rhsNonCommerciale
      ? "ENTE COMMERCIALE"
      : "ENTE NON COMMERCIALE";

  const totaleEntrateEnte =
    aigComputed.totEntrAigAll +
    art6Computed.totEntrAll +
    rfComputed.totEntr +
    extraNonCommerciali;

  const soglia30 = totaleEntrateEnte * 0.3;
  const secondaria30 = art6Computed.totEntrAll <= soglia30;

  const totaleCostiEnte =
    aigComputed.totCostiAig + art6Computed.totUscite + rfComputed.totUscite;

  const soglia66 = totaleCostiEnte * 0.66;
  const secondaria66 = art6Computed.totEntrAll <= soglia66;

  const showFab = tab === "aig" || tab === "art6" || tab === "rf";

  const loadAll = async () => {
    if (!annualitaId) return;
    setErr(null);
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        getEnteProfile(),
        getAnnualita(annualitaId),
      ]);
      setEnte(p);
      setAnno(a.anno);

      setExtra({
        quote_assoc: a.extra?.quote_assoc ?? 0,
        erogazioni: a.extra?.erogazioni ?? 0,
        cinque_per_mille: a.extra?.cinque_per_mille ?? 0,
        convenzioni_art56: a.extra?.convenzioni_art56 ?? 0,
        altri_non_commerciali: a.extra?.altri_non_commerciali ?? 0,
      });

      const [aa, bb, cc] = await Promise.all([
        listAig(annualitaId),
        listArt6(annualitaId),
        listRaccolte(annualitaId),
      ]);

      setAigs(aa as any);
      setArt6(bb as any);
      setRaccolte(cc as any);
    } catch (e: any) {
      setErr(e?.message ?? "Errore caricamento");
    } finally {
      setLoading(false);
    }
  };

  // ✅ DELETE AIG
  const handleDeleteAig = async (id: string, nomeAig: string) => {
    const ok = window.confirm(`Vuoi eliminare l'AIG "${nomeAig}"?`);
    if (!ok) return;

    try {
      const { error } = await supabase.from("aig").delete().eq("id", id);
      if (error) throw error;
      setAigs((prev: any[]) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "Errore eliminazione AIG");
    }
  };

  // ✅ DELETE ART.6
  const handleDeleteArt6 = async (id: string, nomeArt6: string) => {
    const ok = window.confirm(`Vuoi eliminare l'attività diversa "${nomeArt6}"?`);
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("attivita_diverse")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setArt6((prev: any[]) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "Errore eliminazione Attività diverse");
    }
  };

  // ✅ DELETE RACCOLTA FONDI
  const handleDeleteRf = async (id: string, nomeRf: string) => {
    const ok = window.confirm(`Vuoi eliminare la raccolta fondi "${nomeRf}"?`);
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("raccolte_fondi")
        .delete()
        .eq("id", id);
      if (error) throw error;
      setRaccolte((prev: any[]) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "Errore eliminazione Raccolta fondi");
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annualitaId]);

  // Autosalvataggio EXTRA (debounce 700ms)
  useEffect(() => {
    if (!annualitaId) return;
    if (loading) return;

    setExtraStatus("saving");
    const t = setTimeout(async () => {
      try {
        await updateAnnualitaExtra(annualitaId, extra);
        setExtraStatus("saved");
        setTimeout(() => setExtraStatus("idle"), 900);
      } catch {
        setExtraStatus("error");
      }
    }, 700);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra]);

  const openCreateModal = () => {
    setNome("");
    setDescr("");
    setOpenCreate(true);
  };

  const onCreate = async () => {
    if (!annualitaId) return;
    if (!nome.trim()) return setErr("Inserisci il nome.");
    if (!descr.trim()) return setErr("La descrizione è obbligatoria.");

    setErr(null);
    try {
      if (tab === "aig") {
        const id = await createAig(annualitaId, nome.trim(), descr.trim());
        setOpenCreate(false);
        await loadAll();
        nav(`/anno/${annualitaId}/aig/${id}`);
      }
      if (tab === "art6") {
        const id = await createArt6(annualitaId, nome.trim(), descr.trim());
        setOpenCreate(false);
        await loadAll();
        nav(`/anno/${annualitaId}/art6/${id}`);
      }
      if (tab === "rf") {
        const id = await createRaccolta(annualitaId, nome.trim(), descr.trim());
        setOpenCreate(false);
        await loadAll();
        nav(`/anno/${annualitaId}/rf/${id}`);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Errore creazione");
    }
  };

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button
          className="iconBtn"
          onClick={() => nav("/dashboard")}
          aria-label="Indietro"
        >
          ←
        </button>

        <div className="mHeaderText">
          <div className="mTitle">Annualità {anno ?? ""}</div>
          <div className="mSubtitle">
            {ente
              ? `Ente: ${ente.natura} • ${ente.denominazione}`
              : "Caricamento…"}
          </div>
        </div>

        <div className="mHeaderRight" />
      </header>

      <main className="mContent">
        <h2 className="sectionTitle">{title}</h2>

        {err && <div className="error">{err}</div>}
        {loading && <p className="muted">Caricamento…</p>}

        {/* AIG */}
        {!loading && tab === "aig" && (
          <div className="list">
            {aigs.length === 0 && (
              <p className="muted">Nessuna AIG. Clicca “+” per crearne una.</p>
            )}

            {aigs.map((x) => {
              const comm = aigEsitoById.get(x.id);
              const label = comm ? "COMMERCIALE" : "NON COMMERCIALE";
              // se non hai pill ok/bad nel CSS, puoi cambiare in "pill warn" / "pill ok"
              const cls = comm ? "pill warn" : "pill ok";

              return (
                <div key={x.id} className="tile" style={{ textAlign: "left" }}>
                  <div className="tileTitle">{x.nome}</div>
                  <div className="tileMeta">{x.descrizione}</div>

                  {/* ✅ esito al posto di DA CALCOLARE */}
                  <div className={cls}>{label}</div>

                  <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                    <button
                      className="ghost"
                      onClick={() => nav(`/anno/${annualitaId}/aig/${x.id}`)}
                    >
                      Apri
                    </button>

                    <button
                      className="dangerBtn"
                      onClick={() => handleDeleteAig(x.id, x.nome)}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ART.6 */}
        {!loading && tab === "art6" && (
          <div className="list">
            {art6.length === 0 && (
              <p className="muted">
                Nessuna attività diversa. Clicca “+” per crearne una.
              </p>
            )}

            {art6.map((x) => (
              <div key={x.id} className="tile" style={{ textAlign: "left" }}>
                <div className="tileTitle">{x.nome}</div>
                <div className="tileMeta">{x.descrizione}</div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    className="ghost"
                    onClick={() => nav(`/anno/${annualitaId}/art6/${x.id}`)}
                  >
                    Apri
                  </button>

                  <button
                    className="dangerBtn"
                    onClick={() => handleDeleteArt6(x.id, x.nome)}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* RACCOLTE FONDI */}
        {!loading && tab === "rf" && (
          <div className="list">
            {raccolte.length === 0 && (
              <p className="muted">
                Nessuna raccolta fondi. Clicca “+” per crearne una.
              </p>
            )}

            {raccolte.map((x) => (
              <div key={x.id} className="tile" style={{ textAlign: "left" }}>
                <div className="tileTitle">{x.nome}</div>
                <div className="tileMeta">{x.descrizione}</div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    className="ghost"
                    onClick={() => nav(`/anno/${annualitaId}/rf/${x.id}`)}
                  >
                    Apri
                  </button>

                  <button
                    className="dangerBtn"
                    onClick={() => handleDeleteRf(x.id, x.nome)}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EXTRA (Entrate non Commerciali) */}
        {!loading && tab === "extra" && (
          <div className="cardBlock">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <p className="muted" style={{ margin: 0 }}>
                Entrate non Commerciali
              </p>
              <span className="muted" style={{ fontSize: 12 }}>
                {extraStatus === "saving" && "Salvataggio…"}
                {extraStatus === "saved" && "Salvato ✓"}
                {extraStatus === "error" && "Errore salvataggio"}
                {extraStatus === "idle" && ""}
              </span>
            </div>

            <div className="field">
              <label>Quote associative e apporti fondatori</label>
              <input
                type="number"
                value={extra.quote_assoc}
                onChange={(e) =>
                  setExtra((x: any) => ({
                    ...x,
                    quote_assoc: Number(e.target.value || 0),
                  }))
                }
              />
            </div>

            <div className="field">
              <label>Erogazioni liberali</label>
              <input
                type="number"
                value={extra.erogazioni}
                onChange={(e) =>
                  setExtra((x: any) => ({
                    ...x,
                    erogazioni: Number(e.target.value || 0),
                  }))
                }
              />
            </div>

            <div className="field">
              <label>Proventi del 5 per mille</label>
              <input
                type="number"
                value={extra.cinque_per_mille}
                onChange={(e) =>
                  setExtra((x: any) => ({
                    ...x,
                    cinque_per_mille: Number(e.target.value || 0),
                  }))
                }
              />
            </div>

            <div className="field">
              <label>
                Contributi erogati dalla PA per sostenere l'associazione o un suo
                progetto, senza che l'ente pubblico riceva nulla in cambio
              </label>
              <div className="hint">
                Nota: convenzioni/affidamenti con corrispettivo rientrano nei
                test (es. 6%) e non vanno qui.
              </div>
              <input
                type="number"
                value={extra.convenzioni_art56}
                onChange={(e) =>
                  setExtra((x: any) => ({
                    ...x,
                    convenzioni_art56: Number(e.target.value || 0),
                  }))
                }
              />
            </div>

            <div className="field">
              <label>Altri proventi non commerciali</label>
              <input
                type="number"
                value={extra.altri_non_commerciali}
                onChange={(e) =>
                  setExtra((x: any) => ({
                    ...x,
                    altri_non_commerciali: Number(e.target.value || 0),
                  }))
                }
              />
            </div>
          </div>
        )}

        {/* RIEPILOGO */}
        {!loading && tab === "riepilogo" && (
          <div className="cardBlock">
            <div className="reportCard">
              <div className="reportTitle">TEST COMMERCIALITÀ DELL’INTERO ENTE</div>

              <div className="reportRow">
                <span>A) Entrate da AIG COMMERCIALI</span>
                <b>{aigComputed.totEntrCommerciali.toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>B) Entrate da AIG NON COMMERCIALI</span>
                <b>{aigComputed.totEntrNonCommerciali.toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>C) Entrate da ATTIVITA' DIVERSE (senza sponsorizzazioni ex art. 79, 5° comma, CTS)</span>
                <b>{art6Computed.totEntrNoSpons.toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>D) Proventi NON COMMERCIALI per natura</span>
                <b>{extraNonCommerciali.toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Lato “COMM” = A + C</span>
                <b>{lhsCommerciale.toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Lato “NON COMM” = B + D</span>
                <b>{rhsNonCommerciale.toFixed(2)}€</b>
              </div>

              <div
                className={
                  lhsCommerciale > rhsNonCommerciale
                    ? "reportResult bad"
                    : "reportResult ok"
                }
              >
                {esitoEnte}
              </div>
            </div>

            <div className="reportCard">
              <div className="reportTitle">
                TEST DI SECONDARIETÀ (ATTIVITÀ DIVERSE)
              </div>

              <div className="reportRow">
                <span>Totale entrate Attività diverse (tutte)</span>
                <b>{art6Computed.totEntrAll.toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Totale entrate ENTE (AIG + Art.6 + Raccolte + Extra)</span>
                <b>{totaleEntrateEnte.toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Soglia 30% del totale entrate ente</span>
                <b>{soglia30.toFixed(2)}€</b>
              </div>

              <div className={secondaria30 ? "reportResult ok" : "reportResult bad"}>
                {secondaria30
                  ? "SECONDARIE (test 30% OK)"
                  : "NON SECONDARIE (test 30% KO)"}
              </div>

              <div style={{ height: 10 }} />

              <div className="reportRow">
                <span>Totale costi ente (AIG + Art.6 + Raccolte)</span>
                <b>{totaleCostiEnte.toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Soglia 66% del totale costi ente</span>
                <b>{soglia66.toFixed(2)}€</b>
              </div>

              <div className={secondaria66 ? "reportResult ok" : "reportResult bad"}>
                {secondaria66
                  ? "SECONDARIE (test 66% OK)"
                  : "NON SECONDARIE (test 66% KO)"}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FAB */}
      {showFab && (
        <button className="fab" onClick={openCreateModal} aria-label="Crea">
          +
        </button>
      )}

      {/* Modal creazione */}
      {openCreate && (
        <div className="modalOverlay" onClick={() => setOpenCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {tab === "aig" && "Crea AIG"}
              {tab === "art6" && "Crea attività diversa"}
              {tab === "rf" && "Crea raccolta fondi"}
            </h3>
            {tab === "aig" && (
            <p className="muted" style={{ marginTop: 4 }}>
              N.B. gli enti con ricavi, rendite, proventi o entrate <= a 300.000 euro, al fine del test di non commercialità possono considerare le diverse attività di interesse generale eventualmente svolte come un’unica attività.
            </p>
            )}

            <div className="field">
              <label>Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Doposcuola"
              />
            </div>

            <div className="field">
              <label>Descrizione (obbligatoria)</label>
              <input
                value={descr}
                onChange={(e) => setDescr(e.target.value)}
                placeholder="Descrizione sintetica…"
              />
            </div>

            <div className="row">
              <button className="ghost" onClick={() => setOpenCreate(false)}>
                Annulla
              </button>
              <button onClick={onCreate}>Crea</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="bottomNav">
        <button
          className={tab === "aig" ? "navBtn active" : "navBtn"}
          onClick={() => setTab("aig")}
        >
          <div className="navIcon">▦</div>
          <div className="navLabel">AIG</div>
        </button>
        <button
          className={tab === "art6" ? "navBtn active" : "navBtn"}
          onClick={() => setTab("art6")}
        >
          <div className="navIcon">≡</div>
          <div className="navLabel">Art.6</div>
        </button>
        <button
          className={tab === "rf" ? "navBtn active" : "navBtn"}
          onClick={() => setTab("rf")}
        >
          <div className="navIcon">⬤</div>
          <div className="navLabel">Raccolte</div>
        </button>
        <button
          className={tab === "extra" ? "navBtn active" : "navBtn"}
          onClick={() => setTab("extra")}
        >
          <div className="navIcon">€</div>
          <div className="navLabel">Entrate non commerciali</div>
        </button>
        <button
          className={tab === "riepilogo" ? "navBtn active" : "navBtn"}
          onClick={() => setTab("riepilogo")}
        >
          <div className="navIcon">✓</div>
          <div className="navLabel">Riepilogo</div>
        </button>
      </nav>
    </div>
  );
}




