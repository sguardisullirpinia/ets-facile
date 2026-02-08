import { useMemo, useState } from "react";
import helpIndex from "../help/circolare_index.json";

type Chunk = {
  id: number;
  page: number;
  text: string;
};

// Normalizza stringa per ricerca semplice
function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Evidenzia parole trovate (semplice)
function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;
  let out = text;

  // per evitare problemi con regex, escapizza
  const escaped = terms
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length); // prima le parole più lunghe

  if (!escaped.length) return text;

  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  out = out.replace(re, "⟦$1⟧"); // segnaposto
  return out;
}

// Calcolo punteggio pertinenza: più occorrenze + bonus se appare presto
function scoreChunk(chunkText: string, query: string) {
  const t = norm(chunkText);
  const q = norm(query);
  if (!q) return 0;

  // split in parole (tolgo parole troppo piccole)
  const terms = q.split(" ").filter((w) => w.length >= 3);
  if (!terms.length) return 0;

  let score = 0;

  for (const term of terms) {
    // conta occorrenze
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = t.match(re);
    const count = matches ? matches.length : 0;
    score += count * 10;

    // bonus se compare presto
    const idx = t.indexOf(term);
    if (idx >= 0) {
      score += Math.max(0, 40 - Math.floor(idx / 50)); // più è vicino all’inizio, più punti
    }
  }

  // bonus se la query intera è presente
  if (t.includes(q)) score += 60;

  return score;
}

// Estrae un “estratto” vicino alla prima occorrenza (se c’è)
function makeSnippet(fullText: string, query: string, maxLen = 450) {
  const t = fullText || "";
  const q = norm(query);
  if (!q) return t.slice(0, maxLen);

  const idx = norm(t).indexOf(q);
  if (idx < 0) {
    return t.slice(0, maxLen);
  }

  // prova a ritagliare attorno all’area trovata
  const start = Math.max(0, idx - 180);
  const end = Math.min(t.length, idx + maxLen - 40);
  const snippet = t.slice(start, end);

  return (start > 0 ? "… " : "") + snippet + (end < t.length ? " …" : "");
}

export default function Help() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const suggested = [
    "Come si calcola il test di commercialità?",
    "Le sponsorizzazioni dove vanno?",
    "Le attività diverse possono essere occasionali?",
    "Differenza tra contributi privati ed erogazioni liberali",
    "Corrispettivi da soci: quando sono esclusi dal test?",
  ];

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    const arr = (helpIndex as Chunk[])
      .map((c) => ({
        ...c,
        _score: scoreChunk(c.text, q),
      }))
      .filter((c) => c._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 7); // max 7 risultati

    return arr;
  }, [query]);

  // parole da evidenziare
  const terms = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    return q.split(" ").filter((w) => w.length >= 3).slice(0, 8);
  }, [query]);

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <div className="mHeaderText">
          <div className="mTitle">Help normativo</div>
          <div className="mSubtitle">
            Risposte tratte dalla Circolare dell’Agenzia delle Entrate n. 1212 del 2026
          </div>
        </div>

        <div className="mHeaderRight" style={{ display: "flex", gap: 8 }}>
          <a
            className="ghost"
            href="/circolare.pdf"
            target="_blank"
            rel="noreferrer"
            style={{ padding: "8px 10px", borderRadius: 10, whiteSpace: "nowrap", textDecoration: "none" }}
          >
            Apri PDF
          </a>
        </div>
      </header>

      <main className="mContent">
        <div className="cardBlock" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Scrivi un dubbio (ricerca nel testo della circolare)</label>
            <input
              placeholder="Es. le sponsorizzazioni dove vanno"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpenId(null);
              }}
            />
            <div className="hint" style={{ marginTop: 8 }}>
              Nota: questo Help non usa AI. Cerca nel testo ufficiale e mostra i passaggi più pertinenti.
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {suggested.map((s) => (
              <button
                key={s}
                className="ghost"
                onClick={() => {
                  setQuery(s);
                  setOpenId(null);
                }}
                style={{ padding: "8px 10px", borderRadius: 999 }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {query.trim() && results.length === 0 && (
          <div className="cardBlock">
            <div className="muted">Nessun risultato trovato.</div>
            <div className="hint" style={{ marginTop: 6 }}>
              Prova a riscrivere con parole diverse (es. “sponsor”, “attività diverse”, “commercialità”, “corrispettivi”).
            </div>
          </div>
        )}

        {results.map((r) => {
          const isOpen = openId === r.id;
          const snippet = makeSnippet(r.text, query);

          // evidenzia sullo snippet
          const marked = highlight(snippet, terms);

          return (
            <div key={r.id} className="cardBlock" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div className="muted">Pagina {r.page}</div>
                <div className="muted">Pertinenza: {r._score}</div>
              </div>

              {/* evidenziazione: sostituiamo ⟦ ⟧ con <mark> */}
              <div style={{ whiteSpace: "pre-wrap", marginTop: 8, lineHeight: 1.5 }}>
                {marked.split("⟦").map((part, i) => {
                  if (i === 0) return <span key={i}>{part}</span>;
                  const [hit, rest] = part.split("⟧");
                  return (
                    <span key={i}>
                      <mark style={{ padding: "0 2px", borderRadius: 4 }}>{hit}</mark>
                      {rest}
                    </span>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  className="ghost"
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                >
                  {isOpen ? "Mostra meno" : "Mostra tutto"}
                </button>

                <a
                  className="ghost"
                  href={`/circolare.pdf#page=${r.page}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  Vai alla pagina
                </a>
              </div>

              {isOpen && (
                <div style={{ whiteSpace: "pre-wrap", marginTop: 10, opacity: 0.95 }}>
                  {r.text}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
