import { useNavigate, useParams } from "react-router-dom";

export default function RaccoltaFondiEditor() {
  const nav = useNavigate();
  const { annualitaId, rfId } = useParams();

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button
          className="iconBtn"
          onClick={() => nav(`/anno/${annualitaId}`)}
          aria-label="Indietro"
        >
          ←
        </button>
        <div className="mHeaderText">
          <div className="mTitle">Editor Raccolta fondi</div>
          <div className="mSubtitle">ID: {rfId}</div>
        </div>
        <div className="mHeaderRight" />
      </header>

      <main className="mContent">
        <div className="reportCard">
          <div className="reportTitle">TOTALI (placeholder)</div>
          <div className="reportRow">
            <span>Entrate</span>
            <b>0€</b>
          </div>
          <div className="reportRow">
            <span>Uscite</span>
            <b>0€</b>
          </div>
        </div>

        {/* ENTRATE */}
        <details className="acc">
          <summary className="accSum">
            <span>ENTRATE</span>
            <span className="accTot">0€</span>
          </summary>
          <div className="accBody">
            <p className="muted">Qui inseriremo le voci di Entrata della raccolta fondi.</p>
          </div>
        </details>

        {/* USCITE */}
        <details className="acc">
          <summary className="accSum">
            <span>USCITE</span>
            <span className="accTot">0€</span>
          </summary>
          <div className="accBody">
            <p className="muted">Qui inseriremo le voci di Uscita della raccolta fondi.</p>
          </div>
        </details>
      </main>
    </div>
  );
}
