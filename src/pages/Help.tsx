import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import helpIndex from "../help/circolare_index.json";

type Chunk = {
  id: number;
  page: number;
  text: string;
};

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function highlight(text: string, terms: string[]) {
  if (!terms.length) return text;

  const escaped = terms
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);

  if (!escaped.length) return text;

  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.replace(re, "⟦$1⟧");
}

function scoreChunk(chunkText: string, query: string) {
  const t = norm(chunkText);
  const q = norm(query);
  if (!q) return 0;

  const terms = q.split(" ").filter((w) => w.length >= 3);
  if (!terms.length) return 0;

  let score = 0;

  for (const term of terms) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = t.match(re);
    score += (matches ? matches.length : 0) * 10;

    const idx = t.indexOf(term);
    if (idx >= 0) score += Math.max(0, 40 - Math.floor(idx / 50));
  }

  if (t.includes(q)) score += 60;
  return score;
}

function makeSnippet(fullText: string, query: string, maxLen = 450) {
  const t = fullText || "";
  const q = norm(query);
  if (!q) return t.slice(0, maxLen);

  const idx = norm(t).indexOf(q);
  if (idx < 0) return t.slice(0, maxLen);

  const start = Math.max(0, idx - 180);
  const end = Math.min(t.length, idx + maxLen - 40);
  return (start > 0 ? "… " : "") + t.slice(start, end) + (end < t.length ? " …" : "");
}

export default function Help() {
  const nav = useNavigate();
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
    if (!query.trim()) return [];
    return (helpIndex as Chunk[])
      .map((c) => ({ ...c, _score: scoreChunk(c.text, query) }))
      .filter((c) => c._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 7);
  }, [query]);

  const terms = useMemo(
    () => norm(query).split(" ").filter((w) => w.length >= 3),
    [query]
  );

  return (
    <div className="mobileShell">
      <header className="mHeader">
        {/* ✅ FRECCIA INDIETRO */}
        <button
          className="iconBtn"
          onClick={() => nav(-1)}
          aria-label="Indietro"
        >
          ←
        </button>

        <div className="mHeaderText">
          <div className="mTitle">Help normativo</div>
          <div className="mSubtitle">
            Risposte tratte dalla Circolare dell’Agenzia delle Entrate n. 1212 del 2026
          </div>
        </div>

        <div className="mHeaderRight" />
      </header>

      <main className="mContent">
        <div className="cardBlock">
          <div className="field">
            <label>Scrivi un dubbio</label>
            <input
              placeholder="Es. le sponsorizzazioni dove vanno"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpenId(null);
              }}
            />
            <div className="hint" style={{ marginTop: 6 }}>
              Ricerca nel testo ufficiale della circolare (nessuna AI).
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
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {results.map((r) => {
          const open = openId === r.id;
          const snippet = highlight(makeSnippet(r.text, query), terms);

          return (
            <div key={r.id} className="cardBlock" style={{ marginTop: 12 }}>
              <div className="muted">Pagina {r.page}</div>

              <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
                {snippet.split("⟦").map((p, i) => {
                  if (i === 0) return <span key={i}>{p}</span>;
                  const [hit, rest] = p.split("⟧");
                  return (
                    <span key={i}>
                      <mark>{hit}</mark>
                      {rest}
                    </span>
                  );
                })}
              </div>

              <button
                className="ghost"
                style={{ marginTop: 8 }}
                onClick={() => setOpenId(open ? null : r.id)}
              >
                {open ? "Mostra meno" : "Mostra tutto"}
              </button>

              {open && (
                <div style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>
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
