import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Annualita = { id: string; anno: number };

export default function Dashboard() {
  const nav = useNavigate();
  const [annualita, setAnnualita] = useState<Annualita[]>([]);
  const [anno, setAnno] = useState<number>(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return nav("/login");

    const { data, error } = await supabase
      .from("annualita")
      .select("id, anno")
      .order("anno", { ascending: false });

    if (error) return setErr(error.message);
    setAnnualita((data ?? []) as Annualita[]);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeleteAnnualita = async (id: string, annoDaEliminare: number) => {
    const ok = window.confirm(`Vuoi eliminare l'annualità ${annoDaEliminare}?`);
    if (!ok) return;

    try {
      const { error } = await supabase.from("annualita").delete().eq("id", id);

      if (error) throw error;

      setAnnualita((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e?.message ?? "Errore eliminazione annualità");
    }
  };

  const createAnnualita = async () => {
    setErr(null);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return nav("/login");

    const { error } = await supabase.from("annualita").insert({
      user_id: user.id,
      anno,
      extra: {
        quote_assoc: 0,
        erogazioni: 0,
        cinque_per_mille: 0,
        convenzioni_art56: 0,
        altri_non_commerciali: 0,
      },
    });
    if (error) return setErr(error.message);
    setOpen(false);
    load();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    nav("/login");
  };

  return (
    <div className="wrap">
      <header className="topbar">
        <h2>Dashboard</h2>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="ghost" onClick={() => nav("/help")}>
            Help
          </button>

          <button className="ghost" onClick={logout}>
            Esci
          </button>
        </div>
      </header>

      {err && <div className="error">{err}</div>}

      <div className="grid fullWidth">
        {annualita.map((a) => (
          <div key={a.id} className="tile" style={{ textAlign: "left" }}>
            <div className="tileTitle">{a.anno}</div>
            <div className="muted">Annualità</div>

            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button className="ghost" onClick={() => nav(`/anno/${a.id}`)}>
                Apri
              </button>

              <button
                className="dangerBtn"
                onClick={() => handleDeleteAnnualita(a.id, a.anno)}
              >
                Elimina
              </button>
            </div>
          </div>
        ))}
        {annualita.length === 0 && (
          <p className="muted">
            Nessuna annualità. Clicca “+” per crearne una.
          </p>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setOpen(true)}>
        +
      </button>

      {/* Modal semplice */}
      {open && (
        <div className="modalOverlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Crea annualità</h3>
            <label>Anno</label>
            <input
              type="number"
              value={anno}
              onChange={(e) => setAnno(parseInt(e.target.value || "0", 10))}
            />
            <div className="row">
              <button className="ghost" onClick={() => setOpen(false)}>
                Annulla
              </button>
              <button onClick={createAnnualita}>Crea</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

