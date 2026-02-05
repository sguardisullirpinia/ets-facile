import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateArt6, getArt6ById } from "../lib/db";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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
  const [uscite, setUscite] = useState<any>({});

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

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
        setUscite(a?.uscite ?? {});
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
    return Object.values(entrate).reduce((s: number, v: any) => s + num(v), 0);
  }, [entrate]);

  const totUscite = useMemo(() => {
    return Object.values(uscite).reduce((s: number, v: any) => s + num(v), 0);
  }, [uscite]);

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
  }, [art6Id, loading, nome, descr, entrate, uscite]);

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button className="iconBtn" onClick={() => nav(`/anno/${annualitaId}`)} aria-label="Indietro">
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
              <div className="field">
                <label>Nome attività</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="field">
                <label>Descrizione</label>
                <input value={descr} onChange={(e) => setDescr(e.target.value)} />
              </div>
            </div>

            <details className="acc">
              <summary className="accSum">
                ENTRATE <span>{totEntrate.toFixed(2)}€</span>
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

            <details className="acc">
              <summary className="accSum">
                USCITE <span>{totUscite.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                {USCITE_LABELS.map((label, i) => (
                  <div key={label} className="rowInput">
                    <div className="rowLabel">
                      <div>{label}</div>
                      <div className="hint">{USCITE_HELP[label]}</div>
                    </div>

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

