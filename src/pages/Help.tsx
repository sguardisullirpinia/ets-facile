import { useMemo, useState } from "react";
import helpIndex from "../help/circolare_index.json";

type Chunk = {
  id: number;
  page: number;
  text: string;
};

export default function Help() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    return (helpIndex as Chunk[])
      .filter((c) => c.text.toLowerCase().includes(q))
      .slice(0, 5); // max 5 risultati
  }, [query]);

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <div className="mHeaderText">
          <div className="mTitle">Help normativo</div>
          <div className="mSubtitle">
            Risposte tratte dalla Circolare Agenzia delle Entrate
          </div>
        </div>
      </header>

      <main className="mContent">
        <p className="muted">
          Le risposte sono tratte dalla Circolare dell’Agenzia delle Entrate
          sul Codice del Terzo Settore.
        </p>

        <input
          placeholder="Es. come si calcola il test di commercialità"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        {results.map((r) => (
          <div key={r.id} className="cardBlock">
            <div className="muted">Pagina {r.page}</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{r.text}</div>
          </div>
        ))}

        {query && results.length === 0 && (
          <p className="muted">Nessun risultato trovato.</p>
        )}
      </main>
    </div>
  );
}
