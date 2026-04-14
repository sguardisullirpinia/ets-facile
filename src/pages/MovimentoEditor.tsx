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
    { code: 7, label: "Entrate per prestazioni e cessioni
