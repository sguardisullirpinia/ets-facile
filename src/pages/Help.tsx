import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function Help() {
  const nav = useNavigate();

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState<number>(360);

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
            <button
              className="iconBtn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Pagina precedente"
              disabled={page <= 1}
            >
              ◀
            </button>

            <div style={{ fontWeight: 600 }}>
              Pagina {page} / {numPages || "…"}
            </div>

            <button
              className="iconBtn"
              onClick={() => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))}
              aria-label="Pagina successiva"
              disabled={numPages ? page >= numPages : true}
            >
              ▶
            </button>

            <a
              className="iconBtn"
              href="/CIRCOLARE_AdE_CODICE_TERZO_SETTORE.pdf"
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
            file={{
              url: "/CIRCOLARE_AdE_CODICE_TERZO_SETTORE.pdf",
              withCredentials: false,
            }}
            >
              <Page
                pageNumber={page}
                width={width}
                renderAnnotationLayer={false}
                renderTextLayer
              />
            </Document>
          </div>
        </div>
      </main>
    </div>
  );
}

