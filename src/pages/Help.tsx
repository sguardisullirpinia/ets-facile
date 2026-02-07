import { useNavigate } from "react-router-dom";

export default function Help() {
  const nav = useNavigate();

  return (
    <div className="mobileShell">
      <header className="mHeader">
        <button
          className="iconBtn"
          onClick={() => nav(-1)}
          aria-label="Indietro"
        >
          ←
        </button>

        <div className="mHeaderText">
          <div className="mTitle">Help</div>
          <div className="mSubtitle">Guida alla compilazione</div>
        </div>

        <div className="mHeaderRight" />
      </header>
      <main className="mContent">
  <div className="cardBlock" style={{ height: "100%" }}>
    <iframe
      src="/CIRCOLARE_AdE_CODICE_TERZO_SETTORE.pdf"
      title="Guida ETS-FACILE"
      style={{
        width: "100%",
        height: "75vh",
        border: "none",
        borderRadius: 12,
      }}
    />
  </div>
</main>   
    </div>
  );
}


