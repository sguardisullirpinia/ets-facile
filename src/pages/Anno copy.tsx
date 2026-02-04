import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

export default function Anno() {
  console.log("Anno.tsx renderizzato");
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
        return "Extra";
      case "riepilogo":
        return "Riepilogo";
    }
  }, [tab]);

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

  useEffect(() => {
    loadAll();
  }, [annualitaId]);

  // Autosalvataggio EXTRA (debounce 700ms)
  useEffect(() => {
    if (!annualitaId) return;
    if (loading) return; // evita autosave mentre sta caricando i dati

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
      {/* Header sticky */}
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

        {!loading && tab === "aig" && (
          <div className="list">
            {aigs.length === 0 && (
              <p className="muted">Nessuna AIG. Clicca “+” per crearne una.</p>
            )}
            {aigs.map((x) => (
              <button
                key={x.id}
                className="tile"
                onClick={() => nav(`/anno/${annualitaId}/aig/${x.id}`)}
              >
                <div className="tileTitle">{x.nome}</div>
                <div className="tileMeta">{x.descrizione}</div>
                <div className="pill warn">DA CALCOLARE</div>
              </button>
            ))}
          </div>
        )}

        {!loading && tab === "art6" && (
          <div className="list">
            {art6.length === 0 && (
              <p className="muted">
                Nessuna attività diversa. Clicca “+” per crearne una.
              </p>
            )}
            {art6.map((x) => (
              <button
                key={x.id}
                className="tile"
                onClick={() => nav(`/anno/${annualitaId}/art6/${x.id}`)}
              >
                <div className="tileTitle">{x.nome}</div>
                <div className="tileMeta">{x.descrizione}</div>
              </button>
            ))}
          </div>
        )}

        {!loading && tab === "rf" && (
          <div className="list">
            {raccolte.length === 0 && (
              <p className="muted">
                Nessuna raccolta fondi. Clicca “+” per crearne una.
              </p>
            )}
            {raccolte.map((x) => (
              <button
                key={x.id}
                className="tile"
                onClick={() => nav(`/anno/${annualitaId}/rf/${x.id}`)}
              >
                <div className="tileTitle">{x.nome}</div>
                <div className="tileMeta">{x.descrizione}</div>
              </button>
            ))}
          </div>
        )}

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
                Voci annuali extra (autosave).
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
              <label>Convenzioni ex art. 56</label>
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

        {!loading && tab === "riepilogo" && (
          <div className="cardBlock">
            <p className="muted">
              Nel prossimo step calcoliamo qui tutto con i dati reali (A/B/C/D +
              test 30% e 60%).
            </p>
            <div className="reportCard">
              <div className="reportTitle">TEST COMMERCIALITÀ ENTE</div>
              <div className="reportRow">
                <span>A) AIG commerciali</span>
                <b>—</b>
              </div>
              <div className="reportRow">
                <span>B) AIG non commerciali</span>
                <b>—</b>
              </div>
              <div className="reportRow">
                <span>C) Attività diverse (no spons.)</span>
                <b>—</b>
              </div>
              <div className="reportRow">
                <span>D) Proventi non comm. extra</span>
                <b>—</b>
              </div>
              <div className="reportResult ok">ESITO ENTE: —</div>
            </div>

            <div className="reportCard">
              <div className="reportTitle">TEST SECONDARIETÀ</div>
              <div className="reportRow">
                <span>Tot entrate attività diverse</span>
                <b>—</b>
              </div>
              <div className="reportResult ok">30%: —</div>
              <div className="reportResult ok">60%: —</div>
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

      {/* Modal creazione reale */}
      {openCreate && (
        <div className="modalOverlay" onClick={() => setOpenCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              {tab === "aig" && "Crea AIG"}
              {tab === "art6" && "Crea attività diversa"}
              {tab === "rf" && "Crea raccolta fondi"}
            </h3>

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
          <div className="navLabel">Extra</div>
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
