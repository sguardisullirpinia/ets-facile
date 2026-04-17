import { useState, useMemo } from "react";
import Layout from "../components/Layout";

type Tipologia =
  | "ENTRATA"
  | "USCITA"
  | "AVANZO_CASSA_T_1"
  | "AVANZO_BANCA_T_1";

type Macro =
  | "AIG"
  | "ATTIVITA_DIVERSE"
  | "RACCOLTE_FONDI"
  | "SUPPORTO_GENERALE"
  | "ATTIVITA_FINANZIARIA_PATRIMONIALE"
  | "INVESTIMENTO_DISINVESTIMENTO";

type Conto = "CASSA" | "BANCA";

type EntryOption = {
  code: number;
  label: string;
  help: string;
};

/* =========================
   ENTRATE AIG
========================= */

const ENTRATE_AIG_OPTIONS: EntryOption[] = [
  {
    code: 2,
    label: "Entrate dagli associati per attività mutuali",
    help: "Fondi mutuali tra soci per erogare sussidi. Non per ODV.",
  },
  {
    code: 3,
    label: "Prestazioni e cessioni ad associati",
    help: "Servizi rivolti ai soci (tipico APS).",
  },
  {
    code: 401,
    label: "Erogazioni liberali",
    help: "Donazioni libere senza vincoli.",
  },
  {
    code: 402,
    label: "Erogazioni liberali vincolate",
    help: "Donazioni con vincoli di utilizzo.",
  },
  {
    code: 403,
    label: "Erogazioni liberali condizionate",
    help: "Donazioni legate a condizioni future.",
  },
  {
    code: 5,
    label: "Entrate del 5 per mille",
    help: "Contributi per attività istituzionali.",
  },
  {
    code: 6,
    label: "Contributi da soggetti privati",
    help: "Fondazioni, imprese, enti privati.",
  },
  {
    code: 7,
    label: "Prestazioni a terzi",
    help: "Servizi verso soggetti esterni.",
  },
  {
    code: 8,
    label: "Contributi da enti pubblici",
    help: "Contributi senza obbligo di prestazione.",
  },
  {
    code: 9,
    label: "Contratti con enti pubblici",
    help: "Convenzioni con corrispettivo.",
  },
  {
    code: 10,
    label: "Altre entrate",
    help: "Entrate residuali.",
  },
];

/* =========================
   COMPONENT
========================= */

export default function MovimentoEditor() {
  const [tipologia, setTipologia] = useState<Tipologia | "">("");
  const [macro, setMacro] = useState<Macro | "">("");
  const [data, setData] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [importo, setImporto] = useState("");
  const [conto, setConto] = useState<Conto>("CASSA");

  const options = useMemo(() => {
    if (tipologia === "ENTRATA" && macro === "AIG") {
      return ENTRATE_AIG_OPTIONS;
    }
    return [];
  }, [tipologia, macro]);

  const match = options.find(
    (o) => o.label.toLowerCase() === descrizione.toLowerCase()
  );

  const salva = () => {
    const payload = {
      tipologia,
      macro,
      data,
      importo: Number(importo),
      conto,
      descrizione_originale: descrizione,
      descrizione_code: match ? match.code : null,
      stato: match ? "auto_classificato" : "da_verificare",
    };

    console.log("SALVATAGGIO:", payload);
    alert("Salvato (vedi console)");
  };

  return (
    <Layout>
      <h2>Nuovo movimento</h2>

      <div className="form">

        {/* Tipologia */}
        <select
          value={tipologia}
          onChange={(e) => setTipologia(e.target.value as Tipologia)}
        >
          <option value="">Tipologia</option>
          <option value="ENTRATA">Entrata</option>
          <option value="USCITA">Uscita</option>
          <option value="AVANZO_CASSA_T_1">Avanzo cassa t-1</option>
          <option value="AVANZO_BANCA_T_1">Avanzo banca t-1</option>
        </select>

        {/* Categoria */}
        <select
          value={macro}
          onChange={(e) => setMacro(e.target.value as Macro)}
        >
          <option value="">Categoria</option>
          <option value="AIG">Attività di interesse generale</option>
          <option value="ATTIVITA_DIVERSE">Attività diverse</option>
          <option value="RACCOLTE_FONDI">Raccolte fondi</option>
          <option value="SUPPORTO_GENERALE">Supporto generale</option>
          <option value="ATTIVITA_FINANZIARIA_PATRIMONIALE">
            Attività finanziaria e patrimoniale
          </option>
          <option value="INVESTIMENTO_DISINVESTIMENTO">
            Investimento e disinvestimento
          </option>
        </select>

        {/* Data */}
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
        />

        {/* Descrizione con suggerimenti */}
        <input
          list="suggestions"
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          placeholder="Descrivi l’operazione"
        />

        <datalist id="suggestions">
          {options.map((o) => (
            <option key={o.code} value={o.label} />
          ))}
        </datalist>

        {/* Spiegazione */}
        {match && (
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {match.help}
          </div>
        )}

        {/* Importo */}
        <input
          type="number"
          value={importo}
          onChange={(e) => setImporto(e.target.value)}
          placeholder="Importo"
        />

        {/* Conto */}
        <select value={conto} onChange={(e) => setConto(e.target.value as Conto)}>
          <option value="CASSA">Cassa</option>
          <option value="BANCA">Banca</option>
        </select>

        <button onClick={salva}>Salva</button>
      </div>
    </Layout>
  );
}
