import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) return setErr(error.message);
    nav("/dashboard");
  };

  return (
    <div className="page">
      <div className="card">
        <h1>ETS-FACILE</h1>
        <p className="muted">Accedi con email e password</p>

        <form onSubmit={onLogin} className="form">
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

          {err && <div className="error">{err}</div>}

          <button disabled={loading}>
            {loading ? "Accesso..." : "Accedi"}
          </button>
        </form>

        <div className="footer">
          <span>Non sei registrato?</span>{" "}
          <Link to="/register">Registrati</Link>
        </div>
      </div>
    </div>
  );
}
