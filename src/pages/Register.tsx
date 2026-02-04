import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Natura = "APS" | "ODV";

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [denominazione, setDenominazione] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [piva, setPiva] = useState("");
  const [sedeLegale, setSedeLegale] = useState("");
  const [natura, setNatura] = useState<Natura>("APS");

  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return setErr(error.message);
    const userId = data.user?.id;
    if (!userId) return setErr("Utente non disponibile. Riprova.");

    const { error: e2 } = await supabase.from("ente_profiles").insert({
      user_id: userId,
      denominazione,
      codice_fiscale: codiceFiscale,
      piva: piva || null,
      sede_legale: sedeLegale,
      natura,
    });

    if (e2) return setErr(e2.message);

    setOk(true);
    setTimeout(() => nav("/login"), 2500);
  };

  return (
    <div className="page">
      <div className="card">
        <h1>Registrazione</h1>

        {ok ? (
          <>
            <div className="success">
              Registrazione completata. Reindirizzamento al login…
            </div>
            <div className="footer">
              <Link to="/login">Vai al login</Link>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={onRegister} className="form">
              <label>Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />

              <label>Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />

              <hr />

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

              {err && <div className="error">{err}</div>}
              <button>Registrati</button>
            </form>

            <div className="footer">
              <Link to="/login">Torna al login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
