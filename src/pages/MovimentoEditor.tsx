import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { supabase } from "../lib/supabase";
import { Badge, Card, PrimaryButton, SecondaryButton } from "../components/ui";

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
};

type AiSuggestion = {
  macro: Macro;
  macroLabel: string;
  descrizioneCode: number | null;
  descrizionePrimaryLabel: string;
  descrizioneDettaglio: string;
  descrizioneLiberaSuggerita: string;
  contoConsigliato: Conto | null;
  confidenza: number;
  exactMatch: boolean;
  motivazioneBreve: string;
};

type SemanticPack = {
  alias?: string[];
  triggerWords?: string[];
  supportWords?: string[];
  contoConsigliato?: Conto | null;
};

type SemanticEntry = {
  tipologia: "ENTRATA" | "USCITA";
  categoria: Macro;
  categoriaLabel: string;
  specificaCode: number | null;
  specificaLabel: string;
  dettaglio: string;
  dettaglioLabel: string;
  alias: string[];
  triggerWords: string[];
  supportWords: string[];
  contoConsigliato: Conto | null;
  searchText: string;

  normalizedTipologia: string;
  normalizedCategoriaLabel: string;
  normalizedSpecificaLabel: string;
  normalizedDettaglioLabel: string;
  normalizedAlias: string[];
  normalizedTriggerWords: string[];
  normalizedSupportWords: string[];
  searchWords: string[];
};

type ScoredSemanticEntry = {
  entry: SemanticEntry;
  score: number;
  reasons: string[];
};

type FunnelGate =
  | "QUOTE_CONTRIBUTI_DONAZIONI"
  | "INCASSI_ATTIVITA_SERVIZI"
  | "RACCOLTE_FONDI_GATE"
  | "BANCA_PATRIMONIO_RENDITE"
  | "FINANZIAMENTI_DISINVESTIMENTI_ALTRO"
  | "BENI_MATERIALI"
  | "SERVIZI_PROFESSIONISTI"
  | "PERSONALE_GATE"
  | "RACCOLTE_FONDI_USCITE"
  | "BANCA_PATRIMONIO_INVESTIMENTI"
  | "IMPOSTE_RIMBORSI_ALTRE_USCITE";

type FunnelContext =
  | "AIG"
  | "ATTIVITA_DIVERSE"
  | "RACCOLTE_FONDI"
  | "SUPPORTO_GENERALE"
  | "FINANZA_PATRIMONIO"
  | "IMPOSTE"
  | "NON_SO";

type FunnelOption<T extends string> = {
  value: T;
  label: string;
  help: string;
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
  const cleaned = items.map((x) => String(x || "").trim()).filter(Boolean);
  const hasAltro = cleaned.some((x) => x.toLowerCase() === "altro");
  return hasAltro ? cleaned : [...cleaned, "Altro"];
}

function normalizeText(v: string) {
  return String(v || "").trim();
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((x) => normalizeText(x)).filter(Boolean)));
}

function semanticEntryKey(entry: SemanticEntry) {
  return [
    entry.tipologia,
    entry.categoria,
    entry.specificaCode ?? "",
    entry.dettaglioLabel,
  ].join("|");
}

/* =========================
   LISTE BASE
========================= */

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

/* =========================
   CONFIG TECNICO
========================= */

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
    { code: 3, label: "Entrate per prestazioni e cessioni ad associati e fondatori" },
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
    { code: 1, label: "Entrate per prestazioni e cessioni ad associati e fondatori" },
    { code: 2, label: "Contributi da soggetti privati" },
    { code: 3, label: "Entrate per prestazioni e cessioni a terzi (sponsorizzazioni)" },
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

const MACRO_LABELS: Record<Macro, string> = {
  AIG: "Attività di interesse generale",
  ATTIVITA_DIVERSE: "Attività diverse",
  RACCOLTE_FONDI: "Raccolte fondi",
  ATTIVITA_FINANZIARIA_PATRIMONIALE: "Attività finanziaria e patrimoniale",
  SUPPORTO_GENERALE: "Supporto generale",
  INVESTIMENTO_DISINVESTIMENTO: "Investimento e disinvestimento",
  IMPOSTE: "Imposte",
  COSTI_GENERALI: "Costi generali",
};

const CONFIG_REGISTRY: Array<{
  tipologia: "ENTRATA" | "USCITA";
  macro: Macro;
  config: NestedConfig;
}> = [
  { tipologia: "USCITA", macro: "AIG", config: USCITE_AIG_CONFIG },
  { tipologia: "USCITA", macro: "ATTIVITA_DIVERSE", config: USCITE_AD_CONFIG },
  { tipologia: "USCITA", macro: "RACCOLTE_FONDI", config: USCITE_RF_CONFIG },
  {
    tipologia: "USCITA",
    macro: "ATTIVITA_FINANZIARIA_PATRIMONIALE",
    config: USCITE_AFP_CONFIG,
  },
  {
    tipologia: "USCITA",
    macro: "SUPPORTO_GENERALE",
    config: USCITE_SUPPORTO_GENERALE_CONFIG,
  },
  {
    tipologia: "USCITA",
    macro: "INVESTIMENTO_DISINVESTIMENTO",
    config: USCITE_INVESTIMENTI_CONFIG,
  },
  { tipologia: "USCITA", macro: "COSTI_GENERALI", config: USCITE_COSTI_GENERALI_CONFIG },

  { tipologia: "ENTRATA", macro: "AIG", config: ENTRATE_AIG_CONFIG },
  { tipologia: "ENTRATA", macro: "ATTIVITA_DIVERSE", config: ENTRATE_AD_CONFIG },
  { tipologia: "ENTRATA", macro: "RACCOLTE_FONDI", config: ENTRATE_RF_CONFIG },
  {
    tipologia: "ENTRATA",
    macro: "ATTIVITA_FINANZIARIA_PATRIMONIALE",
    config: ENTRATE_AFP_CONFIG,
  },
  {
    tipologia: "ENTRATA",
    macro: "SUPPORTO_GENERALE",
    config: ENTRATE_SUPPORTO_GENERALE_CONFIG,
  },
  {
    tipologia: "ENTRATA",
    macro: "INVESTIMENTO_DISINVESTIMENTO",
    config: ENTRATE_INVESTIMENTI_CONFIG,
  },
];



type CatalogOption = {
  value: string;
  label: string;
  specificaCode: number | null;
  specificaLabel: string;
  isExactCatalog: boolean;
};

function parseFullLabel(fullLabel: string) {
  const parts = String(fullLabel || "")
    .split(" | ")
    .map((x) => x.trim())
    .filter(Boolean);

  return {
    primaryLabel: parts[0] || "",
    detailLabel: parts[1] || "",
    freeLabel: parts.length >= 3 ? parts.slice(2).join(" | ") : "",
  };
}

function sameText(a: string, b: string) {
  return applyCommonFixes(a) === applyCommonFixes(b);
}

function buildCatalogOptions(config: NestedConfig | null): CatalogOption[] {
  if (!config) return [];

  const options: CatalogOption[] = [];

  for (const primary of config.primary) {
    if (config.hideSecondary || !config.secondary) {
      options.push({
        value: primary.label,
        label: primary.label,
        specificaCode: primary.code,
        specificaLabel: primary.label,
        isExactCatalog: true,
      });
      continue;
    }

    const details = withAltro(config.secondary[primary.code] || []);
    for (const detail of details) {
      options.push({
        value: detail,
        label: `${detail} — ${primary.label}`,
        specificaCode: primary.code,
        specificaLabel: primary.label,
        isExactCatalog: true,
      });
    }
  }

  const unique = new Map<string, CatalogOption>();
  for (const item of options) {
    const key = applyCommonFixes(item.value);
    if (!unique.has(key)) unique.set(key, item);
  }

  return Array.from(unique.values()).sort((a, b) => a.value.localeCompare(b.value, "it"));
}

function findCatalogMatch(value: string, options: CatalogOption[]) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return options.find((item) => sameText(item.value, normalized)) || null;
}

export default function MovimentoEditor() {
  const annualitaId = localStorage.getItem("annualita_id");
  const editId = localStorage.getItem("movimento_edit_id");
  const presetTipologia = (localStorage.getItem("movimento_tipologia") as Tipologia) || "";

  const [loading, setLoading] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  const [tipologia, setTipologia] = useState<Tipologia | "">(presetTipologia);
  const [macro, setMacro] = useState<Macro | "">("");
  const [data, setData] = useState("");
  const [conto, setConto] = useState<Conto>("CASSA");
  const [importo, setImporto] = useState("");
  const [iva, setIva] = useState("0");
  const [regime, setRegime] = useState<Regime>("ORDINARIO");

  const [descrizioneInput, setDescrizioneInput] = useState("");
  const [descrizioneLibera, setDescrizioneLibera] = useState("");
  const [descrizioneCode, setDescrizioneCode] = useState<number | null>(null);
  const [descrizioneLabel, setDescrizioneLabel] = useState("");
  const [specificaLabel, setSpecificaLabel] = useState("");
  const [isCatalogExactMatch, setIsCatalogExactMatch] = useState(false);
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null);

  const isEntrataOrUscita = tipologia === "ENTRATA" || tipologia === "USCITA";
  const isAvanzo = tipologia === "AVANZO_CASSA_T_1" || tipologia === "AVANZO_BANCA_T_1";
  const isRegimeOrdinario = regime === "ORDINARIO";
  const showIvaField = isEntrataOrUscita && isRegimeOrdinario;

  const macroOptions = useMemo(() => {
    if (tipologia === "USCITA" || tipologia === "ENTRATA") {
      return [
        "AIG",
        "ATTIVITA_DIVERSE",
        "RACCOLTE_FONDI",
        "SUPPORTO_GENERALE",
        "ATTIVITA_FINANZIARIA_PATRIMONIALE",
        "INVESTIMENTO_DISINVESTIMENTO",
      ] as Macro[];
    }

    return [] as Macro[];
  }, [tipologia]);

  const config = useMemo(() => getConfig(tipologia, macro), [tipologia, macro]);
  const catalogOptions = useMemo(() => buildCatalogOptions(config), [config]);
  const selectedCatalogMatch = useMemo(
    () => findCatalogMatch(descrizioneInput, catalogOptions),
    [descrizioneInput, catalogOptions]
  );

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

      if (!error && (data?.regime === "FORFETTARIO" || data?.regime === "ORDINARIO")) {
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
    if (!editId) {
      setLoading(false);
      return;
    }

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
      setMacro((row.macro as Macro) || "");
      setData(row.data || "");
      setConto((row.conto as Conto) || "CASSA");
      setImporto(String(row.importo ?? ""));
      setIva(String(row.iva ?? 0));
      setDescrizioneCode(row.descrizione_code ?? null);
      setDescrizioneLabel(String(row.descrizione_label || ""));
      setDescrizioneLibera(String(row.descrizione_libera || ""));

      const parsed = parseFullLabel(String(row.descrizione_label || ""));
      const startingInput = parsed.detailLabel || parsed.primaryLabel || String(row.descrizione_libera || "");
      setDescrizioneInput(startingInput);
      setSpecificaLabel(parsed.primaryLabel || "");
      setIsCatalogExactMatch(Boolean(row.descrizione_code));
      setCatalogWarning(null);
      setLoading(false);
    };

    load();
  }, [editId]);

  useEffect(() => {
    if (editId) return;

    setMacro("");
    setData("");
    setConto("CASSA");
    setImporto("");
    setIva("0");
    setDescrizioneInput("");
    setDescrizioneLibera("");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setSpecificaLabel("");
    setIsCatalogExactMatch(false);
    setCatalogWarning(null);
  }, [tipologia, editId]);

  useEffect(() => {
    if (editId) return;

    setDescrizioneInput("");
    setDescrizioneLibera("");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setSpecificaLabel("");
    setIsCatalogExactMatch(false);
    setCatalogWarning(null);
  }, [macro, editId]);

  useEffect(() => {
    if (isAvanzo) {
      setDescrizioneCode(null);
      setDescrizioneLabel("");
      setSpecificaLabel("");
      setDescrizioneLibera("");
      setIsCatalogExactMatch(false);
      setCatalogWarning(null);
      return;
    }

    const input = normalizeText(descrizioneInput);
    if (!input) {
      setDescrizioneCode(null);
      setDescrizioneLabel("");
      setSpecificaLabel("");
      setDescrizioneLibera("");
      setIsCatalogExactMatch(false);
      setCatalogWarning(null);
      return;
    }

    const match = findCatalogMatch(input, catalogOptions);
    if (match) {
      setDescrizioneCode(match.specificaCode);
      setSpecificaLabel(match.specificaLabel);
      setDescrizioneLibera(input);
      setIsCatalogExactMatch(true);
      setCatalogWarning(null);

      if (config?.hideSecondary) {
        setDescrizioneLabel(match.specificaLabel);
      } else {
        setDescrizioneLabel(`${match.specificaLabel} | ${match.value}`);
      }
      return;
    }

    setDescrizioneCode(null);
    setSpecificaLabel("");
    setDescrizioneLabel(input);
    setDescrizioneLibera(input);
    setIsCatalogExactMatch(false);
    setCatalogWarning(
      macro
        ? "La descrizione non coincide con una voce del catalogo di questa categoria. Il movimento potrà essere verificato dall’amministratore."
        : null
    );
  }, [descrizioneInput, catalogOptions, config, isAvanzo, macro]);

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

    if (isAvanzo) {
      if (!isValidMoney(importo)) {
        setError("Importo non valido");
        return;
      }
    } else {
      if (!macro) {
        setError("Seleziona la categoria");
        return;
      }

      if (!data) {
        setError("Inserisci la data");
        return;
      }

      if (!normalizeText(descrizioneInput)) {
        setError("Inserisci la descrizione");
        return;
      }

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
      conto: isAvanzo ? (tipologia === "AVANZO_CASSA_T_1" ? "CASSA" : "BANCA") : conto,
      descrizione_code: isAvanzo ? null : isCatalogExactMatch ? descrizioneCode : null,
      descrizione_label: isAvanzo ? null : descrizioneLabel || null,
      descrizione_libera: isAvanzo ? null : normalizeText(descrizioneInput) || null,
      importo: Number(importo),
      iva: showIvaField ? Number(iva || 0) : 0,
      is_costo_generale: macro === "SUPPORTO_GENERALE",
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
          <h2 className="pageTitle">{editId ? "Modifica movimento" : "Nuovo movimento"}</h2>
          <div className="pageHelp">
            Inserisci solo i dati essenziali. Se la descrizione coincide con una voce del catalogo,
            l’associazione tecnica viene fatta automaticamente; altrimenti il movimento resta più
            libero e potrà essere verificato in amministrazione.
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

      {isEntrataOrUscita && (
        <Card title="2️⃣ Categoria">
          <select
            value={macro}
            onChange={(e) => setMacro(e.target.value as Macro | "")}
            className="input"
          >
            <option value="">Seleziona…</option>
            {macroOptions.map((item) => (
              <option key={item} value={item}>
                {MACRO_LABELS[item]}
              </option>
            ))}
          </select>
        </Card>
      )}

      {isEntrataOrUscita && (
        <Card title="3️⃣ Data">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input"
          />
        </Card>
      )}

      {isEntrataOrUscita && (
        <Card title="4️⃣ Descrizione">
          <input
            list="catalogo-poste-list"
            value={descrizioneInput}
            onChange={(e) => setDescrizioneInput(e.target.value)}
            className="input"
            placeholder={
              macro
                ? "Scegli una voce del catalogo oppure scrivi liberamente"
                : "Prima seleziona la categoria"
            }
            disabled={!macro}
          />

          <datalist id="catalogo-poste-list">
            {catalogOptions.map((item) => (
              <option key={`${item.specificaCode ?? "x"}-${item.value}`} value={item.value}>
                {item.label}
              </option>
            ))}
          </datalist>

          {macro && (
            <div className="rowSub" style={{ marginTop: 8 }}>
              Il menu propone tutte le voci previste per <b>{MACRO_LABELS[macro]}</b>, ma puoi
              anche scrivere una descrizione diversa.
            </div>
          )}

          {selectedCatalogMatch && (
            <div
              style={{
                marginTop: 12,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                background: "#fafafa",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Associazione automatica pronta</div>
              <div style={{ marginBottom: 6 }}>
                <b>Specifica di categoria:</b> {selectedCatalogMatch.specificaLabel}
              </div>
              <div>
                <b>Dettaglio della posta:</b> {selectedCatalogMatch.value}
              </div>
            </div>
          )}

          {catalogWarning && (
            <div style={{ marginTop: 12 }}>
              <Badge tone="blue">Verifica</Badge>
              <div className="rowSub" style={{ marginTop: 6 }}>
                {catalogWarning}
              </div>
            </div>
          )}
        </Card>
      )}

      {(isAvanzo || isEntrataOrUscita) && (
        <Card title={isAvanzo ? "2️⃣ Dati economici" : "5️⃣ Dati economici"}>
          {!isAvanzo && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Banca / Cassa</div>
              <select
                value={conto}
                onChange={(e) => setConto(e.target.value as Conto)}
                className="input"
              >
                <option value="CASSA">Cassa</option>
                <option value="BANCA">Banca</option>
              </select>
            </div>
          )}

          <div style={{ marginBottom: showIvaField && !isAvanzo ? 12 : 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Importo</div>
            <input
              type="number"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              className="input"
              placeholder="0,00"
              step="0.01"
              min={0}
            />
          </div>

          {showIvaField && !isAvanzo && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>IVA</div>
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
            </div>
          )}
        </Card>
      )}

      {isEntrataOrUscita && macro && normalizeText(descrizioneInput) && (
        <Card title="6️⃣ Esito della registrazione">
          <div style={{ marginBottom: 6 }}>
            <b>Categoria:</b> {MACRO_LABELS[macro]}
          </div>
          <div style={{ marginBottom: 6 }}>
            <b>Descrizione inserita:</b> {normalizeText(descrizioneInput)}
          </div>
          <div style={{ marginBottom: 6 }}>
            <b>Associazione tecnica:</b> {isCatalogExactMatch ? "automatica" : "da verificare"}
          </div>
          {isCatalogExactMatch && specificaLabel && (
            <div style={{ marginBottom: 6 }}>
              <b>Specifica di categoria:</b> {specificaLabel}
            </div>
          )}
          {!isCatalogExactMatch && (
            <div className="rowSub">
              Poiché la descrizione non coincide con una voce del catalogo, il movimento verrà
              salvato con testo libero e potrà essere associato correttamente dall’amministratore.
            </div>
          )}
        </Card>
      )}

      {error && (
        <div style={{ marginTop: 14, marginBottom: 10 }}>
          <Badge tone="red">Errore</Badge>
          <div className="errorText">{error}</div>
        </div>
      )}

      <div className="formActions">
        <PrimaryButton onClick={salva}>{editId ? "Salva modifiche" : "Salva"}</PrimaryButton>
        <SecondaryButton onClick={() => history.back()}>Annulla</SecondaryButton>
      </div>
    </Layout>
  );
}
