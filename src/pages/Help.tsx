import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function Help() {
    const nav = useNavigate();

  const [numPages, setNumPages] = useState(0);
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
                      </button>button>
              
                      <div className="mHeaderText">
                                <div className="mTitle">Help</div>div>
                                <div className="mSubtitle">Guida alla consultazione</div>div>
                      </div>div>
              
                      <div className="mHeaderRight" />
              </header>header>
        
              <main className="mContent">
                      <div className="cardBlock">
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                            <div style={{ fontWeight: 600 }}>
                                              {numPages ? `Documento: ${numPages} pagine` : "Caricamento…"}
                                            </div>div>
                                
                                            <a
                                                            className="iconBtn"
                                                            href="/circolare.pdf"
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
                                            </a>a>
                                </div>div>
                      
                                <div style={{ overflow: "auto", borderRadius: 12 }}>
                                            <Document
                                                            file="/circolare.pdf"
                                                            loading={<div style={{ padding: 12 }}>Caricamento PDF…</div>div>}
                                                          error={<div style={{ padding: 12 }}>Errore nel caricamento del PDF.</div>div>}
                                                          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                                        >
                                              {Array.from(new Array(numPages), (_el, index) => (
                                                                              <div key={`p_${index + 1}`} style={{ marginBottom: 12 }}>
                                                                                                <Page
                                                                                                                      pageNumber={index + 1}
                                                                                                                      width={width}
                                                                                                                      renderAnnotationLayer={false}
                                                                                                                      renderTextLayer
                                                                                                                    />
                                                                              </div>div>
                                                                            ))}
                                            </Document>Document>
                                </div>div>
                      </div>div>
              </main>main>
        </div>div>
      );
}
</div>
