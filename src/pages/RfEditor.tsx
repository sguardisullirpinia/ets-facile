import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRfById, updateRf } from "../lib/db";
import * as XLSX from "xlsx";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function RfEditor() {
  const nav = useNavigate();
  const { annualitaId, rfId } = useParams();

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
      if (!rfId) return;
      setLoading(true);
      try {
        const a = await getRfById(rfId);
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
  }, [rfId]);

  // TOTALI
  const totEntrate = useMemo(() => {
    return Object.values(entrate).reduce((s: number, v: any) => s + num(v), 0);
  }, [entrate]);

  const totUscite = useMemo(() => {
    return Object.values(uscite).reduce((s: number, v: any) => s + num(v), 0);
  }, [uscite]);

  // AUTOSAVE
  useEffect(() => {
    if (!rfId || loading) return;

    setSaveStatus("saving");
    const t = setTimeout(async () => {
      try {
        await updateRf(rfId, {
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
  }, [rfId, loading, nome, descr, entrate, uscite]);

  // ✅ EXPORT XLSX (non valorizzati => 0)
  const exportXlsx = () => {
    const safeNome = (nome || "RACCOLTA_FONDI").replace(/[\\/:*?"<>|]+/g, "-").trim();
    const fileName = `RF_${safeNome}_${annualitaId ?? ""}.xlsx`;

    const entrateLabels = ["Entrate da raccolte fondi occasionali", "Altre entrate"];
    const usciteLabels = ["Uscite per raccolte fondi occasionali", "Altre uscite"];

    const rows: (string | number)[][] = [];

    rows.push(["ETS-FACILE — Export Raccolta Fondi"]);
    rows.push(["Annualità ID", annualitaId ?? ""]);
    rows.push(["RF ID", rfId ?? ""]);
    rows.push(["Nome raccolta", nome || ""]);
    rows.push(["Descrizione", descr || ""]);
    rows.push([]);

    rows.push(["ENTRATE"]);
    rows.push(["Voce", "Importo (€)"]);
    entrateLabels.forEach((label, i) => rows.push([label, num(entrate?.[i])]));
    rows.push(["Totale entrate", Number(totEntrate.toFixed(2))]);
    rows.push([]);

    rows.push(["USCITE"]);
    rows.push(["Voce", "Importo (€)"]);
    usciteLabels.forEach((label, i) => rows.push([label, num(uscite?.[i])]));
    rows.push(["Totale uscite", Number(totUscite.toFixed(2))]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 45 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RF");

    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button className="iconBtn" onClick={() => nav(`/anno/${annualitaId}`)}>
          ←
        </button>
        <div className="mHeaderText">
          <div className="mTitle">Raccolta fondi</div>
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
                <label>Nome raccolta</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="field">
                <label>Descrizione</label>
                <input value={descr} onChange={(e) => setDescr(e.target.value)} />
              </div>
            </div>

            <details className="acc">
              <summary className="accSum">
                <div className="accLeft">
                  <span className="accChevron">▸</span>
                  <span>ENTRATE</span>
                </div>
                <span className="accTot">{totEntrate.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                {["Entrate da raccolte fondi occasionali", "Altre entrate"].map((label, i) => (
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
                <div className="accLeft">
                  <span className="accChevron">▸</span>
                  <span>USCITE</span>
                </div>
                <span className="accTot">{totUscite.toFixed(2)}€</span>
              </summary>
              <div className="accBody">
                {["Uscite per raccolte fondi occasionali", "Altre uscite"].map((label, i) => (
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

            {/* ✅ PULSANTE EXPORT XLSX (verde) */}
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
                  background: "#16a34a",
                  color: "#fff",
                }}
                onMouseEnter={(e) => ((e.currentTarget.style.background = "#15803d"))}
                onMouseLeave={(e) => ((e.currentTarget.style.background = "#16a34a"))}
              >
                ⬇️ Scarica Excel (.xlsx) — Raccolta fondi
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
