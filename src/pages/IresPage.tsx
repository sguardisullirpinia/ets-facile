import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getIresByAnnualitaId, upsertIresByAnnualitaId } from "../lib/db";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampPerc(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function IresPage() {
  const nav = useNavigate();
  const { annualitaId } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [data, setData] = useState<any>({
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

  // LOAD
  useEffect(() => {
    const run = async () => {
      if (!annualitaId) return;
      setLoading(true);
      setErr(null);

      try {
        const row = await getIresByAnnualitaId(annualitaId);
        if (row) {
          setData({
            imponibile: num(row.imponibile),
            aliquota: num(row.aliquota) || 24,
            imposta_lorda: num(row.imposta_lorda),
            imposta_netta: num(row.imposta_netta),
            acconti_versati: num(row.acconti_versati),
            ritenute: num(row.ritenute),
            saldo: num(row.saldo),
            note: row.note ?? "",
          });
        }
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento IRES");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [annualitaId]);

  // CALCOLI LIVE
  const impostaLorda = useMemo(() => {
    return num(data.imponibile) * (clampPerc(data.aliquota) / 100);
  }, [data.imponibile, data.aliquota]);

  const impostaNetta = useMemo(() => {
    // per ora = lorda, poi aggiungiamo crediti/detrazioni se vuoi
    return impostaLorda;
  }, [impostaLorda]);

  const saldo = useMemo(() => {
    return impostaNetta - num(data.acconti_versati) - num(data.ritenute);
  }, [impostaNetta, data.acconti_versati, data.ritenute]);

  // aggiorno i campi calcolati nello state (così li salvo)
  useEffect(() => {
    setData((p: any) => ({
      ...p,
      imposta_lorda: impostaLorda,
      imposta_netta: impostaNetta,
      saldo,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impostaLorda, impostaNetta, saldo]);

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
            {saveStatus === "idle" && "Inserisci dati e calcolo automatico"}
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
            <div className="cardBlock">
              <div className="field">
                <label>Base imponibile (€)</label>
                <input
                  type="number"
                  value={num(data.imponibile)}
                  onChange={(e) =>
                    setData((p: any) => ({ ...p, imponibile: Number(e.target.value || 0) }))
                  }
                />
              </div>

              <div className="field">
                <label>Aliquota (%)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={num(data.aliquota)}
                  onChange={(e) =>
                    setData((p: any) => ({
                      ...p,
                      aliquota: e.target.value === "" ? 0 : Number(e.target.value),
                    }))
                  }
                  onBlur={(e) =>
                    setData((p: any) => ({ ...p, aliquota: clampPerc(e.target.value) }))
                  }
                />
                <div className="hint">Di norma 24%</div>
              </div>

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

              <div className="muted" style={{ marginTop: 8 }}>
                {num(data.saldo) > 0
                  ? "Il saldo è positivo: imposta dovuta."
                  : "Saldo nullo o negativo: a credito o nessun versamento."}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
