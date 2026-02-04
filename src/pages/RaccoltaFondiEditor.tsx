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

        <p className="muted">
          Qui inseriremo: accordion Entrate e Uscite raccolta fondi.
        </p>
      </main>
    </div>
  );
}
