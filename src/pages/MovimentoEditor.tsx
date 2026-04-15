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

/* =========================
   IMBUTO
========================= */

const ENTRATA_GATE_OPTIONS: FunnelOption<FunnelGate>[] = [
  {
    value: "QUOTE_CONTRIBUTI_DONAZIONI",
    label: "Ho ricevuto quote, donazioni o contributi",
    help: "Quote associative, donazioni, erogazioni liberali, 5x1000, contributi.",
  },
  {
    value: "INCASSI_ATTIVITA_SERVIZI",
    label: "Ho incassato da attività o servizi",
    help: "Prestazioni, cessioni, sponsor, corrispettivi, convenzioni.",
  },
  {
    value: "RACCOLTE_FONDI_GATE",
    label: "Ho incassato da una raccolta fondi",
    help: "Entrate da raccolte fondi abituali o occasionali.",
  },
  {
    value: "BANCA_PATRIMONIO_RENDITE",
    label: "Ho ricevuto interessi, affitti o altre rendite",
    help: "Interessi attivi, affitti attivi, rendite patrimoniali.",
  },
  {
    value: "FINANZIAMENTI_DISINVESTIMENTI_ALTRO",
    label: "Ho ricevuto un finanziamento o altro",
    help: "Prestiti ricevuti, disinvestimenti e casi residuali.",
  },
];

const USCITA_GATE_OPTIONS: FunnelOption<FunnelGate>[] = [
  {
    value: "BENI_MATERIALI",
    label: "Ho acquistato beni o materiali",
    help: "Cancelleria, carburante, dispositivi, farmaci, materiali di consumo.",
  },
  {
    value: "SERVIZI_PROFESSIONISTI",
    label: "Ho pagato un servizio o un professionista",
    help: "Commercialista, consulenze, utenze, assicurazioni, manutenzioni.",
  },
  {
    value: "PERSONALE_GATE",
    label: "Ho sostenuto un costo del personale",
    help: "Retribuzioni, oneri, TFR e altre voci del personale.",
  },
  {
    value: "RACCOLTE_FONDI_USCITE",
    label: "Ho sostenuto costi per una raccolta fondi",
    help: "Uscite legate a raccolte fondi abituali o occasionali.",
  },
  {
    value: "BANCA_PATRIMONIO_INVESTIMENTI",
    label: "Ho pagato banca, mutui, patrimonio o investimenti",
    help: "Spese bancarie, mutui, patrimonio edilizio, investimenti.",
  },
  {
    value: "IMPOSTE_RIMBORSI_ALTRE_USCITE",
    label: "Ho pagato imposte, rimborsi o altre uscite",
    help: "Imposte, multe, rimborsi volontari e altre uscite residuali.",
  },
];

const ENTRATA_CONTEXT_OPTIONS: FunnelOption<FunnelContext>[] = [
  {
    value: "AIG",
    label: "Per un progetto o attività istituzionale",
    help: "Operazione legata all’attività di interesse generale (AIG).",
  },
  {
    value: "ATTIVITA_DIVERSE",
    label: "Per attività diverse",
    help: "Operazione legata ad attività diverse.",
  },
  {
    value: "RACCOLTE_FONDI",
    label: "Per una raccolta fondi",
    help: "Operazione legata a una raccolta fondi.",
  },
  {
    value: "SUPPORTO_GENERALE",
    label: "Per il funzionamento generale",
    help: "Operazione legata al funzionamento generale dell’ente.",
  },
  {
    value: "FINANZA_PATRIMONIO",
    label: "Per banca, patrimonio o investimenti",
    help: "Operazione bancaria, patrimoniale o finanziaria.",
  },
  {
    value: "NON_SO",
    label: "Non lo so",
    help: "Mostra comunque le proposte migliori.",
  },
];

const USCITA_CONTEXT_OPTIONS: FunnelOption<FunnelContext>[] = [
  {
    value: "AIG",
    label: "Attività istituzionale / progetto",
    help: "Spesa sostenuta per attività di interesse generale.",
  },
  {
    value: "ATTIVITA_DIVERSE",
    label: "Attività diversa",
    help: "Spesa sostenuta per attività diversa.",
  },
  {
    value: "RACCOLTE_FONDI",
    label: "Raccolta fondi",
    help: "Spesa legata a raccolte fondi.",
  },
  {
    value: "SUPPORTO_GENERALE",
    label: "Per il funzionamento generale",
    help: "Spesa di supporto generale o costo generale.",
  },
  {
    value: "FINANZA_PATRIMONIO",
    label: "Finanza / patrimonio / investimenti",
    help: "Spesa bancaria, patrimoniale o di investimento.",
  },
  {
    value: "IMPOSTE",
    label: "Per imposte",
    help: "IRAP o altre uscite tributarie.",
  },
  {
    value: "NON_SO",
    label: "Non lo so",
    help: "Mostra comunque le proposte migliori.",
  },
];

function getGateOptions(tipologia: Tipologia | ""): FunnelOption<FunnelGate>[] {
  if (tipologia === "ENTRATA") return ENTRATA_GATE_OPTIONS;
  if (tipologia === "USCITA") return USCITA_GATE_OPTIONS;
  return [];
}

function getContextOptions(tipologia: Tipologia | ""): FunnelOption<FunnelContext>[] {
  if (tipologia === "ENTRATA") return ENTRATA_CONTEXT_OPTIONS;
  if (tipologia === "USCITA") return USCITA_CONTEXT_OPTIONS;
  return [];
}

function getAllowedMacrosByContext(
  tipologia: Tipologia | "",
  context: FunnelContext | ""
): Macro[] {
  if (!context) {
    return tipologia === "USCITA"
      ? [
          "AIG",
          "ATTIVITA_DIVERSE",
          "RACCOLTE_FONDI",
          "ATTIVITA_FINANZIARIA_PATRIMONIALE",
          "SUPPORTO_GENERALE",
          "INVESTIMENTO_DISINVESTIMENTO",
          "IMPOSTE",
          "COSTI_GENERALI",
        ]
      : [
          "AIG",
          "ATTIVITA_DIVERSE",
          "RACCOLTE_FONDI",
          "ATTIVITA_FINANZIARIA_PATRIMONIALE",
          "SUPPORTO_GENERALE",
          "INVESTIMENTO_DISINVESTIMENTO",
        ];
  }

  switch (context) {
    case "AIG":
      return ["AIG"];
    case "ATTIVITA_DIVERSE":
      return ["ATTIVITA_DIVERSE"];
    case "RACCOLTE_FONDI":
      return ["RACCOLTE_FONDI"];
    case "SUPPORTO_GENERALE":
      return tipologia === "USCITA" ? ["SUPPORTO_GENERALE", "COSTI_GENERALI"] : ["SUPPORTO_GENERALE"];
    case "FINANZA_PATRIMONIO":
      return ["ATTIVITA_FINANZIARIA_PATRIMONIALE", "INVESTIMENTO_DISINVESTIMENTO"];
    case "IMPOSTE":
      return tipologia === "USCITA" ? ["IMPOSTE"] : [];
    case "NON_SO":
    default:
      return getAllowedMacrosByContext(tipologia, "");
  }
}

function includesAny(text: string, values: string[]) {
  const t = normalizeSemanticText(text);
  return values.some((v) => t.includes(normalizeSemanticText(v)));
}

function matchesGate(entry: SemanticEntry, gate: FunnelGate | "") {
  if (!gate) return true;

  const specifica = normalizeSemanticText(entry.specificaLabel);
  const dettaglio = normalizeSemanticText(entry.dettaglioLabel);
  const categoria = normalizeSemanticText(entry.categoriaLabel);

  switch (gate) {
    case "QUOTE_CONTRIBUTI_DONAZIONI":
      return (
        includesAny(specifica, [
          "quote associative",
          "apporti dei fondatori",
          "erogazioni liberali",
          "5 per mille",
          "contributi",
        ]) ||
        includesAny(dettaglio, ["donazione", "liberali", "5 per mille", "contributi"])
      );

    case "INCASSI_ATTIVITA_SERVIZI":
      return includesAny(specifica, [
        "prestazioni",
        "cessioni",
        "associati",
        "terzi",
        "contratti con enti pubblici",
        "sponsorizzazioni",
      ]);

    case "RACCOLTE_FONDI_GATE":
    case "RACCOLTE_FONDI_USCITE":
      return entry.categoria === "RACCOLTE_FONDI";

    case "BANCA_PATRIMONIO_RENDITE":
      return entry.categoria === "ATTIVITA_FINANZIARIA_PATRIMONIALE";

    case "FINANZIAMENTI_DISINVESTIMENTI_ALTRO":
      return entry.categoria === "INVESTIMENTO_DISINVESTIMENTO" || entry.categoria === "SUPPORTO_GENERALE";

    case "BENI_MATERIALI":
      return (
        includesAny(specifica, ["materie prime", "di consumo e di merci"]) ||
        includesAny(dettaglio, [
          "cancelleria",
          "carburante",
          "materiale di consumo",
          "imballaggi",
          "medicinali",
          "cibo per animali",
          "dispositivi di protezione",
          "casalinghi",
        ])
      );

    case "SERVIZI_PROFESSIONISTI":
      return (
        includesAny(specifica, ["servizi", "godimento beni di terzi"]) ||
        includesAny(dettaglio, [
          "consulenze",
          "spese legali",
          "parcelle liberi professionisti",
          "utenze",
          "assicurazioni",
          "spese postali",
          "spedizione",
          "manutenzione",
          "polizza",
          "sito web",
          "licenze software",
          "affitto sede",
          "noleggio",
        ])
      );

    case "PERSONALE_GATE":
      return includesAny(specifica, ["personale"]) || includesAny(categoria, ["personale"]);

    case "BANCA_PATRIMONIO_INVESTIMENTI":
      return (
        entry.categoria === "ATTIVITA_FINANZIARIA_PATRIMONIALE" ||
        entry.categoria === "INVESTIMENTO_DISINVESTIMENTO" ||
        includesAny(dettaglio, ["mutuo", "investimento", "interessi passivi", "commissioni bancarie", "imu"])
      );

    case "IMPOSTE_RIMBORSI_ALTRE_USCITE":
      return (
        entry.categoria === "IMPOSTE" ||
        includesAny(specifica, ["uscite diverse di gestione"]) ||
        includesAny(dettaglio, [
          "imposte",
          "tasse",
          "rimborso spese volontari",
          "rimborso chilometrico",
          "multe",
          "ammende",
          "sopravvenienze passive",
          "omaggi",
          "abbonamenti",
        ])
      );

    default:
      return true;
  }
}

/* =========================
   RICERCA SEMANTICA
========================= */

function normalizeSemanticText(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMMON_FIXES: Record<string, string> = {
  commericalista: "commercialista",
  commericialista: "commercialista",
  commercialissta: "commercialista",
  aattivi: "attivi",
  attvi: "attivi",
  interesi: "interessi",
  interessii: "interessi",
  bancarai: "bancari",
  banacri: "bancari",
  bonfici: "bonifici",
  consuelenza: "consulenza",
  canselleria: "cancelleria",
  assiccurazione: "assicurazione",
  mutuoo: "mutuo",
  pedaggo: "pedaggio",
  condominiali: "condominiali",
  fidejussione: "fideiussione",
  canonepec: "pec",
  sponse: "sponsorizzazioni",
  sponsorizzazzioni: "sponsorizzazioni",
};

function applyCommonFixes(text: string) {
  let out = normalizeSemanticText(text);
  for (const [wrong, correct] of Object.entries(COMMON_FIXES)) {
    const re = new RegExp(`\\b${wrong}\\b`, "g");
    out = out.replace(re, correct);
  }
  return out;
}

function tokenizeSemanticText(text: string) {
  return applyCommonFixes(text)
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean);
}

function uniqueNormalizedStrings(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((x) => applyCommonFixes(x))
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function fuzzyTokenMatch(token: string, expected: string, enableFuzzy: boolean) {
  if (!token || !expected) return false;
  if (token === expected) return true;
  if (!enableFuzzy) return false;
  if (token.length < 4 || expected.length < 4) return false;

  return levenshtein(token, expected) <= 1;
}

const SEMANTIC_HINTS: Record<string, SemanticPack> = {
  "parcelle liberi professionisti": {
    alias: [
      "prestazione commercialista",
      "compenso commercialista",
      "fattura commercialista",
      "onorario commercialista",
      "parcella commercialista",
      "prestazione avvocato",
      "compenso avvocato",
      "prestazione professionista",
      "fattura professionista",
    ],
    triggerWords: ["commercialista", "avvocato", "professionista"],
    supportWords: ["prestazione", "compenso", "parcella", "onorario", "fattura"],
    contoConsigliato: "BANCA",
  },
  consulenze: {
    alias: [
      "consulenza",
      "consulenza fiscale",
      "consulenza tecnica",
      "consulente",
      "supporto consulenziale",
    ],
    triggerWords: ["consulenza", "consulente"],
    supportWords: ["tecnica", "fiscale", "supporto"],
    contoConsigliato: "BANCA",
  },
  "spese legali e consulenze": {
    alias: [
      "spesa legale",
      "spese legali",
      "parcella avvocato",
      "compenso legale",
      "assistenza legale",
    ],
    triggerWords: ["legale", "avvocato"],
    supportWords: ["parcella", "compenso", "assistenza"],
    contoConsigliato: "BANCA",
  },
  "interessi attivi": {
    alias: [
      "interessi bancari attivi",
      "interessi attivi banca",
      "interessi su conto",
      "interessi conto corrente",
      "credito interessi",
    ],
    triggerWords: ["interessi"],
    supportWords: ["attivi", "banca", "conto", "corrente"],
    contoConsigliato: "BANCA",
  },
  "interessi passivi": {
    alias: [
      "interessi bancari passivi",
      "interessi passivi banca",
      "interessi su finanziamento",
      "interessi mutuo",
    ],
    triggerWords: ["interessi"],
    supportWords: ["passivi", "mutuo", "finanziamento", "banca"],
    contoConsigliato: "BANCA",
  },
  "commissioni bancarie o postali": {
    alias: [
      "spese banca",
      "commissioni banca",
      "spese bancarie",
      "commissioni conto",
      "spese conto corrente",
      "spese postali bancarie",
    ],
    triggerWords: ["banca", "commissioni"],
    supportWords: ["spese", "conto", "corrente", "postali"],
    contoConsigliato: "BANCA",
  },
  "costi fissi bancari o postali": {
    alias: [
      "canone banca",
      "costo fisso banca",
      "spese fisse banca",
      "canone conto",
      "canone conto corrente",
    ],
    triggerWords: ["canone", "banca", "conto"],
    supportWords: ["fisso", "spese", "corrente"],
    contoConsigliato: "BANCA",
  },
  imu: {
    alias: ["imu immobile", "imposta imu", "pagamento imu"],
    triggerWords: ["imu"],
    supportWords: ["imposta", "immobile"],
    contoConsigliato: "BANCA",
  },
  "spese condominiali": {
    alias: ["condominio", "spese condominio", "quota condominio"],
    triggerWords: ["condominio", "condominiali"],
    supportWords: ["spese", "quota"],
    contoConsigliato: "BANCA",
  },
  "affitto sede": {
    alias: ["canone sede", "locazione sede", "affitto ufficio", "affitto locale"],
    triggerWords: ["affitto", "locazione"],
    supportWords: ["sede", "ufficio", "locale", "canone"],
    contoConsigliato: "BANCA",
  },
  "affitti e locazioni": {
    alias: ["affitto", "locazione", "canone di locazione"],
    triggerWords: ["affitto", "locazione"],
    supportWords: ["canone"],
    contoConsigliato: "BANCA",
  },
  "affitti attivi": {
    alias: ["canone affitto attivo", "locazione attiva", "incasso affitto"],
    triggerWords: ["affitto", "locazione"],
    supportWords: ["attivo", "incasso", "canone"],
    contoConsigliato: "BANCA",
  },
  "canone sito web, pec, firma digitale, licenze software": {
    alias: [
      "canone sito",
      "sito web",
      "pec",
      "firma digitale",
      "licenza software",
      "abbonamento software",
      "hosting",
      "dominio",
    ],
    triggerWords: ["sito", "pec", "software", "hosting", "dominio"],
    supportWords: ["canone", "abbonamento", "licenza", "web", "firma", "digitale"],
    contoConsigliato: "BANCA",
  },
  "assicurazioni varie": {
    alias: ["premio assicurazione", "polizza assicurazione", "assicurazione"],
    triggerWords: ["assicurazione", "polizza"],
    supportWords: ["premio", "copertura"],
    contoConsigliato: "BANCA",
  },
  "assicurazioni varie (diverse dalla polizza del volontariato)": {
    alias: [
      "polizza rc",
      "polizza infortuni",
      "assicurazione diversa volontari",
      "assicurazione generica",
    ],
    triggerWords: ["assicurazione", "polizza"],
    supportWords: ["rc", "infortuni", "premio"],
    contoConsigliato: "BANCA",
  },
  "polizza assicurazione copertura rc infortunio e malattia": {
    alias: [
      "polizza volontari",
      "assicurazione volontari",
      "copertura rc volontari",
      "assicurazione infortunio volontari",
    ],
    triggerWords: ["volontari", "polizza", "assicurazione"],
    supportWords: ["rc", "infortunio", "malattia", "copertura"],
    contoConsigliato: "BANCA",
  },
  "carburante automezzo associativo": {
    alias: [
      "benzina pulmino",
      "diesel pulmino",
      "carburante pulmino",
      "benzina auto associativa",
      "rifornimento mezzo",
    ],
    triggerWords: ["carburante", "benzina", "diesel"],
    supportWords: ["pulmino", "mezzo", "automezzo", "auto"],
    contoConsigliato: "CASSA",
  },
  "carburanti e lubrificanti": {
    alias: ["benzina", "gasolio", "rifornimento carburante", "olio motore"],
    triggerWords: ["benzina", "carburante", "gasolio"],
    supportWords: ["lubrificante", "rifornimento", "olio"],
    contoConsigliato: "CASSA",
  },
  cancelleria: {
    alias: ["cancelleria ufficio", "materiale cancelleria", "penne carta"],
    triggerWords: ["cancelleria"],
    supportWords: ["ufficio", "penne", "carta", "cartucce"],
    contoConsigliato: "CASSA",
  },
  "cancelleria e stampati": {
    alias: ["stampati", "moduli", "blocchi ricevute", "materiale ufficio"],
    triggerWords: ["cancelleria", "stampati"],
    supportWords: ["moduli", "ricevute", "ufficio"],
    contoConsigliato: "CASSA",
  },
  "utenze telefoniche, elettriche, idriche, gas": {
    alias: [
      "bolletta luce",
      "bolletta gas",
      "bolletta acqua",
      "utenza telefono",
      "utenze",
    ],
    triggerWords: ["bolletta", "utenze", "telefono", "luce", "gas", "acqua"],
    supportWords: ["elettrica", "idrica", "telefonica"],
    contoConsigliato: "BANCA",
  },
  "spese postali": {
    alias: ["francobolli", "spedizione posta", "posta"],
    triggerWords: ["posta", "postali"],
    supportWords: ["francobolli", "spedizione"],
    contoConsigliato: "CASSA",
  },
  "spese postali e di spedizione": {
    alias: ["corriere", "spedizione", "spedizioni", "invio pacco"],
    triggerWords: ["spedizione", "corriere"],
    supportWords: ["postali", "pacco", "invio"],
    contoConsigliato: "CASSA",
  },
  "spese accensione fidejussione": {
    alias: ["fideiussione", "spesa fideiussione", "costo fideiussione"],
    triggerWords: ["fideiussione"],
    supportWords: ["spesa", "costo", "accensione"],
    contoConsigliato: "BANCA",
  },
  "pedaggio autostradale per automezzo associativo": {
    alias: ["pedaggio", "telepass", "casello autostrada"],
    triggerWords: ["pedaggio", "telepass"],
    supportWords: ["autostrada", "casello", "mezzo"],
    contoConsigliato: "CASSA",
  },
  "rimborso chilometrico auto propria": {
    alias: ["rimborso chilometrico", "km auto", "chilometrico auto"],
    triggerWords: ["chilometrico", "chilometri"],
    supportWords: ["rimborso", "auto", "propria", "km"],
    contoConsigliato: "BANCA",
  },
  "rimborso spese volontari": {
    alias: ["rimborso volontari", "rimborso spese volontario"],
    triggerWords: ["volontari", "volontario"],
    supportWords: ["rimborso", "spese"],
    contoConsigliato: "BANCA",
  },
  "erogazioni liberali": {
    alias: ["donazione", "liberalita", "liberalità", "offerta libera", "erogazione liberale"],
    triggerWords: ["donazione", "liberalita", "liberalità"],
    supportWords: ["offerta", "erogazione", "libera"],
    contoConsigliato: "BANCA",
  },
  "entrate del 5 per mille": {
    alias: ["5 per mille", "cinque per mille"],
    triggerWords: ["5", "cinque"],
    supportWords: ["mille", "per"],
    contoConsigliato: "BANCA",
  },
  "contributi da soggetti privati": {
    alias: [
      "contributo fondazione privata",
      "contributo privato",
      "contributo da azienda",
      "contributo da impresa",
    ],
    triggerWords: ["contributo"],
    supportWords: ["privato", "fondazione", "azienda", "impresa"],
    contoConsigliato: "BANCA",
  },
  "contributi da enti pubblici": {
    alias: [
      "contributo comune",
      "contributo regione",
      "contributo asl",
      "contributo ministero",
      "contributo pubblico",
    ],
    triggerWords: ["contributo"],
    supportWords: ["comune", "regione", "asl", "ministero", "pubblico"],
    contoConsigliato: "BANCA",
  },
  "entrate da contratti con enti pubblici": {
    alias: [
      "corrispettivo da comune",
      "contratto con comune",
      "servizio per ente pubblico",
      "convenzione con ente pubblico",
    ],
    triggerWords: ["contratto", "convenzione", "corrispettivo"],
    supportWords: ["comune", "regione", "asl", "ente", "pubblico"],
    contoConsigliato: "BANCA",
  },
  "entrate per prestazioni e cessioni a terzi (sponsorizzazioni)": {
    alias: ["sponsorizzazione", "sponsor", "entrata sponsor", "corrispettivo sponsor"],
    triggerWords: ["sponsor", "sponsorizzazione"],
    supportWords: ["corrispettivo", "terzi"],
    contoConsigliato: "BANCA",
  },
  "entrate da quote associative e apporti dei fondatori": {
    alias: ["quota associativa", "quote associative", "quota socio", "versamento socio"],
    triggerWords: ["quota", "associativa", "socio"],
    supportWords: ["versamento", "tessera", "fondatore"],
    contoConsigliato: "CASSA",
  },
  "entrate dagli associati per attività mutuali": {
    alias: ["corrispettivo associato", "quota attivita mutuale", "attivita mutuale associati"],
    triggerWords: ["associato", "mutuali"],
    supportWords: ["attivita", "corrispettivo"],
    contoConsigliato: "CASSA",
  },
  "quota capitale mutuo": {
    alias: [
      "rata mutuo capitale",
      "quota capitale finanziamento",
      "rimborso mutuo capitale",
      "rata mutuo",
      "mutuo",
    ],
    triggerWords: ["mutuo", "finanziamento"],
    supportWords: ["rata", "capitale", "rimborso"],
    contoConsigliato: "BANCA",
  },
  "acquisto beni strumentali di valore superiore 516 euro": {
    alias: [
      "acquisto bene strumentale",
      "acquisto attrezzatura sopra 516",
      "investimento bene strumentale",
      "acquisto computer",
      "acquisto pulmino",
    ],
    triggerWords: ["strumentale", "investimento", "attrezzatura", "computer", "pulmino"],
    supportWords: ["acquisto", "bene", "superiore", "516"],
    contoConsigliato: "BANCA",
  },
  "immobili ad uso investimento": {
    alias: ["acquisto immobile investimento", "immobile a reddito"],
    triggerWords: ["immobile"],
    supportWords: ["investimento", "reddito"],
    contoConsigliato: "BANCA",
  },
  "titoli, azioni": {
    alias: ["acquisto titoli", "azioni", "investimento finanziario"],
    triggerWords: ["titoli", "azioni"],
    supportWords: ["investimento", "finanziario"],
    contoConsigliato: "BANCA",
  },
  "ricevimento di finanziamenti e di prestiti": {
    alias: ["ricevuto finanziamento", "ricevuto prestito", "incasso prestito"],
    triggerWords: ["finanziamento", "prestito"],
    supportWords: ["ricevuto", "incasso"],
    contoConsigliato: "BANCA",
  },
  "entrate da distacco del personale": {
    alias: ["distacco personale", "rimborso distacco personale"],
    triggerWords: ["distacco", "personale"],
    supportWords: ["rimborso", "entrata"],
    contoConsigliato: "BANCA",
  },
};

function getSemanticHint(primaryLabel: string, dettaglioLabel: string): SemanticPack {
  const exactDetail = SEMANTIC_HINTS[applyCommonFixes(dettaglioLabel)];
  if (exactDetail) return exactDetail;

  const exactPrimary = SEMANTIC_HINTS[applyCommonFixes(primaryLabel)];
  if (exactPrimary) return exactPrimary;

  return {
    alias: [],
    triggerWords: [],
    supportWords: [],
    contoConsigliato: null,
  };
}

function buildSemanticEntries(): SemanticEntry[] {
  const rows: SemanticEntry[] = [];

  for (const item of CONFIG_REGISTRY) {
    const categoriaLabel = MACRO_LABELS[item.macro];

    for (const primary of item.config.primary) {
      const details =
        item.config.hideSecondary || !item.config.secondary
          ? [""]
          : withAltro(item.config.secondary[primary.code] || []);

      for (const rawDetail of details) {
        const dettaglio = normalizeText(rawDetail);
        const dettaglioLabel = dettaglio || primary.label;
        const hint = getSemanticHint(primary.label, dettaglioLabel);

        const alias = uniqueStrings([
          dettaglioLabel,
          primary.label,
          categoriaLabel,
          `${primary.label} ${dettaglioLabel}`,
          ...(hint.alias || []),
        ]);

        const triggerWords = uniqueStrings([
          ...tokenizeSemanticText(dettaglioLabel),
          ...(hint.triggerWords || []),
        ]);

        const supportWords = uniqueStrings([
          ...tokenizeSemanticText(primary.label),
          ...tokenizeSemanticText(categoriaLabel),
          ...(hint.supportWords || []),
        ]);

        const normalizedTipologia = applyCommonFixes(item.tipologia);
        const normalizedCategoriaLabel = applyCommonFixes(categoriaLabel);
        const normalizedSpecificaLabel = applyCommonFixes(primary.label);
        const normalizedDettaglioLabel = applyCommonFixes(dettaglioLabel);
        const normalizedAlias = uniqueNormalizedStrings(alias);
        const normalizedTriggerWords = uniqueNormalizedStrings(triggerWords);
        const normalizedSupportWords = uniqueNormalizedStrings(supportWords);

        const searchText = applyCommonFixes(
          [
            item.tipologia,
            categoriaLabel,
            primary.label,
            dettaglioLabel,
            ...alias,
            ...triggerWords,
            ...supportWords,
          ].join(" ")
        );

        rows.push({
          tipologia: item.tipologia,
          categoria: item.macro,
          categoriaLabel,
          specificaCode: primary.code,
          specificaLabel: primary.label,
          dettaglio,
          dettaglioLabel,
          alias,
          triggerWords,
          supportWords,
          contoConsigliato: hint.contoConsigliato ?? null,
          searchText,

          normalizedTipologia,
          normalizedCategoriaLabel,
          normalizedSpecificaLabel,
          normalizedDettaglioLabel,
          normalizedAlias,
          normalizedTriggerWords,
          normalizedSupportWords,
          searchWords: uniqueNormalizedStrings(searchText.split(" ")),
        });
      }
    }
  }

  return rows;
}

function scoreSemanticEntry(
  input: string,
  entry: SemanticEntry,
  selectedTipologia: Tipologia | ""
): ScoredSemanticEntry {
  const normalizedInput = applyCommonFixes(input);
  const tokens = tokenizeSemanticText(input);
  const uniqueTokens = uniqueNormalizedStrings(tokens);
  const enableFuzzy = normalizedInput.length >= 5;

  let score = 0;
  const reasons: string[] = [];

  if (selectedTipologia === "ENTRATA" || selectedTipologia === "USCITA") {
    if (entry.tipologia === selectedTipologia) {
      score += 25;
      reasons.push("tipologia coerente");
    } else {
      score -= 15;
    }
  }

  for (const phrase of entry.normalizedAlias) {
    if (!phrase) continue;

    if (normalizedInput === phrase) {
      score += 80;
      reasons.push("frase esatta");
    } else if (phrase.startsWith(normalizedInput) && normalizedInput.length >= 3) {
      score += 32;
      reasons.push("inizio frase coerente");
    } else if (normalizedInput.includes(phrase)) {
      score += 28;
      reasons.push("frase contenuta");
    }
  }

  if (normalizedInput.includes(entry.normalizedDettaglioLabel)) {
    score += 45;
    reasons.push("match su dettaglio");
  }

  if (normalizedInput.includes(entry.normalizedSpecificaLabel)) {
    score += 20;
    reasons.push("match su specifica");
  }

  for (const token of uniqueTokens) {
    for (const word of entry.normalizedTriggerWords) {
      if (token === word) {
        score += 14;
        reasons.push(`parola forte: ${word}`);
      } else if (fuzzyTokenMatch(token, word, enableFuzzy)) {
        score += 8;
        reasons.push(`refuso vicino a: ${word}`);
      }
    }

    for (const word of entry.normalizedSupportWords) {
      if (token === word) {
        score += 5;
      } else if (fuzzyTokenMatch(token, word, enableFuzzy && token.length >= 6)) {
        score += 2;
      }
    }
  }

  const overlap = uniqueTokens.filter((t) => entry.searchWords.includes(t)).length;
  if (overlap > 0) {
    score += overlap * 2;
    reasons.push(`coerenza percorso: ${overlap}`);
  }

  return { entry, score, reasons: uniqueStrings(reasons) };
}

function findSemanticMatches(
  input: string,
  entries: SemanticEntry[],
  selectedTipologia: Tipologia | ""
) {
  const normalized = applyCommonFixes(input);
  if (!normalized) return [];

  const candidateEntries = entries.filter((entry) => {
    if (
      (selectedTipologia === "ENTRATA" || selectedTipologia === "USCITA") &&
      entry.tipologia !== selectedTipologia
    ) {
      return false;
    }

    if (normalized.length < 3) {
      return (
        entry.normalizedDettaglioLabel.startsWith(normalized) ||
        entry.normalizedSpecificaLabel.startsWith(normalized) ||
        entry.normalizedAlias.some((a) => a.startsWith(normalized))
      );
    }

    return (
      entry.normalizedDettaglioLabel.includes(normalized) ||
      entry.normalizedSpecificaLabel.includes(normalized) ||
      entry.normalizedAlias.some((a) => a.includes(normalized)) ||
      tokenizeSemanticText(input).some((token) => entry.searchWords.includes(token))
    );
  });

  const scored = candidateEntries.map((entry) =>
    scoreSemanticEntry(input, entry, selectedTipologia)
  );

  const filtered = scored
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.dettaglioLabel.localeCompare(b.entry.dettaglioLabel, "it");
    });

  const deduped: ScoredSemanticEntry[] = [];
  const seen = new Set<string>();

  for (const row of filtered) {
    const key = semanticEntryKey(row.entry);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= 6) break;
  }

  return deduped;
}

function confidenceFromScore(score: number) {
  if (score >= 120) return 98;
  if (score >= 90) return 92;
  if (score >= 70) return 85;
  if (score >= 50) return 74;
  if (score >= 35) return 62;
  return 48;
}

function buildFastAutocompleteOptions(
  input: string,
  entries: SemanticEntry[],
  selectedTipologia: Tipologia | ""
) {
  const normalized = applyCommonFixes(input);
  if (!normalized) return [];

  const values: string[] = [];

  for (const entry of entries) {
    if (
      (selectedTipologia === "ENTRATA" || selectedTipologia === "USCITA") &&
      entry.tipologia !== selectedTipologia
    ) {
      continue;
    }

    const pushIfMatch = (original: string, normalizedValue: string) => {
      if (!original || !normalizedValue) return;

      if (normalizedValue.startsWith(normalized)) {
        values.push(original);
        return;
      }

      if (normalized.length >= 3 && normalizedValue.includes(normalized)) {
        values.push(original);
      }
    };

    pushIfMatch(entry.dettaglioLabel, entry.normalizedDettaglioLabel);
    pushIfMatch(entry.specificaLabel, entry.normalizedSpecificaLabel);

    for (let i = 0; i < entry.alias.length; i++) {
      pushIfMatch(entry.alias[i], entry.normalizedAlias[i] || "");
    }

    if (values.length >= 30) break;
  }

  return uniqueStrings(values).slice(0, 12);
}

function filterEntriesByFunnel(
  entries: SemanticEntry[],
  tipologia: Tipologia | "",
  gate: FunnelGate | "",
  context: FunnelContext | ""
) {
  const allowedMacros = getAllowedMacrosByContext(tipologia, context);

  return entries.filter((entry) => {
    if (
      (tipologia === "ENTRATA" || tipologia === "USCITA") &&
      entry.tipologia !== tipologia
    ) {
      return false;
    }

    if (allowedMacros.length > 0 && !allowedMacros.includes(entry.categoria)) {
      return false;
    }

    if (!matchesGate(entry, gate)) {
      return false;
    }

    return true;
  });
}

/* =========================
   COMPONENT
========================= */

export default function MovimentoEditor() {
  const annualitaId = localStorage.getItem("annualita_id");
  const editId = localStorage.getItem("movimento_edit_id");
  const presetTipologia = (localStorage.getItem("movimento_tipologia") as Tipologia) || "";

  const [loading, setLoading] = useState(!!editId);
  const [error, setError] = useState<string | null>(null);

  const [tipologia, setTipologia] = useState<Tipologia | "">(presetTipologia);
  const [funnelGate, setFunnelGate] = useState<FunnelGate | "">("");
  const [funnelContext, setFunnelContext] = useState<FunnelContext | "">("");

  const [data, setData] = useState("");
  const [conto, setConto] = useState<Conto>("CASSA");
  const [importo, setImporto] = useState("");
  const [iva, setIva] = useState("0");
  const [regime, setRegime] = useState<Regime>("ORDINARIO");

  const [semanticInput, setSemanticInput] = useState("");
  const [debouncedSemanticInput, setDebouncedSemanticInput] = useState("");
  const [semanticResults, setSemanticResults] = useState<ScoredSemanticEntry[]>([]);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const [selectedSemanticEntry, setSelectedSemanticEntry] = useState<SemanticEntry | null>(null);
  const [selectedSemanticKey, setSelectedSemanticKey] = useState("");

  const [forceManual, setForceManual] = useState(false);

  const [macro, setMacro] = useState<Macro | "">("");
  const [descrizioneCode, setDescrizioneCode] = useState<number | null>(null);
  const [descrizioneLabel, setDescrizioneLabel] = useState("");
  const [descrizioneDettaglio, setDescrizioneDettaglio] = useState("");
  const [descrizioneLibera, setDescrizioneLibera] = useState("");

  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  const isEntrataOrUscita = tipologia === "ENTRATA" || tipologia === "USCITA";
  const isAvanzo = tipologia === "AVANZO_CASSA_T_1" || tipologia === "AVANZO_BANCA_T_1";
  const isRegimeOrdinario = regime === "ORDINARIO";
  const showIvaField = isEntrataOrUscita && isRegimeOrdinario;

  const allSemanticEntries = useMemo(() => buildSemanticEntries(), []);

  const filteredEntries = useMemo(() => {
    return filterEntriesByFunnel(allSemanticEntries, tipologia, funnelGate, funnelContext);
  }, [allSemanticEntries, tipologia, funnelGate, funnelContext]);

  const semanticAutocompleteOptions = useMemo(() => {
    return buildFastAutocompleteOptions(semanticInput, filteredEntries, tipologia);
  }, [semanticInput, filteredEntries, tipologia]);

  const gateOptions = useMemo(() => getGateOptions(tipologia), [tipologia]);
  const contextOptions = useMemo(() => getContextOptions(tipologia), [tipologia]);

  const filteredMacroOptions = useMemo(() => {
    const allowed = getAllowedMacrosByContext(tipologia, funnelContext);

    const base =
      tipologia === "USCITA"
        ? [
            "AIG",
            "ATTIVITA_DIVERSE",
            "RACCOLTE_FONDI",
            "ATTIVITA_FINANZIARIA_PATRIMONIALE",
            "SUPPORTO_GENERALE",
            "INVESTIMENTO_DISINVESTIMENTO",
            "IMPOSTE",
            "COSTI_GENERALI",
          ]
        : [
            "AIG",
            "ATTIVITA_DIVERSE",
            "RACCOLTE_FONDI",
            "ATTIVITA_FINANZIARIA_PATRIMONIALE",
            "SUPPORTO_GENERALE",
            "INVESTIMENTO_DISINVESTIMENTO",
          ];

    return base.filter((m) => allowed.includes(m as Macro)) as Macro[];
  }, [tipologia, funnelContext]);

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

  const showData = isEntrataOrUscita;
  const showGate = isEntrataOrUscita;
  const showContext = isEntrataOrUscita && !!funnelGate;
  const showSemanticBox = isEntrataOrUscita && !!funnelGate && !!funnelContext;

  const semanticTried = normalizeText(debouncedSemanticInput).length > 0;
  const semanticHasMatches = semanticResults.length > 0;
  const semanticNoMatch = showSemanticBox && semanticTried && !semanticHasMatches;

  const showManualSection = isEntrataOrUscita && (forceManual || semanticNoMatch);

  const showDescrizioneCodificata =
    showManualSection && macro !== "IMPOSTE" && primaryOptions.length > 0;

  const showDettaglioDescrizione =
    showDescrizioneCodificata &&
    !!descrizioneCode &&
    !config?.hideSecondary &&
    secondaryOptions.length > 0;

  const isImposteTextOnly = tipologia === "USCITA" && macro === "IMPOSTE";

  const showDescrizionePersonale =
    (selectedSemanticEntry !== null || showManualSection) &&
    (isImposteTextOnly || !!descrizioneCode || !!selectedSemanticEntry);

  const showFinancialFields =
    isAvanzo ||
    (isEntrataOrUscita &&
      (selectedSemanticEntry !== null || showManualSection || !!aiSuggestion));

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
      setData(row.data || "");
      setMacro((row.macro as Macro) || "");
      setConto((row.conto as Conto) || "CASSA");
      setImporto(String(row.importo ?? ""));
      setIva(String(row.iva ?? 0));
      setForceManual(true);

      const fullLabel = String(row.descrizione_label ?? "");
      setDescrizioneLabel(fullLabel);
      setDescrizioneCode(row.descrizione_code ?? null);

      const parts = fullLabel
        .split(" | ")
        .map((x: string) => x.trim())
        .filter(Boolean);

      if (parts.length >= 2) {
        setDescrizioneDettaglio(parts[1]);
      } else {
        setDescrizioneDettaglio("");
      }

      if (parts.length >= 3) {
        setDescrizioneLibera(parts.slice(2).join(" | "));
      } else {
        setDescrizioneLibera(row.descrizione_libera || "");
      }

      setLoading(false);
    };

    load();
  }, [editId]);

  useEffect(() => {
    if (editId) return;

    setFunnelGate("");
    setFunnelContext("");
    setData("");
    setConto("CASSA");
    setImporto("");
    setIva("0");
    setSemanticInput("");
    setDebouncedSemanticInput("");
    setSemanticResults([]);
    setSemanticError(null);
    setSelectedSemanticEntry(null);
    setSelectedSemanticKey("");
    setForceManual(false);
    setMacro("");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setDescrizioneDettaglio("");
    setDescrizioneLibera("");
    setAiInput("");
    setAiSuggestion(null);
    setAiError(null);
  }, [tipologia, editId]);

  useEffect(() => {
    if (editId) return;

    setFunnelContext("");
    setSemanticInput("");
    setDebouncedSemanticInput("");
    setSemanticResults([]);
    setSemanticError(null);
    setSelectedSemanticEntry(null);
    setSelectedSemanticKey("");
    setForceManual(false);
    setMacro("");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setDescrizioneDettaglio("");
    setDescrizioneLibera("");
    setAiInput("");
    setAiSuggestion(null);
    setAiError(null);
  }, [funnelGate, editId]);

  useEffect(() => {
    if (editId) return;

    setSemanticInput("");
    setDebouncedSemanticInput("");
    setSemanticResults([]);
    setSemanticError(null);
    setSelectedSemanticEntry(null);
    setSelectedSemanticKey("");
    setForceManual(false);
    setMacro("");
    setDescrizioneCode(null);
    setDescrizioneLabel("");
    setDescrizioneDettaglio("");
    setDescrizioneLibera("");
    setAiInput("");
    setAiSuggestion(null);
    setAiError(null);
  }, [funnelContext, editId]);

  useEffect(() => {
    if (editId) return;

    // Se la macro cambia a seguito di una selezione semantica o AI,
    // non devo azzerare subito la selezione altrimenti il primo click si perde.
    if (selectedSemanticEntry || aiSuggestion) return;

    setDescrizioneCode(null);
    setDescrizioneDettaglio("");
    setDescrizioneLibera("");
  }, [macro, editId, selectedSemanticEntry, aiSuggestion]);

  useEffect(() => {
    if (editId) return;
    setDescrizioneDettaglio("");
    setDescrizioneLibera(selectedSemanticEntry ? semanticInput.trim() : "");
  }, [descrizioneCode, editId, selectedSemanticEntry, semanticInput]);

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
  }, [isAvanzo, isImposteTextOnly, selectedPrimary, descrizioneDettaglio, descrizioneLibera]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSemanticInput(semanticInput);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [semanticInput]);

  useEffect(() => {
    const value = normalizeText(debouncedSemanticInput);

    if (!showSemanticBox || !value) {
      setSemanticResults([]);
      setSemanticError(null);
      return;
    }

    const results = findSemanticMatches(value, filteredEntries, tipologia);
    setSemanticResults(results);

    if (!results.length) {
      setSemanticError(
        "Nessuna proposta trovata in questo ramo. Puoi aprire la compilazione manuale."
      );
    } else {
      setSemanticError(null);
    }
  }, [debouncedSemanticInput, filteredEntries, tipologia, showSemanticBox]);

  function applySemanticEntry(entry: SemanticEntry) {
    const key = semanticEntryKey(entry);

    setSelectedSemanticKey(key);
    setSelectedSemanticEntry(entry);
    setForceManual(false);
    setAiSuggestion(null);
    setAiError(null);

    setMacro(entry.categoria);
    setDescrizioneCode(entry.specificaCode);
    setDescrizioneDettaglio(entry.dettaglio ? entry.dettaglioLabel : "");
    setDescrizioneLibera(semanticInput.trim());

    if (entry.contoConsigliato) {
      setConto(entry.contoConsigliato);
    }
  }

  async function chiediAiClassificazione() {
    setAiError(null);
    setAiSuggestion(null);

    if (!(tipologia === "ENTRATA" || tipologia === "USCITA")) {
      setAiError("Prima seleziona Entrata o Uscita");
      return;
    }

    const testo = normalizeText(aiInput || semanticInput);
    if (!testo) {
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
          testo,
          macroAttuale: macro || null,
        }),
      });

      const rawText = await response.text();

      let json: any;
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error(rawText || "Risposta server non valida");
      }

      if (!response.ok) {
        throw new Error(json?.error || "Errore AI");
      }

      const normalized: AiSuggestion = {
        macro: json.macro,
        macroLabel: String(json.macroLabel || ""),
        descrizioneCode: typeof json.descrizioneCode === "number" ? json.descrizioneCode : null,
        descrizionePrimaryLabel: String(json.descrizionePrimaryLabel || ""),
        descrizioneDettaglio: String(json.descrizioneDettaglio || ""),
        descrizioneLiberaSuggerita: String(json.descrizioneLiberaSuggerita || ""),
        contoConsigliato:
          json.contoConsigliato === "CASSA" || json.contoConsigliato === "BANCA"
            ? json.contoConsigliato
            : null,
        confidenza: Number.isFinite(Number(json.confidenza)) ? Number(json.confidenza) : 0,
        exactMatch: Boolean(json.exactMatch),
        motivazioneBreve: String(json.motivazioneBreve || ""),
      };

      setAiSuggestion(normalized);
      setSelectedSemanticEntry(null);
      setSelectedSemanticKey("");

      setMacro(normalized.macro);
      if (normalized.contoConsigliato) setConto(normalized.contoConsigliato);

      if (normalized.macro === "IMPOSTE") {
        setDescrizioneCode(null);
        setDescrizioneDettaglio("");
        setDescrizioneLibera(normalized.descrizioneLiberaSuggerita || testo);
      } else {
        setDescrizioneCode(normalized.descrizioneCode ?? null);
        setDescrizioneDettaglio(normalized.descrizioneDettaglio || "");
        setDescrizioneLibera(normalized.descrizioneLiberaSuggerita || testo);
      }

      setForceManual(true);
    } catch (err: any) {
      setAiError(err?.message || "Errore nella richiesta AI");
    } finally {
      setAiLoading(false);
    }
  }

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
      if (!data) {
        setError("Inserisci la data");
        return;
      }

      if (!selectedSemanticEntry && !forceManual && !aiSuggestion) {
        setError("Seleziona una proposta oppure apri la compilazione manuale");
        return;
      }

      if (!macro) {
        setError("Manca la categoria finale");
        return;
      }

      if (macro === "IMPOSTE") {
        if (!normalizeText(descrizioneLibera)) {
          setError("Inserisci la descrizione personale");
          return;
        }
      } else {
        if (!descrizioneCode) {
          setError("Seleziona la specifica di categoria");
          return;
        }

        if (showDettaglioDescrizione && !normalizeText(descrizioneDettaglio)) {
          setError("Seleziona o scrivi il dettaglio della posta");
          return;
        }

        if (!normalizeText(descrizioneLibera)) {
          setError("Inserisci una descrizione personale");
          return;
        }
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
      descrizione_code: isAvanzo || macro === "IMPOSTE" ? null : descrizioneCode,
      descrizione_label: isAvanzo ? null : descrizioneLabel || null,
      descrizione_libera: isAvanzo ? null : normalizeText(descrizioneLibera) || null,
      importo: Number(importo),
      iva: showIvaField ? Number(iva || 0) : 0,
      is_costo_generale: macro === "COSTI_GENERALI" || macro === "SUPPORTO_GENERALE",
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
            Rispondi a poche domande semplici: il sistema restringe il campo e ti porta alla voce finale corretta.
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

      {showData && (
        <Card title="2️⃣ Data">
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="input"
          />
        </Card>
      )}

      {showGate && (
        <Card title={showData ? "3️⃣ Cosa hai fatto?" : "2️⃣ Cosa hai fatto?"}>
          <div style={{ display: "grid", gap: 10 }}>
            {gateOptions.map((opt: FunnelOption<FunnelGate>) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFunnelGate(opt.value)}
                style={{
                  textAlign: "left",
                  border: funnelGate === opt.value ? "2px solid #111827" : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: funnelGate === opt.value ? "#fafafa" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                <div className="rowSub" style={{ marginTop: 4 }}>
                  {opt.help}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {showContext && (
        <Card title="4️⃣ Per cosa?">
          <div style={{ display: "grid", gap: 10 }}>
            {contextOptions.map((opt: FunnelOption<FunnelContext>) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFunnelContext(opt.value)}
                style={{
                  textAlign: "left",
                  border: funnelContext === opt.value ? "2px solid #111827" : "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: funnelContext === opt.value ? "#fafafa" : "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                <div className="rowSub" style={{ marginTop: 4 }}>
                  {opt.help}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {showSemanticBox && (
        <Card title="5️⃣ Descrivi l’operazione">
          <input
            list="semantic-autocomplete-list"
            value={semanticInput}
            onChange={(e) => {
              setSemanticInput(e.target.value);
              setSelectedSemanticEntry(null);
              setSelectedSemanticKey("");
              setAiSuggestion(null);
            }}
            className="input"
            placeholder="Es.: fattura commercialista, contributo comune, interessi attivi banca, benzina pulmino..."
          />

          <datalist id="semantic-autocomplete-list">
            {semanticAutocompleteOptions.map((item: string) => (
              <option key={item} value={item} />
            ))}
          </datalist>

          <div className="rowSub" style={{ marginTop: 8 }}>
            La ricerca si svolge solo dentro il percorso che hai scelto con le domande precedenti.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <SecondaryButton
              onClick={() => {
                const next = !forceManual;
                setForceManual(next);

                if (next) {
                  setSelectedSemanticKey("");
                  setSelectedSemanticEntry(null);
                }
              }}
            >
              {showManualSection ? "Chiudi compilazione manuale" : "Compila manualmente"}
            </SecondaryButton>

            {(semanticResults.length > 0 || semanticInput) && (
              <SecondaryButton
                onClick={() => {
                  setSemanticInput("");
                  setDebouncedSemanticInput("");
                  setSemanticResults([]);
                  setSemanticError(null);
                  setSelectedSemanticKey("");
                  setSelectedSemanticEntry(null);
                }}
              >
                Pulisci ricerca
              </SecondaryButton>
            )}
          </div>

          {semanticError && normalizeText(debouncedSemanticInput) && !forceManual && (
            <div style={{ marginTop: 12 }}>
              <Badge tone="red">Ricerca</Badge>
              <div className="errorText">{semanticError}</div>
            </div>
          )}

          {semanticResults.length > 0 && !forceManual && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              {semanticResults
                .filter((row: ScoredSemanticEntry) => {
                  if (!selectedSemanticKey) return true;
                  return semanticEntryKey(row.entry) === selectedSemanticKey;
                })
                .map((row: ScoredSemanticEntry, index: number) => {
                  const confidence = confidenceFromScore(row.score);
                  const rowKey = semanticEntryKey(row.entry);
                  const isSelected = rowKey === selectedSemanticKey;

                  return (
                    <button
                      key={rowKey}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedSemanticKey("");
                          setSelectedSemanticEntry(null);
                          setMacro("");
                          setDescrizioneCode(null);
                          setDescrizioneDettaglio("");
                          setDescrizioneLibera("");
                          return;
                        }

                        applySemanticEntry(row.entry);
                      }}
                      style={{
                        textAlign: "left",
                        border: isSelected ? "2px solid #111827" : "1px solid #d1d5db",
                        borderRadius: 10,
                        padding: "10px 12px",
                        background: isSelected ? "#f9fafb" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          marginBottom: 4,
                        }}
                      >
                        <Badge tone={index === 0 && !selectedSemanticKey ? "green" : "blue"}>
                          {index === 0 && !selectedSemanticKey ? "Consigliata" : "Opzione"}
                        </Badge>

                        {isSelected && <Badge tone="green">Selezionata</Badge>}

                        <span style={{ fontSize: 13, color: "#6b7280" }}>{confidence}%</span>
                      </div>

                      <div
                        style={{
                          fontWeight: 700,
                          lineHeight: 1.35,
                        }}
                      >
                        {row.entry.categoriaLabel} → {row.entry.specificaLabel}
                        {row.entry.dettaglio ? ` → ${row.entry.dettaglioLabel}` : ""}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </Card>
      )}

      {selectedSemanticEntry && (
        <Card title="6️⃣ Classificazione selezionata">
          <div style={{ marginBottom: 6 }}>
            <b>Categoria:</b> {selectedSemanticEntry.categoriaLabel}
          </div>
          <div style={{ marginBottom: 6 }}>
            <b>Specifica di categoria:</b> {selectedSemanticEntry.specificaLabel}
          </div>
          {selectedSemanticEntry.dettaglio && (
            <div style={{ marginBottom: 6 }}>
              <b>Dettaglio della posta:</b> {selectedSemanticEntry.dettaglioLabel}
            </div>
          )}
          <div className="rowSub">
            Puoi proseguire direttamente oppure aprire la compilazione manuale per correggere.
          </div>
        </Card>
      )}

      {showManualSection && (
        <Card title="6️⃣ Compilazione manuale sullo schema tecnico">
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Categoria</div>
              <select
                value={macro}
                onChange={(e) => {
                  setMacro(e.target.value as Macro | "");
                  setSelectedSemanticEntry(null);
                  setSelectedSemanticKey("");
                }}
                className="input"
              >
                <option value="">Seleziona…</option>
                {filteredMacroOptions.map((m: Macro) => (
                  <option key={m} value={m}>
                    {MACRO_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            {showDescrizioneCodificata && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Specifica di categoria</div>
                <select
                  value={descrizioneCode ?? ""}
                  onChange={(e) =>
                    setDescrizioneCode(e.target.value ? Number(e.target.value) : null)
                  }
                  className="input"
                >
                  <option value="">Seleziona…</option>
                  {primaryOptions.map((v: OptionItem) => (
                    <option key={v.code} value={v.code}>
                      {v.code}. {v.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {showDettaglioDescrizione && (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Dettaglio della posta</div>
                <input
                  list="dettaglio-descrizione-list"
                  value={descrizioneDettaglio}
                  onChange={(e) => setDescrizioneDettaglio(e.target.value)}
                  className="input"
                  placeholder="Scrivi o cerca tra le voci"
                />
                <datalist id="dettaglio-descrizione-list">
                  {secondaryOptions.map((item: string) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
            )}
          </div>
        </Card>
      )}

      {(showManualSection || semanticNoMatch) && (
        <Card title="7️⃣ Aiuto classificazione AI">
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            className="input"
            rows={4}
            placeholder="Descrivi l’operazione se vuoi un suggerimento AI aggiuntivo"
            style={{ resize: "vertical" }}
          />

          <div className="rowSub" style={{ marginTop: 8 }}>
            L’AI aiuta a trovare il ramo tecnico, ma il risultato finale resta sempre una voce del tuo schema.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
            <PrimaryButton onClick={chiediAiClassificazione} disabled={aiLoading}>
              {aiLoading ? "Analisi in corso..." : "Suggerisci collocazione"}
            </PrimaryButton>
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
                <b>Categoria:</b> {aiSuggestion.macroLabel || "—"}
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
                  <b>Descrizione personale suggerita:</b> {aiSuggestion.descrizioneLiberaSuggerita}
                </div>
              )}

              <div style={{ marginBottom: 6 }}>
                <b>Conto consigliato:</b> {aiSuggestion.contoConsigliato || "—"}
              </div>

              <div style={{ marginBottom: 6 }}>
                <b>Confidenza:</b>{" "}
                {Number.isFinite(aiSuggestion.confidenza)
                  ? Math.round(aiSuggestion.confidenza)
                  : 0}
                %
              </div>

              {aiSuggestion.motivazioneBreve && (
                <div className="rowSub">{aiSuggestion.motivazioneBreve}</div>
              )}
            </div>
          )}
        </Card>
      )}

      {showDescrizionePersonale && (
        <Card title="8️⃣ Descrizione personale">
          <input
            value={descrizioneLibera}
            onChange={(e) => setDescrizioneLibera(e.target.value)}
            className="input"
            placeholder="Nota descrittiva dell’operazione"
          />
        </Card>
      )}

      {showFinancialFields && (
        <Card title={isAvanzo ? "2️⃣ Dati economici" : "9️⃣ Dati economici"}>
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
