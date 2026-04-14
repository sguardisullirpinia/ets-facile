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
};

type ScoredSemanticEntry = {
  entry: SemanticEntry;
  score: number;
  reasons: string[];
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

function optionExists(options: string[], value: string) {
  const a = normalizeText(value).toLowerCase();
  return options.some((x) => normalizeText(x).toLowerCase() === a);
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

/* =========================
   CONFIG
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
    { code: 5, label: "Altre uscite" },
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
    { code: 5, label: "Altre uscite" },
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

/* =========================
   ETICHETTE
========================= */

const MACRO_LABELS: Record<Macro, string> = {
  AIG: "AIG",
  ATTIVITA_DIVERSE: "Attività Diverse",
  RACCOLTE_FONDI: "Raccolte Fondi",
  ATTIVITA_FINANZIARIA_PATRIMONIALE: "Attività Finanziaria e Patrimoniale",
  SUPPORTO_GENERALE: "Supporto Generale",
  INVESTIMENTO_DISINVESTIMENTO: "Investimento e Disinvestimento",
  IMPOSTE: "Imposte",
  COSTI_GENERALI: "Costi Generali",
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
   RICERCA SEMANTICA PRO
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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((x) => normalizeText(x)).filter(Boolean)));
}

function levenshtein(a: string, b: string) {
  const aa = applyCommonFixes(a);
  const bb = applyCommonFixes(b);

  if (aa === bb) return 0;
  if (!aa.length) return bb.length;
  if (!bb.length) return aa.length;

  const matrix: number[][] = Array.from({ length: aa.length + 1 }, () =>
    Array.from({ length: bb.length + 1 }, () => 0)
  );

  for (let i = 0; i <= aa.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= bb.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= aa.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[aa.length][bb.length];
}

function fuzzyTokenMatch(token: string, expected: string) {
  const a = applyCommonFixes(token);
  const b = applyCommonFixes(expected);

  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;

  return levenshtein(a, b) <= 1;
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
         
