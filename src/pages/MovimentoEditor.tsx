import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Card, PrimaryButton, SecondaryButton, Badge } from "../components/ui";

type Tipologia =
  | "ENTRATA"
  | "USCITA"
  | "AVANZO_CASSA_T_1"
  | "AVANZO_BANCA_T_1";

type Macro =
  | "AIG"
  | "ATTIVITA_DIVERSE"
  | "RACCOLTE_FONDI"
  | "ATTIVITA_FINANZIARIA_PATRIMONIALE"
  | "SUPPORTO_GENERALE"
  | "INVESTIMENTO_DISINVESTIMENTO"
  | "IMPOSTE"
  | "COSTI_GENERALI";

type Conto = "CASSA" | "BANCA";
type Regime = "FORFETTARIO" | "ORDINARIO";

type OptionItem = {
  code: number;
  label: string;
};

type NestedConfig = {
  primary: OptionItem[];
  secondary?: Record<number, string[]>;
  hideSecondary?: boolean;
  textOnlyAfterPrimary?: number[];
};

type AiSuggestion = {
  macro: Macro;
  macroLabel: string;
  descrizioneCode: number | null;
  descrizionePrimaryLabel: string | null;
  descrizioneDettaglio: string | null;
  descrizioneLiberaSuggerita: string | null;
  conto: Conto;
  confidenza: number;
  exactMatch: boolean;
  motivazioneBreve: string;
};

function isValidMoney(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function isValidIva(v: string) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0;
}

function withAltro(items: string[]) {
  const cleaned = items
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  const hasAltro = cleaned.some((x) => x.toLowerCase() === "altro");
  return hasAltro ? cleaned : [...cleaned, "Altro"];
}

function normalizeText(v: string) {
  return String(v || "").trim();
}

function optionExists(options: string[], value: string) {
  const a = normalizeText(value).toLowerCase();
  return options.some((x) => normalizeText(x).toLowerCase() === a);
}

const USCITE_MATERIE_PRIME = withAltro([
  "acquisti di beni",
  "cancelleria e stampati",
  "carburanti e lubrificanti",
  "combustibile per riscaldamento",
  "costi accessori di acquisto di beni se addebitati dal fornitore (trasporti, spese di magazzino, etc)",
  "Imballaggi",
  "indumenti di lavoro",
  "materiale di consumo per manutenzioni e pulizie",
  "materie prime",
  "materie sussidiarie",
  "Semilavorati",
  "Generi alimentari, vestiario, igiene",
  "Medicinali e presidi sanitari (umani e veterinari)",
  "Cibo per animali",
  "Carburante automezzo associativo",
  "Cancelleria",
  "Casalinghi e ferramenta",
  "Materiale di consumo per manutenzioni e pulizia",
  "Dispositivi di protezione individuale",
  "Attrezzature e macchinari di costo inferiore a € 517",
  "indumenti da lavoro, divise",
]);

const USCITE_SERVIZI = withAltro([
  "Aggiornamento e formazione",
  "Altri servizi resi da banche ed imprese finanziarie non collegati ad operazioni di finanziamento",
  "Assicurazioni varie",
  "Canoni di assistenza tecnica",
  "Commissioni per servizi di pagamento",
  "Compensi ai componenti dell’organo di controllo ed ai revisori legali",
  "Compenso all’organo amministrativo",
  "Compensi per collaborazioni coordinate e continuative",
  "Consulenze",
  "Costi per custodia di titoli",
  "Costi per il personale distaccato presso l’ente e dipendenti da altri enti",
  "Costi per mensa (se gestita da terzi)",
  "Energia elettrice, acqua, gas, telefono",
  "Indennità di fine rapporto connesse a co.co.co.",
  "Indennità chilometriche",
  "Lavanderia indumenti da lavoro",
  "Lavorazioni esterne",
  "Noleggio di cassette di sicurezza",
  "Pubblicità e promozione",
  "Rimborsi spese a piè di lista",
  "Servizi di manutenzione (attrezzature e mobili etc)",
  "Servizi di pulizia",
  "Servizi di smaltimento rifiuti",
  "Servizi di vigilanza",
  "Servizi di elaborazione dati",
  "Spese di rappresentanza",
  "Spese di ricerca, addestramento e formazione",
  "Spese di vitto ed alloggio a titolo di spesa di trasferta",
  "Spese legali e consulenze",
  "Spese per analisi e prove di laboratorio",
  "Spese postali",
  "Trasporti nel casi in cui gli stessi siano inclusi dal fornitore del bene nel prezzo di acquisto",
  "Viaggi e trasferte (biglietti aereo, treno, taxi, etc)",
  "Utenze telefoniche, elettriche, idriche, gas",
  "Spese Condominio",
  "Pedaggio autostradale per automezzo associativo",
  "Manutenzioni, riparazioni e servizi di pulizia",
  "Canoni assistenza tecnica",
  "Servizi tipografici e di elaborazione grafica",
  "Assicurazioni varie (diverse dalla polizza del volontariato)",
  "Spese postali e di spedizione",
  "Spese accensione fidejussione",
  "Polizza assicurazione copertura RC infortunio e malattia",
  "Lavoro autonomo e occasionale Costo lordo (comprensivo di ritenuta d’acconto, IRAP)",
  "Contratti collaborazione occasionale",
  "Parcelle liberi professionisti",
  "Canone sito web, PEC, firma digitale, licenze software",
]);

const USCITE_GODIMENTO_TERZI = withAltro([
  "Affitti e locazioni",
  "Canoni corrisposti per usufrutto, enfiteusi e diritto di superficie",
  "Diritto d’autore",
  "Leasing finanziario",
  "Leasing operativo",
  "Noleggio attrezzature, impianti, macchinari, autoveicoli, etc.",
  "Oneri accessori agli affitti (spese condominiali, imposta di registro)",
  "Royalties",
  "Utilizzo brevetti",
  "Affitto sede",
  "Noleggio sale e attrezzature",
  "Leasing",
  "Diritti per utilizzo di opere dell’ingegno, diritti d’autore, licenze e marchi (SIAE)",
]);

const USCITE_PERSONALE = withAltro([
  "Retribuzione in denaro",
  "Retribuzione in natura",
  "Premi ed altri elementi simili",
  "Oneri previdenziali a carico dell’ente",
  "Oneri assistenziali a carico dell’ente (es. inail)",
  "Trattamento di fine rapporto",
  "Trattamento di quiescenza e simili",
  "Transazioni con i dipendenti",
  "Servizio sanitario",
  "Quote associative a favore dei dipendenti",
  "Sussidi occasionali (matrimoni, nascite, funerali)",
  "Borse di studio a favore dei dipendenti e loro familiari",
  "Omaggi a dipendenti",
  "Incentivi all’esodo",
]);

const USCITE_DIVERSE_GESTIONE = withAltro([
  "Imposte e tasse relative al reddito imponibile dell’esercizio",
  "Imposte sostitutive",
  "Imposte di bollo",
  "Tributi locali",
  "Imposta di registro",
  "Imposte ipotecarie e catastali",
  "Tassa di concessione governativa",
  "Tesse di circolazione",
  "Tassa sui rifiuti",
  "Altre imposte e tasse",
  "Contributi ad associazioni sindacali di categoria",
  "Abbonamenti a riviste e giornali",
  "Costi per la mensa gestita interamente",
  "Sopravvenienze passive",
  "Liberalità omaggi ed articoli promozionali",
  "Spese per deposito e pubblicazione di bilanci, verbali assemblee, etc",
  "Oneri per multe, ammende e sanzioni",
  "Borse di studio e premi",
  "Quote associative a federazioni, affiliazioni",
  "Abbonamenti a giornali e riviste",
  "Omaggi e spese di rappresentanza",
  "Imposte e tasse",
  "Multe e ammende",
  "Rimborso spese Volontari",
  "Vitto",
  "Alloggio",
  "Trasporti",
  "rimborso chilometrico auto propria",
  "Erogazione di denaro a sostegno di persone svantaggiate",
  "Erogazione di denaro a ETS che svolgono attività a sostegno di persone svantaggiate",
  "Acquisto beni e servizi da donare",
]);

const USCITE_AIG_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci" },
    { code: 2, label: "Servizi" },
    { code: 3, label: "Godimento beni di terzi" },
    { code: 4, label: "Personale" },
    { code: 5, label: "Uscite diverse di gestione" },
    { code: 99, label: "Altro" },
  ],
  secondary: {
    1: USCITE_MATERIE_PRIME,
    2: USCITE_SERVIZI,
    3: USCITE_GODIMENTO_TERZI,
    4: USCITE_PERSONALE,
    5: USCITE_DIVERSE_GESTIONE,
    99: withAltro([]),
  },
};

const USCITE_AD_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci" },
    { code: 2, label: "Servizi" },
    { code: 3, label: "Godimento beni di terzi" },
    { code: 4, label: "Personale" },
    { code: 5, label: "Uscite diverse di gestione" },
    { code: 99, label: "Altro" },
  ],
  secondary: {
    1: USCITE_MATERIE_PRIME,
    2: USCITE_SERVIZI,
    3: USCITE_GODIMENTO_TERZI,
    4: USCITE_PERSONALE,
    5: USCITE_DIVERSE_GESTIONE,
    99: withAltro([]),
  },
};

const USCITE_RF_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Uscite per raccolte fondi abituali" },
    { code: 2, label: "Uscite per raccolte fondi occasionali" },
    { code: 3, label: "Altre uscite" },
    { code: 99, label: "Altro" },
  ],
  hideSecondary: true,
};

const USCITE_AFP_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Su rapporti bancari" },
    { code: 2, label: "Su investimenti finanziari" },
    { code: 3, label: "Su patrimonio edilizio" },
    { code: 4, label: "Su altri beni patrimoniali" },
    { code: 5, label: "Altre uscite" },
    { code: 99, label: "Altro" },
  ],
  secondary: {
    1: withAltro([
      "costi fissi bancari o postali",
      "Commissioni bancarie o postali",
      "interessi passivi",
      "imposte",
    ]),
    2: withAltro([
      "Interessi su finanziamenti ottenuti da banche ed altri istituti di credito",
      "Commissioni passive su finanziamenti",
      "Interessi passivi su dilazioni ottenute da fornitori ed interessi di mora",
    ]),
    3: withAltro([
      "Manutenzioni straordinarie sul patrimonio edilizio",
      "IMU",
      "Spese condominiali",
    ]),
    4: withAltro([]),
    5: withAltro([]),
    99: withAltro([]),
  },
};

const USCITE_SUPPORTO_GENERALE_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci" },
    { code: 2, label: "Servizi" },
    { code: 3, label: "Godimento beni di terzi" },
    { code: 4, label: "Personale" },
    { code: 5, label: "Altre uscite" },
    { code: 99, label: "Altro" },
  ],
  hideSecondary: true,
};

const USCITE_INVESTIMENTI_CONFIG: NestedConfig = {
  primary: [
    {
      code: 1,
      label: "Investimenti in immobilizzazioni inerenti alle attività di interesse generale",
    },
    {
      code: 2,
      label: "Investimenti in immobilizzazioni inerenti alle attività diverse",
    },
    { code: 3, label: "Investimenti in attività finanziarie e patrimoniali" },
    { code: 4, label: "Rimborso di finanziamenti per quota capitale e di prestiti" },
    { code: 99, label: "Altro" },
  ],
  secondary: {
    1: withAltro(["Acquisto beni strumentali di valore superiore 516 euro"]),
    2: withAltro(["Acquisto beni strumentali di valore superiore 516 euro"]),
    3: withAltro(["Immobili ad uso investimento", "Titoli, azioni"]),
    4: withAltro(["Quota capitale mutuo"]),
    99: withAltro([]),
  },
};

const ENTRATE_AIG_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Entrate da quote associative e apporti dei fondatori" },
    { code: 2, label: "Entrate dagli associati per attività mutuali" },
    {
      code: 3,
      label: "Entrate per prestazioni e cessioni ad associati e fondatori",
    },
    { code: 4, label: "Erogazioni liberali" },
    { code: 5, label: "Entrate del 5 per mille" },
    { code: 6, label: "Contributi da soggetti privati" },
    { code: 7, label: "Entrate per prestazioni e cessioni a terzi" },
    { code: 8, label: "Contributi da enti pubblici" },
    { code: 9, label: "Entrate da contratti con enti pubblici" },
    { code: 10, label: "Altre entrate" },
    { code: 99, label: "Altro" },
  ],
  hideSecondary: true,
};

const ENTRATE_AD_CONFIG: NestedConfig = {
  primary: [
    {
      code: 1,
      label: "Entrate per prestazioni e cessioni ad associati e fondatori",
    },
    { code: 2, label: "Contributi da soggetti privati" },
    {
      code: 3,
      label: "Entrate per prestazioni e cessioni a terzi (sponsorizzazioni)",
    },
    { code: 4, label: "Contributi da enti pubblici" },
    { code: 5, label: "Entrate da contratti con enti pubblici" },
    { code: 6, label: "Altre entrate" },
    { code: 99, label: "Altro" },
  ],
  hideSecondary: true,
};

const ENTRATE_RF_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Entrate da raccolte fondi abituali" },
    { code: 2, label: "Entrate da raccolte fondi occasionali" },
    { code: 3, label: "Altre entrate" },
    { code: 99, label: "Altro" },
  ],
  hideSecondary: true,
};

const ENTRATE_AFP_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Da rapporti bancari" },
    { code: 2, label: "Da altri investimenti finanziari" },
    { code: 3, label: "Da patrimonio edilizio" },
    { code: 4, label: "Da altri beni patrimoniali" },
    { code: 5, label: "Altre entrate" },
    { code: 99, label: "Altro" },
  ],
  secondary: {
    1: withAltro(["Interessi attivi"]),
    2: withAltro(["Interessi attivi"]),
    3: withAltro(["Affitti attivi"]),
    4: withAltro([]),
    5: withAltro([]),
    99: withAltro([]),
  },
};

const ENTRATE_SUPPORTO_GENERALE_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Entrate da distacco del personale" },
    { code: 2, label: "Altre entrate di supporto generale" },
    { code: 99, label: "Altro" },
  ],
  hideSecondary: true,
};

const ENTRATE_INVESTIMENTI_CONFIG: NestedConfig = {
  primary: [
    {
      code: 1,
      label: "Disinvestimenti di immobilizzazioni inerenti alle attività di interesse generale",
    },
    {
      code: 2,
      label: "Disinvestimenti di immobilizzazioni inerenti alle attività diverse",
    },
    { code: 3, label: "Disinvestimenti di attività finanziarie e patrimoniali" },
    { code: 4, label: "Ricevimento di finanziamenti e di prestiti" },
    { code: 99, label: "Altro" },
  ],
  hideSecondary: true,
};

const USCITE_COSTI_GENERALI_CONFIG: NestedConfig = {
  primary: [
    { code: 1, label: "Materie prime, sussidiarie, di consumo e di merci" },
    { code: 2, label: "Servizi" },
    { code: 3, label: "Godimento beni di terzi" },
    { code: 4, label: "Personale" },
    { code: 5, label: "Altre uscite" },
    { code: 99, label: "Altro" },
  ],
  hideSecondary: true,
};

function getConfig(tipologia: Tipologia | "", macro: Macro | ""): NestedConfig | null {
  if (tipologia === "USCITA" && macro === "AIG") return USCITE_AIG_CONFIG;
  if (tipologia === "USCITA" && macro === "ATTIVITA_DIVERSE") return USCITE_AD_CONFIG;
  if (tipologia === "USCITA" && macro === "RACCOLTE_FONDI") return USCITE_RF_CONFIG;
  if (tipologia === "USCITA" && macro === "ATTIVITA_FINANZIARIA_PATRIMONIALE")
    return USCITE_AFP_CONFIG;
  if (tipologia === "USCITA" && macro === "SUPPORTO_GENERALE")
    return USCITE_SUPPORTO_GENERALE_CONFIG;
  if (tipologia === "USCITA" && macro === "INVESTIMENTO_DISINVESTIMENTO")
    return USCITE_INVESTIMENTI_CONFIG;
  if (tipologia === "USCITA" && macro === "COSTI_GENERALI")
    return USCITE_COSTI_GENERALI_CONFIG;

  if (tipologia === "ENTRATA" && macro === "AIG") return ENTRATE_AIG_CONFIG;
  if (tipologia === "ENTRATA" && macro === "ATTIVITA_DIVERSE") return ENTRATE_AD_CONFIG;
  if (tipologia === "ENTRATA" && macro === "RACCOLTE_FONDI") return ENTRATE_RF_CONFIG;
  if (tipologia === "ENTRATA" && macro === "ATTIVITA_FINANZIARIA_PATRIMONIALE")
    return ENTRATE_AFP_CONFIG;
  if (tipologia === "ENTRATA" && macro === "SUPPORTO_GENERALE")
    return ENTRATE_SUPPORTO_GENERALE_CONFIG;
  if (tipologia === "ENTRATA" && macro === "INVESTIMENTO_DISINVESTIMENTO")
    return ENTRATE_INVESTIMENTI_CONFIG;

  return null;
}

export default function MovimentoEditor() {
  const annualitaId = localStorage.getItem("annualita_id");
  const editId = localStorage.getItem("movimento_edit_id");
  const presetTipologia =
    (localStorage.getItem("movimento_tipologia") as Tipologia) || "";

  const [loading, setLoading] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  const [tipologia, setTipologia] = useState<Tipologia | "">(presetTipologia);
  const [data, setData] = useState("");
  const [macro, setMacro] = useState<Macro | "">("");
  const [conto, setConto] = useState<Conto>("CASSA");

  const [descrizioneCode, setDescrizioneCode] = useState<number | null>(null);
  const [descrizioneLabel, setDescrizioneLabel] = useState("");
  const [descrizioneDettaglio, setDescrizioneDettaglio] = useState("");
  const [descrizioneLibera, setDescrizioneLibera] = useState("");

  const [importo, setImporto] = useState("");
  const [iva, setIva] = useState("0");
  const [regime, setRegime] = useState<Regime>("ORDINARIO");

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  const isEntrataOrUscita = tipologia === "ENTRATA" || tipologia === "USCITA";
  const isAvanzo =
    tipologia === "AVANZO_CASSA_T_1" || tipologia === "AVANZO_BANCA_T_1";
  const isRegimeOrdinario = regime === "ORDINARIO";
  const showIvaField = isEntrataOrUscita && isRegimeOrdinario;

  const config = useMemo(() => getConfig(tipologia, macro), [tipologia, macro]);

  const primaryOptions = useMemo(() => config?.primary ?? [], [config]);

  const selectedPrimary = useMemo(
    () => primaryOptions.find((x) => x.code === descrizioneCode) || null,
    [primaryOptions, descrizioneCode]
  );

  const secondaryOptions = useMemo(() => {
    if (!config?.secondary || !descrizioneCode) return [];
    return withAltro(config.secondary[descrizioneCode] || []);
  }, [config, descrizioneCode]);

  const showStepAfterCategoria = isEntrataOrUscita && !!macro;
  const isImposteTextOnly = tipologia === "USCITA" && macro === "IMPOSTE";

  const showDescrizioneCodificata =
    showStepAfterCategoria && !isImposteTextOnly && primaryOptions.length > 0;

  const showDettaglioDescrizione =
    showDescrizioneCodificata &&
    !!descrizioneCode &&
    !config?.hideSecondary &&
    secondaryOptions.length > 0;

  const showDescrizionePersonale =
    showStepAfterCategoria && (isImposteTextOnly || !!descrizioneCode);

  const showAiBox = tipologia === "ENTRATA" || tipologia === "USCITA";

  useEffect(() => {
    const loadRegime = async () => {
      const ls = localStorage.getItem("annualita_regime") as Regime | null;
      if (ls === "FORFETTARIO" || ls === "ORDINARIO") {
        setRegime(ls);
        return;
      }

      if (!annualitaId) return;

      const { data, error } = await supabase
        .from("annualita")
        .select("regime")
        .eq("id", annualitaId)
        .single();

      if (
        !error &&
        (data?.regime === "FORFETTARIO" || data?.regime === "ORDINARIO")
      ) {
        setRegime(data.regime);
        localStorage.setItem("annualita_regime", data.regime);
      }
    };

    loadRegime();
  }, [annualitaId]);

  useEffect(() => {
    if (!showIvaField) setIva("0");
  }, [showIvaField]);

  useEffect(() => {
    if (!editId) return;

    const load = async () => {
      const { data: row, error } = await supabase
        .from("movimenti")
        .select("*")
        .eq("id", editId)
        .single();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setTipologia(row.tipologia);
      setData(row.data || "");
      setMacro((row.macro as Macro) || "");
      setConto((row.conto as Conto) || "CASSA");
      setDescrizioneCode(row.descrizione_code ?? null);
      setImporto(String(row.importo ?? ""));
      setIva(String(row.iva ?? 0));

      const fullLabel = String(row.descrizione_label ?? "");
      setDescrizioneLabel(fullLabel);

      const parts = fullLabel
        .split(" | ")
        .map((x) => x.trim())
        .filter(Boolean);

      if (parts.length >= 2) {
        setDescrizioneDettaglio(parts[1]);
      } else {
        setDescrizioneDettaglio("");
      }

      if (parts.length >= 3) {
        setDescrizioneLibera(parts.slice(2).join(" | "));
      } else if (parts.length === 2 && config?.hideSecondary) {
        setDescrizioneLibera(parts[1]);
      } else {
        setDescrizioneLibera(row.descrizione_libera || "");
      }

      setLoading(false);
    };

    load();
  }, [editId, config?.hideSecondary]);

  useEffect(() => {
    if (editId) return;
    setData("");
    setMacro("");
    setConto("CASSA");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setDescrizioneDettaglio("");
    setDescrizioneLibera("");
    setImporto("");
    setIva("0");
    setAiSuggestion(null);
    setAiError(null);
    setAiInput("");
  }, [tipologia, editId]);

  useEffect(() => {
    if (editId) return;
    setConto("CASSA");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setDescrizioneDettaglio("");
    setDescrizioneLibera("");
    setImporto("");
    setIva("0");
  }, [macro, editId]);

  useEffect(() => {
    if (editId) return;
    setDescrizioneDettaglio("");
    setDescrizioneLibera("");
  }, [descrizioneCode, editId]);

  useEffect(() => {
    if (isAvanzo) {
      setDescrizioneLabel("");
      return;
    }

    if (isImposteTextOnly) {
      setDescrizioneLabel(normalizeText(descrizioneLibera));
      return;
    }

    if (!selectedPrimary) {
      setDescrizioneLabel("");
      return;
    }

    let label = selectedPrimary.label;

    if (normalizeText(descrizioneDettaglio)) {
      label += ` | ${normalizeText(descrizioneDettaglio)}`;
    }

    if (normalizeText(descrizioneLibera)) {
      label += ` | ${normalizeText(descrizioneLibera)}`;
    }

    setDescrizioneLabel(label);
  }, [
    isAvanzo,
    isImposteTextOnly,
    selectedPrimary,
    descrizioneDettaglio,
    descrizioneLibera,
  ]);

  const chiediAiClassificazione = async () => {
    setAiError(null);
    setAiSuggestion(null);

    if (!(tipologia === "ENTRATA" || tipologia === "USCITA")) {
      setAiError("Prima seleziona Entrata o Uscita");
      return;
    }

    if (!normalizeText(aiInput)) {
      setAiError("Scrivi una descrizione dell'operazione");
      return;
    }

    try {
      setAiLoading(true);

      const response = await fetch("/api/ai-classify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipologia,
          text: aiInput,
          macroAttuale: macro || null,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || "Errore AI");
      }

      setAiSuggestion(json as AiSuggestion);
    } catch (err: any) {
      setAiError(err?.message || "Errore nella richiesta AI");
    } finally {
      setAiLoading(false);
    }
  };

  const applicaSuggerimentoAi = () => {
    if (!aiSuggestion) return;

    setMacro(aiSuggestion.macro);
    setConto(aiSuggestion.conto || "BANCA");

    if (aiSuggestion.macro === "IMPOSTE") {
      setDescrizioneCode(null);
      setDescrizioneDettaglio("");
      setDescrizioneLibera(aiSuggestion.descrizioneLiberaSuggerita || aiInput);
      return;
    }

    setDescrizioneCode(aiSuggestion.descrizioneCode ?? null);
    setDescrizioneDettaglio(aiSuggestion.descrizioneDettaglio || "");
    setDescrizioneLibera(aiSuggestion.descrizioneLiberaSuggerita || aiInput);
  };

  const salva = async () => {
    setError(null);

    if (!annualitaId) {
      setError("Annualità non selezionata");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("Utente non autenticato");
      return;
    }

    if (!tipologia) {
      setError("Seleziona la tipologia");
      return;
    }

    if (showIvaField && !isValidIva(iva)) {
      setError("IVA non valida");
      return;
    }

    if (!isAvanzo) {
      if (!data || !macro || !isValidMoney(importo)) {
        setError("Compila tutti i campi obbligatori");
        return;
      }

      if (isImposteTextOnly) {
        if (!normalizeText(descrizioneLibera)) {
          setError("Inserisci la descrizione personale");
          return;
        }
      } else {
        if (!descrizioneCode) {
          setError("Seleziona la descrizione codificata");
          return;
        }

        if (showDettaglioDescrizione && !normalizeText(descrizioneDettaglio)) {
          setError("Seleziona o scrivi il dettaglio descrizione");
          return;
        }

        if (showDettaglioDescrizione) {
          if (
            secondaryOptions.length > 0 &&
            !optionExists(secondaryOptions, descrizioneDettaglio)
          ) {
            // consentiamo testo libero nel dettaglio
          }
        }

        if (!normalizeText(descrizioneLibera)) {
          setError("Inserisci la descrizione personale");
          return;
        }
      }
    } else {
      if (!isValidMoney(importo)) {
        setError("Importo non valido");
        return;
      }
    }

    const payload: any = {
      user_id: userData.user.id,
      annualita_id: annualitaId,
      tipologia,
      data: isAvanzo ? null : data || null,
      macro: isAvanzo ? null : macro || null,
      conto: isAvanzo
        ? tipologia === "AVANZO_CASSA_T_1"
          ? "CASSA"
          : "BANCA"
        : conto,
      descrizione_code:
        isAvanzo || isImposteTextOnly ? null : descrizioneCode,
      descrizione_label: isAvanzo ? null : descrizioneLabel || null,
      descrizione_libera: isAvanzo
        ? null
        : normalizeText(descrizioneLibera) || null,
      importo: Number(importo),
      iva: showIvaField ? Number(iva || 0) : 0,
      is_costo_generale:
        macro === "COSTI_GENERALI" || macro === "SUPPORTO_GENERALE",
    };

    const q = editId
      ? supabase.from("movimenti").update(payload).eq("id", editId)
      : supabase.from("movimenti").insert(payload);

    const { error } = await q;

    if (error) {
      setError(error.message);
      return;
    }

    localStorage.removeItem("movimento_edit_id");
    localStorage.removeItem("movimento_tipologia");
    history.back();
  };

  if (loading) {
    return (
      <Layout>
        <div>Caricamento…</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pageHeader" style={{ paddingTop: 15 }}>
        <div>
          <h2 className="pageTitle">
            {editId ? "Modifica movimento" : "Nuovo Movimento"}
          </h2>
          <div className="pageHelp">
            All’inizio sono visibili solo tipologia, data e categoria. Gli altri
            campi compaiono dopo la scelta della categoria.
          </div>
        </div>
      </div>

      <Card title="1️⃣ Tipologia">
        <select
          value={tipologia}
          onChange={(e) => setTipologia(e.target.value as Tipologia | "")}
          disabled={!!editId}
          className="input"
        >
          <option value="">Seleziona…</option>
          <option value="ENTRATA">Entrata</option>
          <option value="USCITA">Uscita</option>
          <option value="AVANZO_CASSA_T_1">Avanzo cassa t-1</option>
          <option value="AVANZO_BANCA_T_1">Avanzo banca t-1</option>
        </select>
      </Card>

      {showAiBox && (
        <Card title="🤖 Aiuto classificazione con AI">
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            className="input"
            rows={4}
            placeholder={
              tipologia === "ENTRATA"
                ? "Es.: contributo ricevuto da fondazione privata per progetto sociale"
                : "Es.: pagamento fattura commercialista per consulenza annuale ETS"
            }
            style={{ resize: "vertical" }}
          />

          <div className="rowSub" style={{ marginTop: 8 }}>
            L’AI parte dalla tipologia scelta e cerca prima la soluzione già
            presente nello schema; se non la trova, propone la collocazione più
            vicina come farebbe un commercialista ETS.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <PrimaryButton onClick={chiediAiClassificazione} disabled={aiLoading}>
              {aiLoading ? "Analisi in corso..." : "Suggerisci collocazione"}
            </PrimaryButton>

            {aiSuggestion && (
              <SecondaryButton onClick={applicaSuggerimentoAi}>
                Applica suggerimento
              </SecondaryButton>
            )}
          </div>

          {aiError && (
            <div style={{ marginTop: 12 }}>
              <Badge tone="red">Errore AI</Badge>
              <div className="errorText">{aiError}</div>
            </div>
          )}

          {aiSuggestion && (
            <div
              style={{
                marginTop: 14,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <div style={{ marginBottom: 8, fontWeight: 700 }}>Suggerimento AI</div>

              <div style={{ marginBottom: 6 }}>
                <b>Categoria:</b> {aiSuggestion.macroLabel}
              </div>

              {aiSuggestion.descrizionePrimaryLabel && (
                <div style={{ marginBottom: 6 }}>
                  <b>Specifica di categoria:</b> {aiSuggestion.descrizionePrimaryLabel}
                </div>
              )}

              {aiSuggestion.descrizioneDettaglio && (
                <div style={{ marginBottom: 6 }}>
                  <b>Dettaglio della posta:</b> {aiSuggestion.descrizioneDettaglio}
                </div>
              )}

              {aiSuggestion.descrizioneLiberaSuggerita && (
                <div style={{ marginBottom: 6 }}>
                  <b>Descrizione personale suggerita:</b>{" "}
                  {aiSuggestion.descrizioneLiberaSuggerita}
                </div>
              )}

              <div style={{ marginBottom: 6 }}>
                <b>Conto consigliato:</b> {aiSuggestion.conto}
              </div>

              <div style={{ marginBottom: 6 }}>
                <b>Confidenza:</b> {Math.round(aiSuggestion.confidenza)}%
                {aiSuggestion.exactMatch
                  ? " • corrispondenza diretta nello schema"
                  : " • classificazione per analogia prudente"}
              </div>

              <div className="rowSub">{aiSuggestion.motivazioneBreve}</div>

              {aiSuggestion.confidenza < 60 && (
                <div style={{ marginTop: 10 }}>
                  <Badge tone="yellow">Verifica manualmente</Badge>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {isEntrataOrUscita && (
        <>
          <Card title="2️⃣ Data">
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="input"
            />
          </Card>

          <Card title="3️⃣ Categoria">
            <select
              value={macro}
              onChange={(e) => setMacro(e.target.value as Macro | "")}
              className="input"
            >
              <option value="">Seleziona…</option>
              <option value="AIG">AIG</option>
              <option value="ATTIVITA_DIVERSE">Attività Diverse</option>
              <option value="RACCOLTE_FONDI">Raccolte Fondi</option>
              <option value="ATTIVITA_FINANZIARIA_PATRIMONIALE">
                Attività Finanziaria e Patrimoniale
              </option>
              <option value="SUPPORTO_GENERALE">Supporto Generale</option>
              <option value="INVESTIMENTO_DISINVESTIMENTO">
                Investimento e Disinvestimento
              </option>
              {tipologia === "USCITA" && <option value="IMPOSTE">Imposte</option>}
              {tipologia === "USCITA" && (
                <option value="COSTI_GENERALI">Costi Generali</option>
              )}
            </select>
          </Card>
        </>
      )}

      {showDescrizioneCodificata && (
        <Card title="4️⃣ Descrizione codificata">
          <select
            value={descrizioneCode ?? ""}
            onChange={(e) =>
              setDescrizioneCode(e.target.value ? Number(e.target.value) : null)
            }
            className="input"
          >
            <option value="">Seleziona…</option>
            {primaryOptions.map((v) => (
              <option key={v.code} value={v.code}>
                {v.code}. {v.label}
              </option>
            ))}
          </select>
        </Card>
      )}

      {showDettaglioDescrizione && (
        <Card title="5️⃣ Dettaglio descrizione">
          <input
            list="dettaglio-descrizione-list"
            value={descrizioneDettaglio}
            onChange={(e) => setDescrizioneDettaglio(e.target.value)}
            className="input"
            placeholder="Scrivi o cerca tra le voci"
          />
          <datalist id="dettaglio-descrizione-list">
            {secondaryOptions.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>

          <div className="rowSub" style={{ marginTop: 8 }}>
            Puoi iniziare a scrivere per cercare più velocemente oppure inserire
            una voce personalizzata.
          </div>
        </Card>
      )}

      {showDescrizionePersonale && (
        <Card
          title={
            showDettaglioDescrizione
              ? "6️⃣ Descrizione personale"
              : "5️⃣ Descrizione personale"
          }
        >
          <input
            value={descrizioneLibera}
            onChange={(e) => setDescrizioneLibera(e.target.value)}
            className="input"
            placeholder="Inserisci una descrizione aggiuntiva"
          />
        </Card>
      )}

      {showStepAfterCategoria && (
        <Card
          title={
            showDettaglioDescrizione
              ? "7️⃣ Banca / Cassa"
              : showDescrizionePersonale
              ? "6️⃣ Banca / Cassa"
              : "4️⃣ Banca / Cassa"
          }
        >
          <select
            value={conto}
            onChange={(e) => setConto(e.target.value as Conto)}
            className="input"
          >
            <option value="CASSA">Cassa</option>
            <option value="BANCA">Banca</option>
          </select>
        </Card>
      )}

      {tipologia && showStepAfterCategoria && (
        <Card
          title={
            showDettaglioDescrizione
              ? "8️⃣ Importo"
              : showDescrizionePersonale
              ? "7️⃣ Importo"
              : "5️⃣ Importo"
          }
        >
          <input
            type="number"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            className="input"
            placeholder="0,00"
            step="0.01"
            min={0}
          />
        </Card>
      )}

      {showStepAfterCategoria && showIvaField && (
        <Card
          title={
            showDettaglioDescrizione
              ? "9️⃣ IVA (solo regime ordinario)"
              : showDescrizionePersonale
              ? "8️⃣ IVA (solo regime ordinario)"
              : "6️⃣ IVA (solo regime ordinario)"
          }
        >
          <input
            type="number"
            value={iva}
            onChange={(e) => setIva(e.target.value)}
            className="input"
            placeholder="0,00"
            step="0.01"
            min={0}
          />
          <div className="rowSub" style={{ marginTop: 8 }}>
            Inserisci <b>0</b> se l’operazione non prevede IVA.
          </div>
        </Card>
      )}

      {error && (
        <div style={{ marginTop: 14, marginBottom: 10 }}>
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      <div className="formActions">
        <PrimaryButton onClick={salva}>
          {editId ? "Salva modifiche" : "Salva"}
        </PrimaryButton>
        <SecondaryButton onClick={() => history.back()}>
          Annulla
        </SecondaryButton>
      </div>
    </Layout>
  );
}
