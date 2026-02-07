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

  // Campi IRES (base, poi li estendiamo quando vuoi)
  const [ires, setIres] = useState<any>({
    imponibile: 0,        // base imponibile
    aliquota: 24,         // %
    imposta_lorda: 0,     // calcolata (imponibile * aliquota)
    acconti_versati: 0,   // acconti
    ritenute: 0,          // eventuali ritenute/crediti
    imposta_netta: 0,     // calcolata
    saldo: 0,             // calcolata (netta - acconti - ritenute)
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

        // se non esiste ancora, rimaniamo con i default
        if (row) {
          setIres((p: any) => ({
            ...p,
            ...row,
            aliquota: Number(row?.aliquota ?? 24),
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

  // CALCOLI LIVE
  const impostaLorda = useMemo(() => {
    return num(ires.imponibile) * (clampPerc(ires.aliquota) / 100);
  }, [ires.imponibile, ires.aliquota]);

  const impostaNetta = useMemo(() => {
    // qui puoi inserire altre detrazioni/crediti quando vuoi
    return impostaLorda;
  }, [impostaLorda]);

  const saldo = useMemo(() => {
    return impostaNetta - num(ires.acconti_versati) - num(ires.ritenute);
  }, [impostaNetta, ires.acconti_versati, ires.ritenute]);

  // Manteniamo i calcolati nello state (così li salviamo in DB)
  useEffect(() => {
    setIres((p: any) => ({
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
        await upsertIresByAnnualitaId(annualitaId, ires);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 900);
      } catch {
        setSaveStatus("error");
      }
    }, 700);

    return () => clearTimeout(t);
  }, [annualitaId, loading, ires]);

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
            {saveStatus === "idle" && "Calcolo e memorizzazione dati IRES"}
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
                  value={num(ires.imponibile)}
                  onChange={(e) => setIres((p: any) => ({ ...p, imponibile: Number(e.target.value || 0) }))}
                />
              </div>

              <div className="field">
                <label>Aliquota IRES (%)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={num(ires.aliquota)}
                  onChange={(e) => setIres((p: any) => ({ ...p, aliquota: e.target.value === "" ? 0 : Number(e.target.value) }))}
                  onBlur={(e) => setIres((p: any) => ({ ...p, aliquota: clampPerc(e.target.value) }))}
                />
                <div className="hint">Valore tipico: 24%</div>
              </div>

              <div className="field">
                <label>Acconti versati (€)</label>
                <input
                  type="number"
                  value={num(ires.acconti_versati)}
                  onChange={(e) => setIres((p: any) => ({ ...p, acconti_versati: Number(e.target.value || 0) }))}
                />
              </div>

              <div className="field">
                <label>Ritenute / crediti (€)</label>
                <input
                  type="number"
                  value={num(ires.ritenute)}
                  onChange={(e) => setIres((p: any) => ({ ...p, ritenute: Number(e.target.value || 0) }))}
                />
              </div>

              <div className="field">
                <label>Note</label>
                <input
                  value={ires.note ?? ""}
                  onChange={(e) => setIres((p: any) => ({ ...p, note: e.target.value }))}
                  placeholder="Annotazioni…"
                />
              </div>
            </div>

            <div className="reportCard">
              <div className="reportTitle">RISULTATO (live)</div>

              <div className="reportRow">
                <span>Imposta lorda</span>
                <b>{num(ires.imposta_lorda).toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Imposta netta</span>
                <b>{num(ires.imposta_netta).toFixed(2)}€</b>
              </div>

              <div className="reportRow">
                <span>Saldo (netta - acconti - ritenute)</span>
                <b>{num(ires.saldo).toFixed(2)}€</b>
              </div>

              <div className={num(ires.saldo) > 0 ? "reportResult bad" : "reportResult ok"}>
                {num(ires.saldo) > 0 ? "IMPOSTA DA VERSARE" : "A CREDITO / ZERO"}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

