import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_URL = "/circolare.pdf";

// Quante pagine mostrare subito + quante aggiungere ogni volta
const INITIAL_PAGES = 6;
const LOAD_MORE_STEP = 4;

export default function Help() {
  const nav = useNavigate();

  const [numPages, setNumPages] = useState(0);
  const [visiblePages, setVisiblePages] = useState(INITIAL_PAGES);
  const [width, setWidth] = useState<number>(360);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Calcola larghezza per Page (responsive)
  useEffect(() => {
    const calc = () => {
      const container = document.querySelector(".cardBlock") as HTMLElement | null;
      const w = container?.clientWidth ?? window.innerWidth;
      setWidth(Math.min(w - 24, 950));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // Quando conosciamo numPages, assicurati di non superare il massimo
  useEffect(() => {
    if (!numPages) return;
    setVisiblePages((v) => Math.min(Math.max(v, INITIAL_PAGES), numPages));
  }, [numPages]);

  // IntersectionObserver: quando arrivi in fondo carica altre pagine
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        setVisiblePages((v) => {
          if (!numPages) return v + LOAD_MORE_STEP;
          return Math.min(numPages, v + LOAD_MORE_STEP);
        });
      },
      {
        root: null, // viewport
        rootMargin: "600px 0px", // inizia a caricare un po' prima
        threshold: 0,
      }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [numPages]);

  const pagesToRender = useMemo(() => {
    const total = numPages || visiblePages;
    const n = Math.min(visiblePages, total);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [numPages, visiblePages]);

  const allLoaded = numPages > 0 && visiblePages >= numPages;

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button className="iconBtn" onClick={() => nav(-1)} aria-label="Indietro">
          ←
        </button>

        <div className="mHeaderText">
          <div className="mTitle">Help</div>
          <div className="mSubtitle">Guida alla consultazione</div>
        </div>

        <div className="mHeaderRight" />
      </header>

      <main className="mContent">
        <div className="cardBlock">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>
              {numPages
                ? `Pagine caricate: ${Math.min(visiblePages, numPages)} / ${numPages}`
                : "Caricamento…"}
            </div>

            <a
              className="iconBtn"
              href={PDF_URL}
              target="_blank"
              rel="noreferrer"
              style={{
                marginLeft: "auto",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
              title="Apri a schermo intero"
              aria-label="Apri a schermo intero"
            >
              ⤢
            </a>
          </div>

          <div style={{ overflow: "auto", borderRadius: 12 }}>
            <Document
              file={PDF_URL}
              loading={<div style={{ padding: 12 }}>Caricamento PDF…</div>}
              error={<div style={{ padding: 12 }}>Errore nel caricamento del PDF.</div>}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            >
              {pagesToRender.map((p) => (
                <div key={`p_${p}`} style={{ marginBottom: 12 }}>
                  <Page
                    pageNumber={p}
                    width={width}
                    renderAnnotationLayer={false}
                    renderTextLayer
                  />
                </div>
              ))}

              {/* Sentinel: quando entra in viewport, carichiamo altre pagine */}
              <div ref={sentinelRef} style={{ height: 1 }} />

              {!allLoaded && numPages > 0 && (
                <div style={{ padding: 12, opacity: 0.8 }}>
                  Caricamento altre pagine…
                </div>
              )}

              {allLoaded && numPages > 0 && (
                <div style={{ padding: 12, opacity: 0.8 }}>
                  Fine documento.
                </div>
              )}
            </Document>
          </div>
        </div>
      </main>
    </div>
  );
}
