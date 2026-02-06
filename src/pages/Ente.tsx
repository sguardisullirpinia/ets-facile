import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Natura = "APS" | "ODV";

type EnteProfileRow = {
  user_id: string;
  denominazione: string;
  codice_fiscale: string;
  piva: string | null;
  sede_legale: string;
  natura: Natura;
};

export default function Ente() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [denominazione, setDenominazione] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [piva, setPiva] = useState("");
  const [sedeLegale, setSedeLegale] = useState("");
  const [natura, setNatura] = useState<Natura>("APS");

  useEffect(() => {
    const load = async () => {
      setErr(null);
      setOk(null);
      setLoading(true);

      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return nav("/login");

        const { data, error } = await supabase
          .from("ente_profiles")
          .select(
            "user_id, denominazione, codice_fiscale, piva, sede_legale, natura"
          )
          .eq("user_id", u.user.id)
          .single();

        if (error) throw error;

        const p = data as EnteProfileRow;

        setDenominazione(p.denominazione ?? "");
        setCodiceFiscale(p.codice_fiscale ?? "");
        setPiva(p.piva ?? "");
        setSedeLegale(p.sede_legale ?? "");
        setNatura(p.natura ?? "APS");
      } catch (e: any) {
        setErr(e?.message ?? "Errore caricamento profilo ente");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);

    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return nav("/login");

      const { error } = await supabase
        .from("ente_profiles")
        .update({
          denominazione,
          codice_fiscale: codiceFiscale,
          piva: piva || null,
          sede_legale: sedeLegale,
          natura,
        })
        .eq("user_id", u.user.id);

      if (error) throw error;

      setOk("Salvato ✓");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(e?.message ?? "Errore salvataggio");
    }
  };

  return (
    <div className="page">
      <div className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <h1 style={{ margin: 0 }}>Ente</h1>
          <button className="ghost" onClick={() => nav("/dashboard")}>
            ← Dashboard
          </button>
        </div>

        {loading && <p className="muted">Caricamento…</p>}
        {err && <div className="error">{err}</div>}
        {ok && <div className="success">{ok}</div>}

        {!loading && (
          <form onSubmit={onSave} className="form">
            <label>Denominazione</label>
            <input
              value={denominazione}
              onChange={(e) => setDenominazione(e.target.value)}
              required
            />

            <label>Codice fiscale</label>
            <input
              value={codiceFiscale}
              onChange={(e) => setCodiceFiscale(e.target.value)}
              required
            />

            <label>P.IVA (opzionale)</label>
            <input value={piva} onChange={(e) => setPiva(e.target.value)} />

            <label>Sede legale</label>
            <input
              value={sedeLegale}
              onChange={(e) => setSedeLegale(e.target.value)}
              required
            />

            <label>Natura Ente</label>
            <select
              value={natura}
              onChange={(e) => setNatura(e.target.value as Natura)}
              required
            >
              <option value="APS">APS</option>
              <option value="ODV">ODV</option>
            </select>

            <button>Salva modifiche</button>
          </form>
        )}
      </div>
    </div>
  );
}
