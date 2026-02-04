import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getEnteProfile, updateArt6, getArt6ById } from "../lib/db";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function Art6Editor() {
  const nav = useNavigate();
  const { annualitaId, art6Id } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [descr, setDescr] = useState("");

  const [entrate, setEntrate] = useState<any>({});
  const [uscite, setUscite] = useState<any>({});

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // LOAD
  useEffect(() => {
    const run = async () => {
      if (!art6Id) return;
      setLoading(true);
      try {
        const a = await getArt6ById(art6Id);
        setNome(a.nome ?? "");
        setDescr(a.descrizione ?? "");
        setEntrate(a.entrate ?? {});
        setUscite(a.uscite ?? {});
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [art6Id]);

  // TOTALI
  const totEntrate = useMemo(
    () => Object.values(entrate).reduce((s: number, v: any) => s + num(v), 0),
    [entrate],
  );

  const totUscite = useMemo(
    () => Object.values(uscite).reduce((s: number, v: any) => s + num(v), 0),
    [uscite],
  );

  // AUTOSAVE
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
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 800);
      } catch {
        setSaveStatus("error");
      }
    }, 700);

    return () => clearTimeout(t);
  }, [nome, descr, entrate, uscite]);

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button className="iconBtn" onClick={() => nav(`/anno/${annualitaId}`)}>
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
      </header>

      <main className="mContent">
        {err && <div className="error">{err}</div>}
        {loading ? (
          <p>Caricamento…</p>
        ) : (
          <>
            <div className="cardBlock">
              <div className="field">
                <label>Nome attività</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="field">
                <label>Descrizione</label>
                <input
                  value={descr}
                  onChange={(e) => setDescr(e.target.value)}
                />
              </div>
            </div>

            <details className="acc">
              <summary className="accSum">
                ENTRATE <span>{totEntrate.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                {[
                  "Prestazioni ad associati",
                  "Contributi privati",
                  "Prestazioni a terzi",
                  "Contributi pubblici",
                  "Contratti pubblici",
                  "Sponsorizzazioni",
                  "Altre entrate",
                ].map((label, i) => (
                  <div key={i} className="rowInput">
                    <div>{label}</div>
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

            <details className="acc">
              <summary className="accSum">
                USCITE <span>{totUscite.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                {[
                  "Materie prime",
                  "Servizi",
                  "Godimento beni di terzi",
                  "Personale",
                  "Uscite diverse",
                ].map((label, i) => (
                  <div key={i} className="rowInput">
                    <div>{label}</div>
                    <input
                      type="number"
                      value={num(uscite[i])}
                      onChange={(e) =>
                        setUscite((p: any) => ({
                          ...p,
                          [i]: Number(e.target.value || 0),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
